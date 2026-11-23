/**
 * POST /api/gtv-lead
 *
 * Receives the assessment lead as JSON, validates it, recalculates the score
 * on the server (the client score is only kept for comparison), saves it to
 * Supabase and optionally forwards it to a webhook (CRM, Zapier, Make, n8n).
 *
 * Environment variables (set in Netlify > Site configuration > Environment variables):
 *   SUPABASE_URL               https://<project-ref>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY  server-only key. Never expose it with a NEXT_PUBLIC_ prefix.
 *   CRM_INGEST_SECRET          the Migrizo CRM's INGEST_SECRET. When set, every lead is also created
 *                              in the CRM (crm.migrizo.com) through its lead intake endpoint.
 *   CRM_INGEST_URL             optional, defaults to https://crm.migrizo.com/api/ingest/meta-lead
 *   GTV_LEAD_WEBHOOK_URL       optional, e.g. a CRM or WhatsApp automation webhook
 *   GTV_LEAD_WEBHOOK_SECRET    optional, sent as X-Migrizo-Secret
 *
 * Table: see supabase/migrations/0001_gtv_leads.sql
 */
import { NextResponse } from "next/server";
import { calculateScore, scoreBand, QUALIFY_THRESHOLD, QUESTIONS, type Answers } from "@/lib/gtv-scoring";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// International format: optional +, 8 to 15 digits once spaces, dashes and brackets are removed.
const PHONE_RE = /^\+?\d{8,15}$/;
const TRACKING_KEYS = [
  "gclid", "gbraid", "wbraid",
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "utm_id",
  "seg", "landing_url", "referrer", "first_seen",
];

// Small in-memory rate limit per IP. On Netlify each function instance has its own memory,
// so this only slows bursts. Pair it with Netlify's rate limiting rules if spam appears.
const hits = new Map<string, { n: number; t: number }>();
function rateLimited(ip: string) {
  const now = Date.now();
  const rec = hits.get(ip);
  if (!rec || now - rec.t > 60_000) {
    hits.set(ip, { n: 1, t: now });
    return false;
  }
  rec.n += 1;
  return rec.n > 8;
}

