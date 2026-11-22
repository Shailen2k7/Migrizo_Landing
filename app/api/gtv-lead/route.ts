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
 *   GTV_LEAD_WEBHOOK_URL       optional, e.g. a CRM or WhatsApp automation webhook
 *   GTV_LEAD_WEBHOOK_SECRET    optional, sent as X-Migrizo-Secret
 *
 * Table: see supabase/migrations/0001_gtv_leads.sql
 */
import { NextResponse } from "next/server";
import { calculateScore, scoreBand, QUALIFY_THRESHOLD, type Answers } from "@/lib/gtv-scoring";

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

  const saved = await saveToSupabase(lead);
  await forwardToWebhook(lead);
  if (!saved && !process.env.GTV_LEAD_WEBHOOK_URL) {
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