const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json({ ok: false, error: "Too many requests. Please try again in a minute." }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  // Honeypot: real users never fill this hidden field.
  if (str(body.company_website)) return NextResponse.json({ ok: true, score: 0, qualified: false });

  const contact = (body.contact ?? {}) as Record<string, unknown>;
  const name = str(contact.name, 120);
  const email = str(contact.email, 160).toLowerCase();
  const whatsapp = str(contact.whatsapp, 40).replace(/[\s\-().]/g, "");
  const linkedin = str(contact.linkedin, 300);
  const consent = contact.consent === true;

  const errors: Record<string, string> = {};
  if (name.length < 2) errors.name = "Please enter your full name.";
  if (!EMAIL_RE.test(email)) errors.email = "Please enter a valid email.";
  if (!PHONE_RE.test(whatsapp)) errors.whatsapp = "Please include your country code, for example +91.";
  if (linkedin && !/^https?:\/\/(www\.)?linkedin\.com\//i.test(linkedin) && !/^linkedin\.com\//i.test(linkedin))
    errors.linkedin = "Please paste a linkedin.com link.";
  if (!consent) errors.consent = "Please confirm so we can contact you.";
  if (Object.keys(errors).length) return NextResponse.json({ ok: false, errors }, { status: 422 });

  // Recalculate on the server. Never trust the client score.
  const rawAnswers = (body.answers ?? {}) as Record<string, unknown>;
  const answers: Answers = {
    field: str(rawAnswers.field, 30),
    years: str(rawAnswers.years, 30),
    role: str(rawAnswers.role, 30),
    timeline: str(rawAnswers.timeline, 30),
    evidence: Array.isArray(rawAnswers.evidence)
      ? rawAnswers.evidence.slice(0, 10).map((x) => str(x, 30))
      : [],
  };
  const score = calculateScore(answers);
  const qualified = score >= QUALIFY_THRESHOLD;
  const clientScore = typeof body.clientScore === "number" ? body.clientScore : null;

  const tracking: Record<string, string> = {};
  const rawTracking = (body.tracking ?? {}) as Record<string, unknown>;
  for (const k of TRACKING_KEYS) {
    const v = str(rawTracking[k], 500);
    if (v) tracking[k] = v;
  }

  const lead = {
    receivedAt: new Date().toISOString(),
    source: "gtv-assessment-landing",
    contact: { name, email, whatsapp, linkedin: linkedin || null, consent },
    answers,
    score,
    band: scoreBand(score),
    qualified,
    clientScore,
    scoreMismatch: clientScore !== null && clientScore !== score,
    tracking,
    userAgent: str(req.headers.get("user-agent"), 300),
  };

  // Supabase backup copy, Migrizo CRM and optional webhook run side by side.
  // Each one is guarded, so a slow or failing destination never loses the lead elsewhere.
  const [saved, inCrm] = await Promise.all([saveToSupabase(lead), sendToCrm(lead), forwardToWebhook(lead)]);
  if (!saved && !inCrm && !process.env.GTV_LEAD_WEBHOOK_URL) {
    // Last resort so the lead is at least visible in Netlify function logs.
    console.error("[gtv-lead] NOT STORED", JSON.stringify(lead));
  }

  return NextResponse.json({ ok: true, score, band: lead.band, qualified });
}

type Lead = {
  receivedAt: string;
  source: string;
  contact: { name: string; email: string; whatsapp: string; linkedin: string | null; consent: boolean };
  answers: Answers;
  score: number;
  band: string;
  qualified: boolean;
  clientScore: number | null;
  scoreMismatch: boolean;
  tracking: Record<string, string>;
  userAgent: string;
};

/** Insert via Supabase's REST API. No SDK needed, keeps the function small and fast. */
async function saveToSupabase(lead: Lead): Promise<boolean> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.warn("[gtv-lead] Supabase env vars missing, skipping insert");
    return false;
  }
  const t = lead.tracking;
  const row = {
    name: lead.contact.name,
    email: lead.contact.email,
    whatsapp: lead.contact.whatsapp,
    linkedin: lead.contact.linkedin,
    consent: lead.contact.consent,
    field: lead.answers.field || null,
    years: lead.answers.years || null,
    role: lead.answers.role || null,
    evidence: Array.isArray(lead.answers.evidence) ? lead.answers.evidence : [],
    timeline: lead.answers.timeline || null,
    score: lead.score,
    band: lead.band,
    qualified: lead.qualified,
    client_score: lead.clientScore,
    score_mismatch: lead.scoreMismatch,
    gclid: t.gclid ?? null,
    gbraid: t.gbraid ?? null,
    wbraid: t.wbraid ?? null,
    utm_source: t.utm_source ?? null,
    utm_medium: t.utm_medium ?? null,
    utm_campaign: t.utm_campaign ?? null,
    utm_term: t.utm_term ?? null,
    utm_content: t.utm_content ?? null,
    seg: t.seg ?? null,
    landing_url: t.landing_url ?? null,
    referrer: t.referrer ?? null,
    tracking: t,
    user_agent: lead.userAgent,
    source: lead.source,
  };
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/rest/v1/gtv_leads`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(row),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error("[gtv-lead] Supabase insert failed", res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("[gtv-lead] Supabase insert error", err);
    return false;
  }
}

async function forwardToWebhook(lead: Lead) {
  const webhook = process.env.GTV_LEAD_WEBHOOK_URL;
  if (!webhook) return;
  try {
    const res = await fetch(webhook, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.GTV_LEAD_WEBHOOK_SECRET ? { "X-Migrizo-Secret": process.env.GTV_LEAD_WEBHOOK_SECRET } : {}),
      },
      body: JSON.stringify(lead),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) console.error("[gtv-lead] webhook responded", res.status);
  } catch (err) {
    // Never fail the visitor's request because a downstream tool is slow.
    console.error("[gtv-lead] webhook failed", err);
  }
}

/* ==========================================================================
   Migrizo CRM (crm.migrizo.com)
   ==========================================================================
   Uses the CRM's own lead intake endpoint, the same one the Meta lead ads and
   the website popup use. So a landing page lead gets exactly the same handling:
   duplicate check by phone, a row in Leads, today's call queue, the automatic
   "How it works" email, the activity timeline and the ingest log.
   No CRM code or database change is needed, and the CRM's database keys never
   leave the CRM: this site only knows the shared INGEST_SECRET.

   What the CRM receives:
     full_name, phone (+country code), email
     visa_type   "gtv"
     source      "Google Ads" when the visitor came from a Google or YouTube ad,
                 otherwise "GTV Landing Page"
     tags        ["gtv-landing"], plus "gtv-qualified" for a score of 60 or more
     expertise   the field label, which the CRM maps to its industry (tech, research, art)
     everything else (score, answers, LinkedIn, gclid, UTMs) lands in the lead's
     intake answers, readable in the lead drawer.
   ========================================================================== */
const label = (qid: string, id: unknown): string => {
  const q = QUESTIONS.find((x) => x.id === qid);
  const one = (v: string) => q?.options.find((o) => o.id === v)?.label || v;
  if (Array.isArray(id)) return id.map((v) => one(String(v))).join(", ");
  return id ? one(String(id)) : "";
};

async function sendToCrm(lead: Lead): Promise<boolean> {
  const secret = process.env.CRM_INGEST_SECRET;
  if (!secret) return false;
  const url = process.env.CRM_INGEST_URL || "https://crm.migrizo.com/api/ingest/meta-lead";
  const t = lead.tracking;
  const fromGoogleAds = !!(t.gclid || t.gbraid || t.wbraid);
  const tags = ["gtv-landing"];
  if (lead.qualified) tags.push("gtv-qualified");

  const body: Record<string, string | string[]> = {
    token: secret,
    full_name: lead.contact.name,
    phone: lead.contact.whatsapp.startsWith("+") ? lead.contact.whatsapp : `+${lead.contact.whatsapp}`,
    email: lead.contact.email,
    visa_type: "gtv",
    source: fromGoogleAds ? "Google Ads" : "GTV Landing Page",
    tags,
    form_name: "GTV assessment landing page",
    created_time: lead.receivedAt,
    // Mapped by the CRM to leads.industry
    expertise: label("field", lead.answers.field),
    // Stored as intake answers on the lead
    gtv_score: `${lead.score}/100`,
    gtv_band: lead.band.charAt(0).toUpperCase() + lead.band.slice(1),
    gtv_qualified: lead.qualified ? "Yes" : "No",
    experience: label("years", lead.answers.years),
    current_role: label("role", lead.answers.role),
    evidence: label("evidence", lead.answers.evidence),
    move_timeline: label("timeline", lead.answers.timeline),
  };
  if (lead.contact.linkedin) body.linkedin = lead.contact.linkedin;
  for (const k of ["gclid", "gbraid", "wbraid", "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "seg", "landing_url"]) {
    if (t[k]) body[k] = t[k];
  }
  if (t.utm_campaign) body.campaign_name = t.utm_campaign;
  if (fromGoogleAds) body.platform = "google";

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    const out = (await res.json().catch(() => ({}))) as { ok?: boolean; id?: string; returning?: boolean; reason?: string };
    if (!res.ok || !out.ok) {
      console.error("[gtv-lead] CRM rejected the lead", res.status, out.reason || "");
      return false;
    }
    console.log("[gtv-lead] CRM", out.returning ? "updated existing lead" : "created lead", out.id || "");
    return true;
  } catch (err) {
    // Never fail the visitor's request because the CRM is slow. The Supabase copy still has the lead.
    console.error("[gtv-lead] CRM request failed", err);
    return false;
  }
}
