"use client";

/* ==========================================================================
   CONFIG: edit these before going live
   ========================================================================== */
import { QUALIFY_THRESHOLD } from "@/lib/gtv-scoring";

const CONFIG = {
  /** Calendly / Cal.com / HubSpot meetings link for the free strategy call. */
  bookingUrl: "https://crm.migrizo.com/book/shailen",
  /** WhatsApp number in international format, digits only, no + or spaces. */
  whatsappNumber: "447887348822",
  /** Pre-filled WhatsApp message. */
  whatsappMessage: "Hi Migrizo, I would like to know if I qualify for the UK Global Talent Visa.",
  /**
   * Score needed to be offered a strategy call. Defined in lib/gtv-scoring.ts
   * so the server uses exactly the same number. Change it there.
   */
  scoreThreshold: QUALIFY_THRESHOLD,
  /** Lead endpoint (see app/api/gtv-lead/route.ts). */
  leadEndpoint: "/api/gtv-lead",
  /** Founder photo. Put the file in /public and set e.g. "/founder.jpg". */
  founderPhoto: "/brand/founder-shailendra.png" as string | null,
  /** Show the "Visa At A Glance" section. */
  showGlance: false as boolean,
  /** Show the extra sections (refusals, myths, life in the UK, full job band, endorser strip). */
  showMoreSections: false as boolean,
  /** Privacy policy (required by Google Ads because the form collects personal details). */
  privacyUrl: "https://migrizo.com/privacy",
  /** Default country code shown in the WhatsApp field. */
  defaultDialCode: "+91 ",
} as const;

/** Logos pulled from migrizo.com (tagline removed so they stay legible at header size). */
const LOGO = { white: "/brand/migrizo-white.png", navy: "/brand/migrizo-navy.png", w: 600, h: 154 };

/** Photography from Unsplash (free for commercial use), saved in /public/photos. Swap any file to change a photo. */
const PHOTOS = {
  hero: "/photos/hero.webp", // Tower Bridge at dusk
  thames: "/photos/thames.webp", // Thames from above
  regent: "/photos/regent.webp", // Regent Street flags
  westminster: "/photos/westminster.webp", // Big Ben and a red bus
  night: "/photos/night.webp", // The Shard and Tower Bridge at night
  bigBen: "/photos/bigBen.webp", // Elizabeth Tower and Boadicea
  bigBenDusk: "/photos/bigBenDusk.webp", // Big Ben at dusk
  towerBridge: "/photos/towerBridge.webp", // Tower Bridge by day
  edinburgh: "/photos/edinburgh.webp", // Edinburgh skyline
  tech: "/photos/tech.webp", // AI circuit brain
  research: "/photos/research.webp", // scientist at a microscope
  arts: "/photos/arts.webp", // dancer on stage
  cambridge: "/photos/cambridge.webp", // King's College, Cambridge
  manchester: "/photos/manchester.webp", // Manchester city centre
  oxford: "/photos/oxford.webp", // Radcliffe Camera, Oxford
  canaryWharf: "/photos/canaryWharf.webp", // Canary Wharf at sunset
  design: "/photos/design.webp", // colour swatches
  papers: "/photos/papers.webp", // reviewing documents
  review: "/photos/review.webp", // working through a plan
  westminsterBridge: "/photos/westminsterBridge.webp", // Westminster Bridge
};
/* ======================================================================== */

import Image from "next/image";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Atom, BookOpen, Briefcase, BriefcaseBusiness, Building2, CalendarCheck, CalendarClock, Check, ChevronLeft, ChevronRight, CircleAlert, Clapperboard, Clock, Cog, Compass, Cpu, FileCheck, FileText, Globe, GraduationCap, Handshake, HeartPulse, House, Landmark, ListChecks, Lock, Mail, Menu, MessageSquareWarning, Microscope, Mic, Minus, Palette, PenLine, Plane, Presentation, RotateCcw, Route, SearchX, ShieldCheck, Shirt, Target, Timer, UserCheck, Users, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { QUESTIONS, calculateScore, scoreBand, scoreBreakdown, type Answers, type Band, type Question } from "@/lib/gtv-scoring";

/* ==========================================================================
   Tracking
   ========================================================================== */
declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
    __gtvReveal?: boolean;
  }
}
const ATTR_KEY = "gtv_attribution";
const ATTR_PARAMS = ["gclid", "gbraid", "wbraid", "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "utm_id", "seg"];

function track(event: string, data: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event, ...data });
}
/** Google Tag Manager is only loaded when NEXT_PUBLIC_GTM_ID is set (see app/layout.tsx). */
const GTM_ON = !!(process.env.NEXT_PUBLIC_GTM_ID || "").trim();
const CONSENT_KEY = "gtv_consent";
/** Record the visitor's cookie choice with Google consent mode v2. */
function setConsent(granted: boolean) {
  const v = granted ? "granted" : "denied";
  try {
    localStorage.setItem(CONSENT_KEY, v);
  } catch {
    /* storage blocked: choice applies to this page view only */
  }
  window.dataLayer = window.dataLayer || [];
  // gtag() pushes the arguments object itself, which is what consent mode expects.
  // eslint-disable-next-line prefer-rest-params
  (function gtag(..._args: unknown[]) { (window.dataLayer as unknown[]).push(arguments); })("consent", "update", {
    ad_storage: v,
    ad_user_data: v,
    ad_personalization: v,
    analytics_storage: v,
  });
  track("gtv_consent_update", { consent: v });
}
/** E.164 phone for enhanced conversions: +, then digits only. */
const e164 = (raw: string) => {
  const d = raw.replace(/[^\d+]/g, "");
  return d.startsWith("+") ? "+" + d.slice(1).replace(/\+/g, "") : "+" + d;
};
const newLeadId = () => {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
};
/** Store click ids and UTMs for the session. New ad clicks overwrite, landing info is first-touch. */
function captureAttribution() {
  try {
    const params = new URLSearchParams(window.location.search);
    const next: Record<string, string> = JSON.parse(sessionStorage.getItem(ATTR_KEY) || "{}");
    for (const key of ATTR_PARAMS) {
      const v = params.get(key);
      if (v) next[key] = v.slice(0, 500);
    }
    if (!next.landing_url) {
      next.landing_url = window.location.href.slice(0, 500);
      next.referrer = document.referrer.slice(0, 500);
      next.first_seen = new Date().toISOString();
    }
    sessionStorage.setItem(ATTR_KEY, JSON.stringify(next));
  } catch {
    /* storage blocked: tracking is best effort */
  }
}
function readAttribution(): Record<string, string> {
  try {
    return JSON.parse(sessionStorage.getItem(ATTR_KEY) || "{}");
  } catch {
    return {};
  }
}
const waLink = (msg: string = CONFIG.whatsappMessage) => `https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(msg)}`;
const gbp = (n: number) => "£" + n.toLocaleString("en-GB");

/* ==========================================================================
   Hooks
   ========================================================================== */
function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}
function useCountUp(target: number, duration = 1400, enabled = true) {
  const [value, setValue] = useState(enabled ? 0 : target);
  const from = useRef(enabled ? 0 : target);
  useEffect(() => {
    if (!enabled) {
      setValue(target);
      from.current = target;
      return;
    }
    const start = performance.now();
    const f = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const v = Math.round(f + (target - f) * (1 - Math.pow(1 - t, 3)));
      setValue(v);
      from.current = v;
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, enabled]);
  return value;
}
/** Adds .in to every [data-reveal] element as it scrolls into view. Works in every modern browser. */
function useScrollReveal() {
  useEffect(() => {
    window.__gtvReveal = true;
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (!("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}
const d = (n: number) => ({ ["--d" as string]: n }) as React.CSSProperties;

/** True while the element is at least `threshold` visible. */
function useInView<T extends Element>(ref: React.RefObject<T | null>, threshold = 0.3) {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, threshold]);
  return inView;
}

/* ==========================================================================
   Small marks and illustrations (inline SVG)
   ========================================================================== */
function WhatsAppIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.9-4.45 9.9-9.91a9.85 9.85 0 0 0-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.15h-.01a8.23 8.23 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.25-8.23a8.2 8.2 0 0 1 8.24 8.24c0 4.540-3.7 8.23-8.24 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.25-.64.81-.78.97-.15.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.51.11-.11.25-.29.37-.43.13-.15.17-.25.25-.42.08-.16.04-.31-.02-.43-.06-.13-.56-1.35-.76-1.84-.2-.49-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.1-.23-.16-.48-.29Z" />
    </svg>
  );
}
function UnionFlag() {
  return (
    <svg className="flag" viewBox="0 0 60 30" aria-hidden="true">
      <clipPath id="uf">
        <rect width="60" height="30" />
      </clipPath>
      <g clipPath="url(#uf)">
        <rect width="60" height="30" fill="#012169" />
        <path d="M0 0L60 30M60 0L0 30" stroke="#fff" strokeWidth="6" />
        <path d="M0 0L60 30M60 0L0 30" stroke="#C8102E" strokeWidth="2" />
        <path d="M30 0v30M0 15h60" stroke="#fff" strokeWidth="10" />
        <path d="M30 0v30M0 15h60" stroke="#C8102E" strokeWidth="6" />
      </g>
    </svg>
  );
}
function FounderPlaceholder() {
  return (
    <svg viewBox="0 0 340 425" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <rect width="340" height="425" fill="#131D44" />
      <circle cx="170" cy="160" r="62" fill="#1D2B5F" />
      <path d="M60 425c10-100 210-100 220 0Z" fill="#1D2B5F" />
      <text x="170" y="174" textAnchor="middle" fontSize="40" fontWeight="600" fill="#E3A33B" fontFamily="inherit">
        SP
      </text>
      <text x="170" y="256" textAnchor="middle" fontSize="11" fill="#fff" fillOpacity="0.6" fontFamily="inherit">
        [PLACEHOLDER] founder photo
      </text>
    </svg>
  );
}

/* ==========================================================================
   Content
   ========================================================================== */
const NAV = [
  { id: "who", label: "Who it's for" },
  { id: "why-us", label: "Why Migrizo" },
  { id: "process", label: "How it works" },
  { id: "trust", label: "Proof" },
  { id: "help", label: "Services" },
  { id: "fees", label: "Fees" },
  { id: "founder", label: "Founder" },
  { id: "faq", label: "FAQ" },
];

/** H1 per ad segment: plain words, then the italic accent. */
const H1_VARIANTS: Record<string, { pre: string; em: string }> = {
  tech: { pre: "Tech Or AI Professional? You May Qualify For The", em: "UK Global Talent Visa" },
  research: { pre: "Researcher, Academic Or Doctor? Check Your", em: "Global Talent Eligibility" },
  arts: { pre: "Artist Or Designer? Your Work May Qualify You For The", em: "UK Global Talent Visa" },
};
const H1_DEFAULT = { pre: "Do You Qualify For The", em: "UK Global Talent Visa?" };


// Endorsing bodies and partner organisations, shown as names with icons (not logos). Migrizo is independent: the footer says so.
const ENDORSERS: { name: string; Icon: LucideIcon }[] = [
  { name: "The Royal Society", Icon: Atom },
  { name: "The British Academy", Icon: Landmark },
  { name: "Royal Academy of Engineering", Icon: Cog },
  { name: "UK Research and Innovation", Icon: Microscope },
  { name: "Digital technology route", Icon: Cpu },
  { name: "Arts Council England", Icon: Palette },
  { name: "Royal Institute of British Architects", Icon: Building2 },
  { name: "British Fashion Council", Icon: Shirt },
  { name: "Pact, film and television", Icon: Clapperboard },
];

const REASONS: { Icon: LucideIcon; title: string; bad: string; good: string; body: string; fix: string }[] = [
  {
    Icon: Route,
    title: "The Wrong Route Or Endorsing Body",
    bad: "Applied as exceptional talent with four years of early-career evidence.",
    good: "Applied as exceptional promise, with evidence matched to the early-career criteria.",
    body: "Applying as exceptional talent when the evidence fits exceptional promise, or to a body whose criteria do not fit the work.",
    fix: "We fix the route and the body before you gather a single document.",
  },
  {
    Icon: MessageSquareWarning,
    title: "Letters That Praise But Do Not Prove",
    bad: "Priya is one of the most talented engineers I have worked with.",
    good: "Priya designed the fraud model that cut chargebacks by 38% across 2.1 million monthly payments.",
    body: "Generic letters call you brilliant. Assessors want specific, checkable examples of what you did and what changed.",
    fix: "Every recommender gets a brief on exactly what their letter must show.",
  },
  {
    Icon: ListChecks,
    title: "Evidence Not Mapped To The Criteria",
    bad: "Evidence pack: 42 documents, unlabelled, in no particular order.",
    good: "Criterion 1: documents 1 to 4. Criterion 2: documents 5 to 8. Each one labelled.",
    body: "A pile of documents that never says which criterion each piece meets, so the assessor has to guess.",
    fix: "Each piece of evidence is tied to the criterion it proves, in order.",
  },
  {
    Icon: SearchX,
    title: "Claims With No Outside Proof",
    bad: "I led a major product launch at my company.",
    good: "Launch covered by two national tech titles, 120,000 sign-ups in month one, confirmed in the CTO's letter.",
    body: "Saying you led or built something, with no press, metrics or third party record that anyone can check.",
    fix: "We pair every claim with proof someone outside your company can verify.",
  },
  {
    Icon: Building2,
    title: "Impact Known Only Inside One Employer",
    bad: "Rated a top performer internally three years running.",
    good: "Invited speaker at two industry conferences, hackathon judge, open source library with 4,000 stars.",
    body: "Great work that only your colleagues know about reads as a good job, not recognition in your field.",
    fix: "We help you show recognition beyond your employer: talks, writing, judging, media.",
  },
  {
    Icon: PenLine,
    title: "A Statement That Tells A Story, Not A Case",
    bad: "I have always been passionate about technology and want to contribute to the UK.",
    good: "In 2023 I built a triage tool now used by 40 hospitals. In the UK I will scale it with NHS partners.",
    body: "A personal statement full of ambition, but light on numbers, dates and outcomes the assessor can test.",
    fix: "Your statement is built around the criteria, with facts the assessor can check.",
  },
];

const MYTHS = [
  { myth: "You need a PhD", truth: "Many successful applicants have no doctorate. Recognised impact in your field is what counts." },
  { myth: "You need a UK job offer", truth: "No sponsor and no job offer. Move first, then choose your work, employer or business." },
  { myth: "You need to be famous", truth: "You need proof that people in your field recognise your work. That is not the same as fame." },
  { myth: "It is only for senior people", truth: "The exceptional promise route is built for people earlier in their careers." },
  { myth: "There is a minimum salary", truth: "There is no salary threshold. Your evidence carries the application, not your pay slip." },
  { myth: "My field will not count", truth: "Digital technology, research, arts, culture and design are all covered. Many roles fit." },
];

/**
 * Client testimonials.
 * DRAFT WORDING: written from client feedback. Get each client's written approval of their exact
 * quote (and permission to use their name) before the page goes live in ads.
 */
const TESTIMONIALS: { name: string; initials: string; quote: string }[] = [
  {
    name: "Ramakoda Bangur",
    initials: "RB",
    quote: "I had the work but no idea how to present it. Migrizo turned years of scattered projects into a clear roadmap, and every piece of evidence had a reason to be there. For the first time the whole process felt manageable.",
  },
  {
    name: "Sreelaxmi Iyer",
    initials: "SI",
    quote: "The recommendation letter briefs made the difference. Each referee knew exactly what to write about, so the letters read as specific and genuine.",
  },
  {
    name: "Selvam Patroda",
    initials: "SP",
    quote: "Honest from the first call. They told me which criteria were weak and how to fix them, instead of telling me what I wanted to hear.",
  },
  {
    name: "Dhanesh Patel",
    initials: "DP",
    quote: "The staged plan kept me on track alongside a full time job. I always knew what was due that week and why it mattered.",
  },
  {
    name: "Sree Ayappan",
    initials: "SA",
    quote: "Working directly with Shailendra was the best part. Quick replies, sharp feedback on my personal statement and a CV that finally reads like a UK one.",
  },
];

/** Four stages, matching the four fee instalments. Submission within 12 weeks. */
const PHASES: { Icon: LucideIcon; title: string; weeks: string; summary: string; get: string }[] = [
  {
    Icon: Compass,
    title: "Kickstart",
    weeks: "Weeks 1 to 2",
    summary: "Eligibility assessment, endorsing body strategy and your personalised roadmap.",
    get: "A written roadmap: your route, your criteria and exactly what to gather.",
  },
  {
    Icon: UserCheck,
    title: "Profile Building, Phase 1",
    weeks: "Weeks 3 to 6",
    summary: "UK style CV, LinkedIn, personal statement and the first evidence you will need.",
    get: "A sharper profile and your first pieces of evidence in place.",
  },
  {
    Icon: FileText,
    title: "Profile Building, Phase 2",
    weeks: "Weeks 7 to 10",
    summary: "Recommendation letters, PR coordination and your criteria mapped evidence portfolio.",
    get: "Letters that prove, and a portfolio mapped to every criterion.",
  },
  {
    Icon: FileCheck,
    title: "Endorsement Submission",
    weeks: "Weeks 11 to 12",
    summary: "Final review against every criterion, then we submit your endorsement application with you.",
    get: "Your application submitted, within 12 weeks of starting.",
  },
];
const AFTER_SUBMIT = [
  { Icon: Timer, title: "Endorsement decision", sub: "Usually 5 to 8 weeks" },
  { Icon: Landmark, title: "Visa application", sub: "With the Home Office" },
  { Icon: BriefcaseBusiness, title: "Job support", sub: "Through Migrizo Talent" },
];

const FEE_STAGES = [
  { title: "Kickstart", body: "Eligibility assessment, endorsing body strategy and your personalised roadmap.", amount: 500 },
  { title: "Profile Building, Phase 1", body: "UK style CV, LinkedIn, personal statement and the first evidence you will need.", amount: 1000 },
  { title: "Profile Building, Phase 2", body: "Recommendation letters, PR coordination and your criteria mapped evidence portfolio.", amount: 1000 },
  { title: "Endorsement Submission", body: "Final review and submission of your endorsement application.", amount: 500 },
];

/** Life in the UK: city cards that drift past, and what the visa unlocks. */
const CITIES = [
  { img: "towerBridge", city: "London", line: "Finance, tech and the creative industries", alt: "Tower Bridge in London" },
  { img: "cambridge", city: "Cambridge", line: "Research, deep tech and life sciences", alt: "King's College, Cambridge" },
  { img: "edinburgh", city: "Edinburgh", line: "Fintech, AI research and festivals", alt: "The Edinburgh skyline at sunset" },
  { img: "oxford", city: "Oxford", line: "Universities, science and start-ups", alt: "The Radcliffe Camera in Oxford" },
  { img: "manchester", city: "Manchester", line: "Digital, media and a growing tech scene", alt: "Manchester city centre" },
  { img: "westminsterBridge", city: "Westminster", line: "The heart of UK policy and public life", alt: "Westminster Bridge and the Houses of Parliament" },
] as const;
const UNLOCKS: { Icon: LucideIcon; title: string }[] = [
  { Icon: Briefcase, title: "Work for any employer, or for yourself" },
  { Icon: Users, title: "Bring your partner and children" },
  { Icon: HeartPulse, title: "Use the NHS like other residents" },
  { Icon: GraduationCap, title: "Free state schools for your children" },
  { Icon: Plane, title: "Travel in and out freely" },
  { Icon: House, title: "Settle in as little as 3 years" },
];

/** Job support after the visa: the Migrizo Talent link to employers. */
const JOB_STEPS: { Icon: LucideIcon; title: string; body: string }[] = [
  { Icon: UserCheck, title: "Profile Ready For UK Hiring", body: "UK style CV and LinkedIn, tuned to the roles you want next." },
  { Icon: Target, title: "Role Matching", body: "We shortlist UK and European employers hiring for your skills." },
  { Icon: Handshake, title: "Warm Introductions", body: "Through Migrizo Talent we introduce you directly to hiring teams." },
  { Icon: Mic, title: "Interview Preparation", body: "Mock interviews and feedback on how UK employers assess you." },
];

const SERVICES: { Icon: LucideIcon; title: string; body: string }[] = [
  { Icon: Compass, title: "Eligibility And Route Strategy", body: "Exceptional talent or promise, and the endorsing body that fits your work." },
  { Icon: ListChecks, title: "Evidence Portfolio", body: "Your strongest evidence, mapped to each criterion and in the right order." },
  { Icon: PenLine, title: "Recommendation Letters", body: "A brief for every recommender on exactly what their letter must prove." },
  { Icon: FileText, title: "Personal Statement And CV", body: "UK style CV, LinkedIn and a statement built around the criteria." },
  { Icon: Globe, title: "PR Coordination", body: "Help getting your work recognised in the media and in your field." },
  { Icon: FileCheck, title: "Endorsement Application", body: "A final check against every criterion, then we submit it with you." },
];

/** Founder at guest lectures and London events. Files in /public/founder. */
const GALLERY = [
  { src: "/founder/lecture-sunderland-1.webp", w: 693, cap: "Guest lecture, University of Sunderland in London" },
  { src: "/founder/london-1.webp", w: 693, cap: "Founder evening, London" },
  { src: "/founder/lecture-sunderland-2.webp", w: 693, cap: "With students, University of Sunderland in London" },
  { src: "/founder/london-stage.webp", w: 897, cap: "London startup scene, on stage" },
  { src: "/founder/lecture-uel-1.webp", w: 924, cap: "Guest lecture, University of East London" },
  { src: "/founder/london-2.webp", w: 693, cap: "Networking, London" },
  { src: "/founder/lecture-sunderland-3.webp", w: 780, cap: "Guest lecture, University of Sunderland in London" },
  { src: "/founder/london-3.webp", w: 693, cap: "UK startup ecosystem meet, London" },
  { src: "/founder/lecture-uel-2.webp", w: 693, cap: "After the lecture, University of East London" },
  { src: "/founder/iit-roorkee.webp", w: 782, cap: "Founders' talk, IIT Roorkee" },
  { src: "/founder/london-4.webp", w: 693, cap: "Founder meet, London" },
  { src: "/founder/lecture-sunderland-4.webp", w: 693, cap: "Lecture hall, University of Sunderland in London" },
  { src: "/founder/london-sunderland.webp", w: 390, cap: "University of Sunderland in London" },
];
const COMPARE_COLS = ["Migrizo", "Doing it yourself", "A generalist visa agent"];
const COMPARE_ROWS = [
  { label: "Focus", cells: ["Global Talent and Innovator Founder only", "Learning the rules as you go", "Every visa type, from students to visitors"] },
  { label: "Route and body", cells: ["Chosen on the first call, in writing", "Guesswork from forums and blogs", "Often left to you"] },
  { label: "Evidence plan", cells: ["Roadmap mapped to your endorsing body's criteria", "A pile of documents and hope", "Generic document checklist"] },
  { label: "Recommendation letters", cells: ["Each recommender briefed on what to prove", "Whatever your referees write", "Templates, or left to you"] },
  { label: "Who handles your case", cells: ["One named specialist from start to decision", "You, alone", "Often passed between junior staff"] },
];

const FAQS = [
  { q: "Do I need a job offer or a sponsor?", a: "No. The Global Talent Visa needs no job offer, sponsor or employer. Once you have it you can work for any employer, be self-employed, start a business or change jobs freely." },
  { q: "I have no awards or PhD. Can I still apply?", a: "Often, yes. Endorsing bodies look at recognition of your work: products used at scale, talks, publications, open source, media, judging or mentoring, and strong letters from people in your field." },
  { q: "What if my application is refused?", a: "We only recommend applying once your evidence is ready, which is why strategy comes first. If an endorsement is refused, we review the feedback with you and plan what to strengthen. We never promise an outcome." },
  { q: "How long does the whole process take?", a: "We submit your endorsement application within 12 weeks of starting. Endorsement decisions usually take 5 to 8 weeks after that, followed by the Home Office visa application." },
  { q: "Do you help me find a job after the visa?", a: "Yes. Through Migrizo Talent we prepare your profile for UK hiring, match you with UK and European employers and make warm introductions. We cannot guarantee a job offer, but we work to get you interviews as soon as possible." },
  { q: "Can my partner and children come with me?", a: "Yes. Your partner and children can apply as your dependants, and your partner can work in the UK. We prepare their applications alongside yours." },
  { q: "Can I change jobs once I am in the UK?", a: "Yes. The visa is not tied to an employer, so you can change jobs, freelance or start a company without applying again." },
];

/* ==========================================================================
   Score calculator
   ========================================================================== */
type Contact = { name: string; email: string; whatsapp: string; linkedin: string; consent: boolean };
type ContactErrors = Partial<Record<keyof Contact, string>>;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
function validateContact(c: Contact): ContactErrors {
  const e: ContactErrors = {};
  if (c.name.trim().length < 2) e.name = "Please enter your full name.";
  if (!EMAIL_RE.test(c.email.trim())) e.email = "Please enter a valid email.";
  if (!/^\+\d{8,15}$/.test(c.whatsapp.replace(/[\s\-().]/g, ""))) e.whatsapp = "Include your country code, e.g. +91.";
  const li = c.linkedin.trim();
  if (li && !/^(https?:\/\/)?(www\.|[a-z]{2}\.)?linkedin\.com\//i.test(li)) e.linkedin = "Paste a linkedin.com link or leave blank.";
  if (!c.consent) e.consent = "Please tick this so we can send your result.";
  return e;
}
const TOTAL_STEPS = QUESTIONS.length + 1;
type CalcHandle = { prefillField: (fieldId: string) => void };

function ScoreCalculator({ handleRef, reduced }: { handleRef: React.MutableRefObject<CalcHandle | null>; reduced: boolean }) {
  const [step, setStep] = useState(0); // 0..4 questions, 5 contact, 6 result
  const [answers, setAnswers] = useState<Answers>({});
  const [prefilledFrom, setPrefilledFrom] = useState<string | null>(null);
  const [contact, setContact] = useState<Contact>({ name: "", email: "", whatsapp: CONFIG.defaultDialCode, linkedin: "", consent: false });
  const [touched, setTouched] = useState<Partial<Record<keyof Contact, boolean>>>({});
  const [serverErrors, setServerErrors] = useState<ContactErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ score: number; band: Band } | null>(null);
  const [honeypot, setHoneypot] = useState("");
  const started = useRef(false);
  const advancing = useRef(false);
  const interacted = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const markStarted = useCallback((method: string) => {
    if (started.current) return;
    started.current = true;
    track("gtv_assessment_start", { method });
  }, []);

  useEffect(() => {
    if (interacted.current) headingRef.current?.focus({ preventScroll: true });
  }, [step]);

  useEffect(() => {
    handleRef.current = {
      prefillField: (fieldId) => {
        interacted.current = true;
        setAnswers((a) => ({ ...a, field: fieldId }));
        setPrefilledFrom(QUESTIONS[0].options.find((o) => o.id === fieldId)?.label ?? null);
        markStarted("profile_chip");
        setStep((s) => (s === 0 ? 1 : s));
      },
    };
  }, [handleRef, markStarted]);

  const q: Question | undefined = QUESTIONS[step];
  const clientScore = useMemo(() => calculateScore(answers), [answers]);

  function chooseSingle(qid: Question["id"], optId: string) {
    if (advancing.current) return;
    interacted.current = true;
    markStarted("question");
    setAnswers((a) => ({ ...a, [qid]: optId }));
    advancing.current = true;
    window.setTimeout(() => {
      setStep((s) => s + 1);
      advancing.current = false;
    }, reduced ? 60 : 280);
  }
  function toggleMulti(optId: string) {
    interacted.current = true;
    markStarted("question");
    setAnswers((a) => {
      const cur = Array.isArray(a.evidence) ? a.evidence : [];
      let next: string[];
      if (optId === "none") next = cur.includes("none") ? [] : ["none"];
      else {
        const rest = cur.filter((x) => x !== "none");
        next = rest.includes(optId) ? rest.filter((x) => x !== optId) : [...rest, optId];
      }
      return { ...a, evidence: next };
    });
  }

  const liveErrors = validateContact(contact);
  const shownError = (k: keyof Contact) => serverErrors[k] || (touched[k] ? liveErrors[k] : undefined);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched({ name: true, email: true, whatsapp: true, linkedin: true, consent: true });
    setServerErrors({});
    if (Object.keys(liveErrors).length) {
      document.getElementById(`gtv-${Object.keys(liveErrors)[0]}`)?.focus();
      return;
    }
    setSubmitting(true);
    let score = clientScore;
    try {
      const res = await fetch(CONFIG.leadEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers,
          clientScore,
          contact: { ...contact, whatsapp: contact.whatsapp.replace(/[\s\-().]/g, "") },
          tracking: readAttribution(),
          company_website: honeypot,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 422 && data.errors) {
        setServerErrors(data.errors);
        setSubmitting(false);
        return;
      }
      if (res.ok && typeof data.score === "number") score = data.score;
    } catch {
      /* network problem: still show the indicative score */
    }
    const band = scoreBand(score);
    // lead_id: use as the conversion's transaction ID in Google Ads so a lead is never counted twice.
    // user_data: for Google Ads enhanced conversions (the Google tag hashes it before sending).
    const lead = {
      score,
      band,
      lead_id: newLeadId(),
      user_data: { email: contact.email.trim().toLowerCase(), phone_number: e164(contact.whatsapp) },
    };
    track("gtv_assessment_complete", lead);
    if (score >= CONFIG.scoreThreshold) track("gtv_qualified_lead", lead);
    setResult({ score, band });
    setSubmitting(false);
    interacted.current = true;
    setStep(TOTAL_STEPS);
  }
  function retake() {
    interacted.current = true;
    setAnswers({});
    setResult(null);
    setPrefilledFrom(null);
    setStep(0);
  }

  const progress = Math.min(step, TOTAL_STEPS) / TOTAL_STEPS;
  const stepLabel = step < QUESTIONS.length ? `Question ${step + 1} of ${QUESTIONS.length}` : step === QUESTIONS.length ? "Last step" : "Your result";

  const input = (key: "name" | "email" | "whatsapp" | "linkedin", label: ReactNode, props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <div className="field">
      <label htmlFor={`gtv-${key}`}>{label}</label>
      <input
        id={`gtv-${key}`}
        className="input"
        value={contact[key]}
        onChange={(e) => setContact({ ...contact, [key]: e.target.value })}
        onBlur={() => setTouched((t) => ({ ...t, [key]: true }))}
        aria-invalid={!!shownError(key)}
        aria-describedby={shownError(key) ? `gtv-${key}-err` : undefined}
        {...props}
      />
      {shownError(key) && <FieldError id={`gtv-${key}-err`}>{shownError(key)}</FieldError>}
    </div>
  );

  return (
    <div className="calc" aria-live="polite">
      <div className="calc-top">
        <div className="calc-meta">
          <span className="calc-title">Your Global Talent score</span>
          <span className="calc-step">{stepLabel}</span>
        </div>
        <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} aria-label="Assessment progress">
          <div className="progress-bar" style={{ transform: `scaleX(${Math.max(progress, 0.04)})` }} />
        </div>
      </div>

      <div className="calc-body">
        {q && (
          <div className="step-panel" key={`q-${step}`}>
            {step === 1 && prefilledFrom && (
              <p className="note prefill-note">
                <Check size={14} aria-hidden="true" /> Field set to {prefilledFrom}
                <button type="button" onClick={() => setStep(0)}>
                  Change
                </button>
              </p>
            )}
            <h3 className="q-title" tabIndex={-1} ref={headingRef}>
              {q.title}
            </h3>
            {q.helper && <p className="q-helper">{q.helper}</p>}
            <div className={`options${q.multi ? " options--multi" : ""}`} role={q.multi ? "group" : "radiogroup"} aria-label={q.title}>
              {q.options.map((o, i) => {
                const sel = q.multi ? Array.isArray(answers.evidence) && answers.evidence.includes(o.id) : answers[q.id] === o.id;
                const inner = (
                  <>
                    <span className="opt-text">
                      <span className="opt-label">{o.label}</span>
                      {o.hint && <span className="opt-hint">{o.hint}</span>}
                    </span>
                    <span className="opt-mark">
                      <Check size={12} strokeWidth={3} aria-hidden="true" />
                    </span>
                  </>
                );
                const style = { ["--i" as string]: i } as React.CSSProperties;
                return q.multi ? (
                  <button key={o.id} type="button" className="opt" style={style} aria-pressed={sel} onClick={() => toggleMulti(o.id)}>
                    {inner}
                  </button>
                ) : (
                  <button key={o.id} type="button" className="opt" style={style} role="radio" aria-checked={sel} onClick={() => chooseSingle(q.id, o.id)}>
                    {inner}
                  </button>
                );
              })}
            </div>
            {(step > 0 || q.multi || answers[q.id]) && (
            <div className="calc-nav">
              {step > 0 ? (
                <button type="button" className="back-btn" onClick={() => setStep((s) => s - 1)}>
                  <ArrowLeft size={16} aria-hidden="true" /> Back
                </button>
              ) : (
                <span />
              )}
              {q.multi ? (
                <button type="button" className="btn btn--navy btn--sm" disabled={!Array.isArray(answers.evidence) || answers.evidence.length === 0} onClick={() => setStep((s) => s + 1)}>
                  Continue <ArrowRight className="arrow" size={16} aria-hidden="true" />
                </button>
              ) : (
                answers[q.id] && (
                  <button type="button" className="back-btn" onClick={() => setStep((s) => s + 1)}>
                    Next <ArrowRight size={16} aria-hidden="true" />
                  </button>
                )
              )}
            </div>
            )}
          </div>
        )}

        {step === QUESTIONS.length && (
          <div className="step-panel" key="contact">
            <h3 className="q-title" tabIndex={-1} ref={headingRef}>
              Where should we send your score?
            </h3>
            <p className="q-helper">Your score shows on the next screen. We also send a copy with next steps.</p>
            <form className="form" noValidate onSubmit={submit}>
              <div className="form-row">
                {input("name", "Full name", { autoComplete: "name" })}
                {input("email", "Email", { type: "email", inputMode: "email", autoComplete: "email" })}
              </div>
              <div className="form-row">
                {input("whatsapp", "WhatsApp with country code", { type: "tel", inputMode: "tel", autoComplete: "tel" })}
                {input(
                  "linkedin",
                  <>
                    LinkedIn <span className="opt-tag">(optional)</span>
                  </>,
                  { type: "url", inputMode: "url", placeholder: "linkedin.com/in/you" },
                )}
              </div>
              <input className="hp" tabIndex={-1} autoComplete="off" aria-hidden="true" name="company_website" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
              <div>
                <label className="consent">
                  <input
                    id="gtv-consent"
                    type="checkbox"
                    checked={contact.consent}
                    onChange={(e) => {
                      setContact({ ...contact, consent: e.target.checked });
                      setTouched((t) => ({ ...t, consent: true }));
                    }}
                    aria-invalid={!!shownError("consent")}
                    aria-describedby={shownError("consent") ? "gtv-consent-err" : undefined}
                  />
                  <span>
                    Migrizo can contact me by email and WhatsApp about my application. No spam, unsubscribe any time.{" "}
                    <a href={CONFIG.privacyUrl} target="_blank" rel="noopener">
                      Privacy policy
                    </a>
                  </span>
                </label>
                {shownError("consent") && <FieldError id="gtv-consent-err">{shownError("consent")}</FieldError>}
              </div>
              <div className="form-foot">
                <button type="button" className="back-btn" onClick={() => setStep((s) => s - 1)}>
                  <ArrowLeft size={16} aria-hidden="true" /> Back
                </button>
                <button type="submit" className="btn btn--gold" disabled={submitting}>
                  {submitting ? (
                    <>
                      <span className="spinner" aria-hidden="true" /> Calculating
                    </>
                  ) : (
                    <>
                      Show my score <ArrowRight className="arrow" size={18} aria-hidden="true" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {step === TOTAL_STEPS && result && (
          <div className="step-panel" key="result">
            <h3 className="sr-only" tabIndex={-1} ref={headingRef}>
              Your result
            </h3>
            <ScoreResult score={result.score} band={result.band} answers={answers} reduced={reduced} name={contact.name} onRetake={retake} />
          </div>
        )}
      </div>

      <div className="calc-foot">
        <Lock size={13} aria-hidden="true" /> Private and free. No documents needed.
      </div>
    </div>
  );
}

function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p className="err" id={id} role="alert">
      <CircleAlert size={13} aria-hidden="true" /> {children}
    </p>
  );
}

const BAND_COPY: Record<Band, { label: string; title: string; body: string }> = {
  strong: { label: "Strong profile", title: "your profile looks strong", body: "You already show several signals endorsing bodies look for. Let us check your evidence and plan the strongest route." },
  promising: { label: "Promising profile", title: "your profile looks promising", body: "A solid base. A few targeted additions could make a real difference. A strategy call shows you which." },
  building: { label: "Building profile", title: "you are building your profile", body: "Your readiness guide is on its way by email and WhatsApp. It shows which evidence to build first." },
};

function ScoreResult({ score, band, answers, reduced, name, onRetake }: { score: number; band: Band; answers: Answers; reduced: boolean; name: string; onRetake: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setArmed(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const shown = useCountUp(armed ? score : 0, 1500, !reduced);
  const R = 50;
  const C = 2 * Math.PI * R;
  const copy = BAND_COPY[band];
  const qualified = score >= CONFIG.scoreThreshold;
  const firstName = name.trim().split(/\s+/)[0] || "";
  const title = firstName ? `${firstName}, ${copy.title}` : copy.title.charAt(0).toUpperCase() + copy.title.slice(1);
  const bookingHref = (() => {
    try {
      const u = new URL(CONFIG.bookingUrl);
      u.searchParams.set("utm_source", "gtv_assessment");
      u.searchParams.set("utm_content", `score_${score}`);
      return u.toString();
    } catch {
      return CONFIG.bookingUrl;
    }
  })();

  return (
    <div className={`result result--${band}`}>
      <div className="result-top">
        <div className="ring-wrap">
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <circle className="ring-track" cx="60" cy="60" r={R} fill="none" strokeWidth="10" />
            <circle className="ring-fill" cx="60" cy="60" r={R} fill="none" strokeWidth="10" strokeDasharray={C} strokeDashoffset={C * (1 - (armed ? score : 0) / 100)} />
          </svg>
          <div className="ring-num">
            <strong aria-label={`${score} out of 100`}>{shown}</strong>
            <span>out of 100</span>
          </div>
        </div>
        <div>
          <span className="band">{copy.label}</span>
          <h3>{title}</h3>
          <p className="result-copy">{copy.body}</p>
        </div>
      </div>
      <ul className="breakdown" aria-label="Score breakdown">
        {scoreBreakdown(answers).map((b, i) => (
          <li className="bd-row" key={b.id}>
            <span>{b.label}</span>
            <span className="bd-bar">
              <i style={{ ["--i" as string]: i, transform: `scaleX(${armed && b.max ? b.points / b.max : 0})` }} />
            </span>
            <b>
              {b.points}/{b.max}
            </b>
          </li>
        ))}
      </ul>
      <div className="result-actions">
        {qualified ? (
          <>
            <a className="btn btn--gold btn--block" href={bookingHref} target="_blank" rel="noopener" onClick={() => track("gtv_call_booking_click", { score, location: "result" })}>
              <CalendarCheck size={18} aria-hidden="true" /> Book your free strategy call
            </a>
            <a className="btn btn--outline btn--block" href={waLink(`Hi Migrizo, I scored ${score}/100 on the Global Talent assessment and would like to talk.`)} target="_blank" rel="noopener" onClick={() => track("gtv_whatsapp_click", { location: "result", score })}>
              <WhatsAppIcon /> WhatsApp us
            </a>
          </>
        ) : (
          <>
            <p className="note" style={{ justifyContent: "center" }}>
              <Mail size={14} aria-hidden="true" /> Check your inbox and WhatsApp for the guide.
            </p>
            <button type="button" className="btn btn--outline btn--block" onClick={onRetake}>
              <RotateCcw size={16} aria-hidden="true" /> Retake the assessment
            </button>
          </>
        )}
      </div>
      <p className="disclaimer-sm">Indicative only, not a legal assessment.</p>
    </div>
  );
}

/* ==========================================================================
   Cost calculator (prices appear only in the Fees section)
   ========================================================================== */
const FEES = { migrizo: 3000, endorsement: 561, visa: 205, partnerVisa: 766, ihsPerYear: 1035, pr: 500 };

function CostCalculator({ reduced }: { reduced: boolean }) {
  const [years, setYears] = useState<3 | 5>(5);
  const [partner, setPartner] = useState(false);
  const [pr, setPr] = useState(false);
  const people = partner ? 2 : 1;
  const lines = [
    { id: "m", label: "Migrizo fee", sub: "Fixed, in 4 stages", amount: FEES.migrizo },
    { id: "e", label: "Endorsement fee", sub: "Home Office", amount: FEES.endorsement },
    { id: "v", label: "Visa fee, you", sub: "Home Office", amount: FEES.visa },
    ...(partner ? [{ id: "p", label: "Visa fee, partner", sub: "Home Office", amount: FEES.partnerVisa }] : []),
    { id: `h${years}${people}`, label: "Health surcharge", sub: `${gbp(FEES.ihsPerYear)} × ${years} yrs × ${people}`, amount: FEES.ihsPerYear * years * people },
    ...(pr ? [{ id: "r", label: "PR application support", sub: "Optional add-on", amount: FEES.pr }] : []),
  ];
  // The total always adds every visible line.
  const total = lines.reduce((s, l) => s + l.amount, 0);
  const shown = useCountUp(total, 700, !reduced);

  return (
    <div className="costcalc" data-reveal style={d(2)}>
      <div className="costcalc-head">
        <h3>Estimate your full cost</h3>
        <p>Our fee plus every government fee, in one number.</p>
      </div>
      <div className="controls">
        <div className="control">
          <span className="control-label" id="yrs-label">
            Visa length
          </span>
          <div className="seg" role="group" aria-labelledby="yrs-label">
            <span className="seg-thumb" style={{ transform: `translateX(${years === 3 ? 0 : 100}%)` }} aria-hidden="true" />
            <button type="button" aria-pressed={years === 3} onClick={() => setYears(3)}>
              3 years
            </button>
            <button type="button" aria-pressed={years === 5} onClick={() => setYears(5)}>
              5 years
            </button>
          </div>
        </div>
        <div className="control">
          <span className="control-label" id="partner-label">
            Bringing a partner
          </span>
          <button type="button" role="switch" aria-checked={partner} aria-labelledby="partner-label" className="switch" onClick={() => setPartner((v) => !v)}>
            <i />
          </button>
        </div>
        <div className="control">
          <span className="control-label" id="pr-label">
            PR support<small>optional</small>
          </span>
          <button type="button" role="switch" aria-checked={pr} aria-labelledby="pr-label" className="switch" onClick={() => setPr((v) => !v)}>
            <i />
          </button>
        </div>
      </div>
      <ul className="lines">
        {lines.map((l) => (
          <li className="line-item" key={l.id}>
            <span>
              {l.label}
              <small>{l.sub}</small>
            </span>
            <b>{gbp(l.amount)}</b>
          </li>
        ))}
      </ul>
      <div className="total" aria-live="polite">
        <span>Estimated total</span>
        <strong>{gbp(shown)}</strong>
      </div>
      <p className="cost-note">Government fees are set by the Home Office and can change. Children add their own fees.</p>
    </div>
  );
}

/* ==========================================================================
   Section components
   ========================================================================== */

/** Heading words rise in one by one. The accent phrase is set in gold italic. */
function RiseHeading({ pre, em, id, className }: { pre: string; em: string; id?: string; className?: string }) {
  const preWords = pre.split(" ");
  const emWords = em.split(" ");
  return (
    <h1 id={id} className={className}>
      {preWords.map((w, i) => (
        <span className="word-rise" style={{ ["--w" as string]: i } as React.CSSProperties} key={`p${i}`}>
          {w}&nbsp;
        </span>
      ))}
      <em>
        {emWords.map((w, i) => (
          <span className="word-rise" style={{ ["--w" as string]: preWords.length + i } as React.CSSProperties} key={`e${i}`}>
            {w}
            {i < emWords.length - 1 ? " " : ""}
          </span>
        ))}
      </em>
    </h1>
  );
}

/** The visa at a glance: four tiles, each with a small visual of the number. */
function Glance({ reduced }: { reduced: boolean }) {
  const ref = useRef<HTMLUListElement>(null);
  const inView = useInView(ref, 0.1);
  const [run, setRun] = useState(false);
  useEffect(() => {
    if (inView || reduced) setRun(true);
  }, [inView, reduced]);
  const grant = useCountUp(run ? 5 : 0, 1300, !reduced);
  const settle = useCountUp(run ? 3 : 0, 1300, !reduced);
  const v = (n: number) => ({ ["--n" as string]: n }) as React.CSSProperties;
  return (
    <ul className="gtiles" ref={ref} data-run={run}>
      <li className="gtile" data-reveal style={d(0)}>
        <div className="gtile-head">
          <span className="gtile-icon" aria-hidden="true">
            <CalendarClock size={19} />
          </span>
          <h3>Longest single grant</h3>
        </div>
        <p className="gtile-num">
          {grant}
          <small>years</small>
        </p>
        <p className="gtile-sub">Choose anything from 1 to 5 years, then extend.</p>
        <div className="gviz gviz-years" aria-hidden="true">
          {[1, 2, 3, 4, 5].map((n) => (
            <i key={n} style={v(n)}>
              <b>Yr {n}</b>
            </i>
          ))}
        </div>
      </li>
      <li className="gtile" data-reveal style={d(1)}>
        <div className="gtile-head">
          <span className="gtile-icon" aria-hidden="true">
            <House size={19} />
          </span>
          <h3>Fastest route to settlement</h3>
        </div>
        <p className="gtile-num">
          {settle}
          <small>years</small>
        </p>
        <p className="gtile-sub">On exceptional talent. Exceptional promise settles in 5.</p>
        <div className="gviz gviz-settle" aria-hidden="true">
          {[1, 2, 3, 4, 5].map((n) => (
            <i key={n} style={v(n)} data-on={n <= 3 ? "true" : undefined} />
          ))}
          <span className="gviz-flag">Settle</span>
        </div>
      </li>
      <li className="gtile" data-reveal style={d(2)}>
        <div className="gtile-head">
          <span className="gtile-icon" aria-hidden="true">
            <Timer size={19} />
          </span>
          <h3>Typical endorsement decision</h3>
        </div>
        <p className="gtile-num">
          5 to 8<small>weeks</small>
        </p>
        <p className="gtile-sub">Counted from the day your application is submitted.</p>
        <div className="gviz gviz-weeks" aria-hidden="true">
          {Array.from({ length: 10 }, (_, k) => (
            <i key={k} style={v(k + 1)} data-on={k >= 4 && k <= 7 ? "true" : undefined} />
          ))}
        </div>
      </li>
      <li className="gtile gtile--zero" data-reveal style={d(3)}>
        <div className="gtile-head">
          <span className="gtile-icon" aria-hidden="true">
            <BriefcaseBusiness size={19} />
          </span>
          <h3>Needed from an employer</h3>
        </div>
        <p className="gtile-num">
          0<small>requirements</small>
        </p>
        <p className="gtile-sub">Your evidence carries the application, not a job.</p>
        <ul className="gviz gviz-zero">
          {["Job offer", "Sponsor", "Minimum salary"].map((t) => (
            <li key={t}>
              <X size={13} strokeWidth={3} aria-hidden="true" />
              {t}
            </li>
          ))}
        </ul>
      </li>
    </ul>
  );
}

const FIELDS = [
  { title: "Digital technology", img: "tech", alt: "Engineers working together at a screen", roles: [["Software or AI engineer", "digital"], ["Product or tech founder", "digital"]] },
  { title: "Research and academia", img: "research", alt: "A scientist working at a microscope", roles: [["Researcher or academic", "research"], ["Doctor or scientist", "research"]] },
  { title: "Arts and culture", img: "arts", alt: "Paint brushes covered in colour", roles: [["Artist or performer", "arts"], ["Writer or filmmaker", "arts"]] },
  { title: "Design and architecture", img: "design", alt: "Colour swatches on a designer's desk", roles: [["Designer", "design"], ["Architect", "design"]] },
] as const;

const REASON_MS = 6000;
/** Refusals: pick a mistake on the left, see the refused and the stronger version on the right. Moves on by itself. */
function Reasons({ reduced }: { reduced: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, 0.15);
  const [active, setActive] = useState(0);
  const [hover, setHover] = useState(false);
  const r = REASONS[active];
  const Icon = r.Icon;
  return (
    <div className="rx" ref={ref} data-paused={hover || !inView} data-static={reduced} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <div className="rx-list" role="tablist" aria-label="Common refusal reasons" data-reveal="left">
        {REASONS.map((x, i) => (
          <button
            type="button"
            role="tab"
            key={x.title}
            id={`rx-tab-${i}`}
            aria-selected={i === active}
            aria-controls="rx-panel"
            className="rx-tab"
            onClick={() => setActive(i)}
          >
            <span className="rx-n">0{i + 1}</span>
            <span className="rx-t">{x.title}</span>
            <i className="rx-bar" aria-hidden="true" style={{ ["--dur" as string]: `${REASON_MS}ms` }} onAnimationEnd={() => i === active && setActive((a) => (a + 1) % REASONS.length)} />
          </button>
        ))}
      </div>
      <div className="rx-panel" id="rx-panel" role="tabpanel" aria-labelledby={`rx-tab-${active}`} data-reveal="right">
        <div className="rx-inner" key={active}>
          <div className="rx-head">
            <span className="rx-icon" aria-hidden="true">
              <Icon size={22} />
            </span>
            <div>
              <span className="rx-count">
                Mistake {active + 1} of {REASONS.length}
              </span>
              <h3>{r.title}</h3>
            </div>
          </div>
          <p className="rx-body">{r.body}</p>
          <div className="rx-compare">
            <div className="rx-bad">
              <span className="rx-label">
                <X size={14} strokeWidth={3} aria-hidden="true" /> What gets refused
              </span>
              <p>&ldquo;{r.bad}&rdquo;</p>
            </div>
            <div className="rx-good">
              <span className="rx-label">
                <Check size={14} strokeWidth={3} aria-hidden="true" /> What we build instead
              </span>
              <p>&ldquo;{r.good}&rdquo;</p>
            </div>
          </div>
          <p className="rx-fix">
            <ShieldCheck size={18} aria-hidden="true" />
            <span>
              <strong>How we prevent it:</strong> {r.fix}
            </span>
          </p>
        </div>
        <p className="rx-note">Examples are illustrative, not real clients.</p>
      </div>
    </div>
  );
}

/** Myths: flip cards. The myth is on the front, the truth on the back. Cards turn over one by one on their own. */
function Myths({ reduced }: { reduced: boolean }) {
  const ref = useRef<HTMLOListElement>(null);
  const inView = useInView(ref, 0.15);
  const [active, setActive] = useState(-1);
  const [hover, setHover] = useState(false);
  const [pinned, setPinned] = useState<number[]>([]);
  useEffect(() => {
    if (reduced || !inView || hover) return;
    const id = window.setInterval(() => setActive((a) => (a + 1) % MYTHS.length), 2600);
    return () => window.clearInterval(id);
  }, [reduced, inView, hover]);
  const toggle = (i: number) => setPinned((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]));
  return (
    <ol className="flip-grid" ref={ref} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      {MYTHS.map((m, i) => {
        const flipped = i === active || pinned.includes(i);
        return (
          <li className="flip" key={m.myth} data-flipped={flipped} data-reveal style={d(i % 3)} onMouseEnter={() => !reduced && setActive(i)}>
            <button type="button" className="flip-inner" aria-pressed={flipped} onClick={() => toggle(i)}>
              <span className="flip-face flip-front" aria-hidden={flipped}>
                <span className="flip-num">Myth 0{i + 1}</span>
                <span className="flip-quote" aria-hidden="true">
                  &ldquo;
                </span>
                <span className="flip-myth">{m.myth}</span>
                <span className="flip-hint">
                  <RotateCcw size={14} aria-hidden="true" /> Tap to see the truth
                </span>
              </span>
              <span className="flip-face flip-back" aria-hidden={!flipped}>
                <span className="flip-verdict">
                  <Check size={14} strokeWidth={3} aria-hidden="true" /> Not true
                </span>
                <span className="flip-was">{m.myth}</span>
                <span className="flip-truth">{m.truth}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

const PHASE_MS = 5000;
/** How it works: a 12 week timeline with four connected stages. The highlight moves along on its own. */
function Process({ reduced }: { reduced: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, 0.15);
  const [active, setActive] = useState(0);
  const [hover, setHover] = useState(false);
  return (
    <div className="tl" ref={ref} data-paused={hover || !inView} data-static={reduced} data-on={inView || reduced} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <div className="tl-track" aria-hidden="true">
        <i className="tl-fill" style={{ ["--p" as string]: reduced ? 1 : (active + 1) / PHASES.length }} />
        <span className="tl-end">
          <FileCheck size={14} /> Submitted by week 12
        </span>
      </div>
      <ol className="tl-steps">
        {PHASES.map((p, i) => {
          const Icon = p.Icon;
          const state = reduced ? "" : i === active ? "active" : i < active ? "done" : "";
          return (
            <li className="tl-step" key={p.title} data-state={state} data-reveal style={d(i)} onMouseEnter={() => !reduced && setActive(i)}>
              <div className="tl-node">
                <span className="tl-dot" aria-hidden="true">
                  <Icon size={20} />
                </span>
                <span className="tl-weeks">{p.weeks}</span>
              </div>
              <div className="tl-card">
                <span className="tl-num">Stage 0{i + 1}</span>
                <h3>{p.title}</h3>
                <p className="tl-sum">{p.summary}</p>
                <p className="tl-get">
                  <Check size={15} strokeWidth={2.5} aria-hidden="true" />
                  <span>{p.get}</span>
                </p>
                <span className="tl-bar" aria-hidden="true" style={{ ["--dur" as string]: `${PHASE_MS}ms` }} onAnimationEnd={() => i === active && setActive((a) => (a + 1) % PHASES.length)} />
              </div>
            </li>
          );
        })}
      </ol>
      <div className="tl-after" data-reveal>
        <span className="tl-after-label">Then</span>
        <ol>
          {AFTER_SUBMIT.map(({ Icon, title, sub }, i) => (
            <li key={title}>
              <span className="tl-after-icon" aria-hidden="true">
                <Icon size={18} />
              </span>
              <span>
                <strong>{title}</strong>
                <span>{sub}</span>
              </span>
              {i < AFTER_SUBMIT.length - 1 && <ChevronRight className="tl-after-arrow" size={18} aria-hidden="true" />}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

/** Hand-drawn style marks that drift in the hero. Decorative only. */
function HeroDoodles() {
  return (
    <div className="doodles" aria-hidden="true">
      <svg className="doodle doodle-plane" viewBox="0 0 220 120" fill="none">
        <path className="trail" d="M6 104C40 60 78 112 110 78S150 22 196 30" stroke="currentColor" strokeWidth="1.6" strokeDasharray="5 7" strokeLinecap="round" />
        <g className="plane">
          <path d="M0 0l26-10-9 24-5-9-12-5Z" fill="currentColor" />
          <path d="M12 5l14-15" stroke="#fff" strokeWidth="1.2" />
        </g>
      </svg>
      <svg className="doodle doodle-swirl" viewBox="0 0 120 80" fill="none">
        <path d="M6 60c18 14 44 10 52-8 6-14-8-24-18-16-12 10 0 34 26 30 20-3 34-18 44-44" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" pathLength="1" />
        <path d="M96 20l14-4 2 15" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" pathLength="1" />
      </svg>
      <span className="doodle doodle-dots" />
      <span className="doodle doodle-ring" />
    </div>
  );
}

function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="faq" data-reveal style={d(1)}>
      {FAQS.map((f, i) => {
        const isOpen = open === i;
        return (
          <div className="faq-item" data-open={isOpen} key={f.q}>
            <button type="button" className="faq-q" aria-expanded={isOpen} aria-controls={`faq-a-${i}`} id={`faq-q-${i}`} onClick={() => setOpen(isOpen ? null : i)}>
              {f.q}
              <span className="faq-icon" aria-hidden="true" />
            </button>
            <div className="faq-a" id={`faq-a-${i}`} role="region" aria-labelledby={`faq-q-${i}`}>
              <div>
                <p>{f.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ==========================================================================
   Page
   ========================================================================== */
/**
 * Cookie choice for UK and European visitors (consent mode v2 keeps ad cookies off for them until
 * they accept). Shown only when GTM is on, no choice is stored yet and the visitor's time zone is
 * in Europe. Everyone else already has measurement on by default, see app/layout.tsx.
 */
function CookieBanner() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!GTM_ON) return;
    try {
      if (localStorage.getItem(CONSENT_KEY)) return;
    } catch {
      /* storage blocked: still ask */
    }
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    if (/^Europe\//.test(tz) || tz === "Atlantic/Reykjavik" || tz === "Atlantic/Canary" || tz === "Atlantic/Madeira" || tz === "Atlantic/Azores") setOpen(true);
  }, []);
  if (!open) return null;
  const choose = (granted: boolean) => {
    setConsent(granted);
    setOpen(false);
  };
  return (
    <div className="cookie" role="dialog" aria-label="Cookie choice" aria-live="polite">
      <p>
        We use cookies to measure our ads and improve this page.{" "}
        <a href={CONFIG.privacyUrl} target="_blank" rel="noopener">
          Privacy policy
        </a>
      </p>
      <div className="cookie-btns">
        <button type="button" className="btn btn--outline btn--sm" onClick={() => choose(false)}>
          Reject
        </button>
        <button type="button" className="btn btn--navy btn--sm" onClick={() => choose(true)}>
          Accept
        </button>
      </div>
    </div>
  );
}

export default function GtvLanding({ seg }: { seg?: string }) {
  const reduced = useReducedMotion();
  useScrollReveal();
  const calcRef = useRef<CalcHandle | null>(null);
  const calcSlot = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const finalRef = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const [solid, setSolid] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [pill, setPill] = useState<{ x: number; w: number } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showBar, setShowBar] = useState(false);

  useEffect(() => {
    captureAttribution();
  }, []);

  // Header turns solid once the hero scrolls away.
  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > (heroRef.current?.offsetHeight ?? 600) - 90);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Scrollspy: highlight the section crossing the middle of the screen.
  useEffect(() => {
    const els = NAV.map((n) => document.getElementById(n.id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver((entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)), { rootMargin: "-45% 0px -50% 0px" });
    els.forEach((el) => io.observe(el));
    const clear = new IntersectionObserver((entries) => entries.forEach((e) => e.isIntersecting && setActive(null)), { rootMargin: "-45% 0px -50% 0px" });
    [heroRef.current, finalRef.current].forEach((el) => el && clear.observe(el));
    return () => {
      io.disconnect();
      clear.disconnect();
    };
  }, []);

  // Slide the highlight pill behind the active link.
  useLayoutEffect(() => {
    const measure = () => {
      const link = navRef.current?.querySelector<HTMLAnchorElement>(`a[data-id="${active}"]`);
      setPill(link ? { x: link.offsetLeft, w: link.offsetWidth } : null);
    };
    measure();
    window.addEventListener("resize", measure);
    document.fonts?.ready.then(measure);
    return () => window.removeEventListener("resize", measure);
  }, [active]);

  // Mobile sticky bar: hidden while the calculator or final call to action is on screen.
  useEffect(() => {
    const vis = new Map<Element, boolean>();
    const update = () => setShowBar(!Array.from(vis.values()).some(Boolean) && window.scrollY > 300);
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => vis.set(e.target, e.isIntersecting));
        update();
      },
      { threshold: 0.1 },
    );
    if (calcSlot.current) io.observe(calcSlot.current);
    if (finalRef.current) io.observe(finalRef.current);
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", update);
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const goTo = useCallback(
    (id: string) => (e?: React.MouseEvent) => {
      e?.preventDefault();
      setMenuOpen(false);
      const el = document.getElementById(id);
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY - (id === "score" ? 84 : 72);
      window.scrollTo({ top, behavior: reduced ? "auto" : "smooth" });
    },
    [reduced],
  );
  const scrollToCalc = goTo("score");
  const onWhatsApp = (location: string) => () => track("gtv_whatsapp_click", { location });
  const h1 = (seg && H1_VARIANTS[seg]) || H1_DEFAULT;

  const ctaScore = (location: string, cls = "btn btn--gold") => (
    <button
      type="button"
      className={cls}
      onClick={(e) => {
        track("gtv_cta_click", { location });
        scrollToCalc(e);
      }}
    >
      Check my score <ArrowRight className="arrow" size={18} aria-hidden="true" />
    </button>
  );
  const waBtn = (location: string, cls: string, label = "WhatsApp us") => (
    <a className={cls} href={waLink()} target="_blank" rel="noopener" onClick={onWhatsApp(location)}>
      <WhatsAppIcon /> {label}
    </a>
  );
  const role = (label: string, field: string) => (
    <button
      type="button"
      className="role"
      key={label}
      onClick={(e) => {
        track("gtv_profile_chip", { profile: label, field });
        calcRef.current?.prefillField(field);
        scrollToCalc(e);
      }}
    >
      {label}
      <ArrowRight size={15} aria-hidden="true" />
    </button>
  );

  return (
    <>
      {/* Header with section menu */}
      <header className="header" data-solid="true" data-scrolled={solid}>
        <div className="wrap">
          <a
            className="brand"
            href="#top"
            aria-label="Migrizo, back to top"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="logo-white" src={LOGO.white} width={LOGO.w} height={LOGO.h} alt="Migrizo" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="logo-navy" src={LOGO.navy} width={LOGO.w} height={LOGO.h} alt="" aria-hidden="true" />
          </a>
          <nav className="nav" ref={navRef} aria-label="Page sections">
            <span className="nav-pill" aria-hidden="true" style={{ transform: `translateX(${pill?.x ?? 0}px)`, width: pill?.w ?? 0, opacity: pill ? 1 : 0 }} />
            {NAV.map((n) => (
              <a key={n.id} href={`#${n.id}`} data-id={n.id} aria-current={active === n.id} onClick={goTo(n.id)}>
                {n.label}
              </a>
            ))}
          </nav>
          <div className="header-actions">
            {waBtn("header", "btn btn--sm btn--outline btn--wa only-desk", "WhatsApp")}
            <button
              type="button"
              className="btn btn--gold btn--sm"
              onClick={(e) => {
                track("gtv_cta_click", { location: "header" });
                scrollToCalc(e);
              }}
            >
              Check my score
            </button>
            <button type="button" className="icon-btn menu-btn" aria-label="Open menu" aria-expanded={menuOpen} aria-controls="sheet" onClick={() => setMenuOpen(true)}>
              <Menu size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile menu */}
      <div className="sheet" id="sheet" data-open={menuOpen} role="dialog" aria-modal="true" aria-label="Menu" {...(!menuOpen ? { inert: true } : {})}>
        <div className="sheet-top">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="sheet-logo" src={LOGO.white} width={LOGO.w} height={LOGO.h} alt="Migrizo" />
          <button type="button" className="icon-btn" aria-label="Close menu" onClick={() => setMenuOpen(false)}>
            <X size={20} />
          </button>
        </div>
        <nav aria-label="Page sections">
          {NAV.map((n, i) => (
            <a key={n.id} href={`#${n.id}`} style={{ ["--i" as string]: i } as React.CSSProperties} onClick={goTo(n.id)}>
              <small>{String(i + 1).padStart(2, "0")}</small>
              {n.label}
            </a>
          ))}
        </nav>
        <div className="sheet-actions">
          {ctaScore("menu", "btn btn--gold btn--block")}
          {waBtn("menu", "btn btn--outline-light btn--block")}
        </div>
      </div>

      <main id="top">
        {/* Hero with the score calculator */}
        <section className="hero" ref={heroRef} aria-labelledby="hero-title">
          <div className="hero-deco" aria-hidden="true" />
          <HeroDoodles />
          <div className="wrap hero-layout">
            <div>
              <p className="hero-badge fade-up">
                <UnionFlag /> UK Global Talent Visa specialists
              </p>
              <RiseHeading id="hero-title" className="display" pre={h1.pre} em={h1.em} />
              <p className="hero-sub fade-up" style={d(4)}>
                Answer five questions and get an indicative score in about 60 seconds. No job offer, sponsor or minimum salary is needed for this visa.
              </p>
              <ul className="hero-checks fade-up" style={d(5)}>
                {["Global Talent specialists", "Job support after your visa", "Free and private"].map((t) => (
                  <li key={t}>
                    <span className="hero-check" aria-hidden="true">
                      <Check size={13} strokeWidth={3} />
                    </span>
                    {t}
                  </li>
                ))}
              </ul>
              <div className="cta-row hero-ctas fade-up" style={d(6)}>
                {ctaScore("hero")}
                {waBtn("hero", "btn btn--outline")}
              </div>
            </div>
            <div className="hero-card fade-up" id="score" ref={calcSlot} style={d(3)}>
              <ScoreCalculator handleRef={calcRef} reduced={reduced} />
            </div>
          </div>
        </section>

        {/* Endorsing bodies: names only, sliding */}
        <section className="ebar" aria-label="Endorsing bodies and partner organisations we prepare applications for">
          <div className="ebar-marquee">
            <div className="ebar-track">
              {[0, 1].map((g) => (
                <ul className="ebar-group" key={g} aria-hidden={g === 1 ? "true" : undefined}>
                  {ENDORSERS.map(({ name, Icon }) => (
                    <li className="ebar-item" key={name}>
                      <span className="ebar-icon" aria-hidden="true">
                        <Icon size={18} />
                      </span>
                      {name}
                    </li>
                  ))}
                </ul>
              ))}
            </div>
          </div>
        </section>

        {/* Who it's for */}
        <section className="section bg-tint" id="who" aria-labelledby="who-title">
          <div className="wrap">
            <div className="sec-head">
              <p className="kicker" data-reveal>
                Who it&apos;s for
              </p>
              <h2 className="h2" id="who-title" data-reveal style={d(1)}>
                Built For People Whose Work Already Travels
              </h2>
              <p className="lead" data-reveal style={d(2)}>
                Pick the line closest to you and we start your score from there.
              </p>
            </div>
            <div className="fcards">
              {FIELDS.map((f, i) => (
                <article className="fcard" key={f.title} data-reveal style={d(i)}>
                  <div className="fcard-img">
                    <Image src={PHOTOS[f.img]} alt={f.alt} fill sizes="(min-width: 1024px) 23vw, (min-width: 640px) 46vw, 92vw" />
                  </div>
                  <div className="fcard-body">
                    <h3>{f.title}</h3>
                    <div className="roles">{f.roles.map(([label, field]) => role(label, field))}</div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Why us */}
        <section className="section bg-white" id="why-us" aria-labelledby="why-title">
          <div className="wrap">
            <div className="sec-head">
              <div>
                <p className="kicker" data-reveal>
                  Why Migrizo
                </p>
                <h2 className="h2" id="why-title" data-reveal style={d(1)}>
                  Judged On Evidence, <em>Not Paperwork</em>
                </h2>
              </div>
              <p className="lead" data-reveal style={d(2)}>
                Global Talent is decided by how well your evidence answers the criteria. That needs someone who does this every day.
              </p>
            </div>
            <div className="compare-wrap" data-reveal style={d(2)}>
              <table className="compare">
                <thead>
                  <tr>
                    <th scope="col">
                      <span className="sr-only">Compare</span>
                    </th>
                    <th scope="col" className="us">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={LOGO.navy} width={LOGO.w} height={LOGO.h} alt="Migrizo" />
                    </th>
                    <th scope="col">{COMPARE_COLS[1]}</th>
                    <th scope="col">{COMPARE_COLS[2]}</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARE_ROWS.map((r) => (
                    <tr key={r.label}>
                      <th scope="row">{r.label}</th>
                      {r.cells.map((c, ci) => (
                        <td className={ci === 0 ? "us" : undefined} key={ci}>
                          <span className="cell" data-col={COMPARE_COLS[ci]}>
                            {ci === 0 ? <Check size={16} strokeWidth={2.5} aria-hidden="true" /> : <Minus size={16} aria-hidden="true" />}
                            <span>{c}</span>
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="section bg-tint process" id="process" aria-labelledby="process-title">
          <div className="wrap">
            <div className="sec-head">
              <p className="kicker" data-reveal>
                How it works
              </p>
              <h2 className="h2" id="process-title" data-reveal style={d(1)}>
                Four Stages. <em>Submitted Within 12 Weeks.</em>
              </h2>
              <p className="lead" data-reveal style={d(2)}>
                One specialist runs your case from the first call to submission, and stays with you after.
              </p>
            </div>
            <Process reduced={reduced} />
          </div>
        </section>

        {/* Trust and proof: client testimonials */}
        <section className="section bg-white trust" id="trust" aria-labelledby="trust-title">
          <div className="wrap">
            <div className="sec-head">
              <p className="kicker" data-reveal>
                Trust &amp; Proof
              </p>
              <h2 className="h2" id="trust-title" data-reveal style={d(1)}>
                What Our <em>Clients Say</em>
              </h2>
              <p className="lead" data-reveal style={d(2)}>
                Professionals who planned their Global Talent case with us, in their own words.
              </p>
            </div>
            <ul className="twall">
              {TESTIMONIALS.map((t, i) => (
                <li className={i === 0 ? "tq tq--lead" : "tq"} key={t.name} data-reveal style={d(i)}>
                  <span className="tq-mark" aria-hidden="true">
                    &ldquo;
                  </span>
                  <blockquote className="tq-quote">{t.quote}</blockquote>
                  <div className="tq-person">
                    <span className="tq-avatar" aria-hidden="true">
                      {t.initials}
                    </span>
                    <span>
                      <strong>{t.name}</strong>
                      <span>Global Talent Visa client</span>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* What we help with */}
        <section className="section bg-tint help" id="help" aria-labelledby="help-title">
          <div className="wrap">
            <div className="sec-head">
              <p className="kicker" data-reveal>
                What We Help With
              </p>
              <h2 className="h2" id="help-title" data-reveal style={d(1)}>
                Everything Your Case Needs, <em>From Roadmap To Job</em>
              </h2>
            </div>
            <ul className="help-grid">
              {SERVICES.map(({ Icon, title, body }, i) => (
                <li className="help-item" key={title} data-reveal style={d(i % 3)}>
                  <span className="help-icon" aria-hidden="true">
                    <Icon size={20} />
                  </span>
                  <span>
                    <h3>{title}</h3>
                    <p>{body}</p>
                  </span>
                </li>
              ))}
            </ul>
            <div className="help-feature" data-reveal>
              <div className="help-feature-copy">
                <span className="jobs-tag">
                  <BriefcaseBusiness size={15} aria-hidden="true" /> Only at Migrizo
                </span>
                <h3>Job Support After Your Visa</h3>
                <p>Most consultants stop at the visa. Through Migrizo Talent, we connect you with UK and European employers and help you get hired as soon as possible.</p>
                <p className="help-feature-note">We cannot guarantee a job offer. Introductions depend on your profile and what employers are hiring for.</p>
              </div>
              <ol className="help-feature-steps">
                {JOB_STEPS.map(({ Icon, title }, i) => (
                  <li key={title}>
                    <span className="help-feature-icon" aria-hidden="true">
                      <Icon size={18} />
                    </span>
                    <span className="help-feature-n">0{i + 1}</span>
                    <strong>{title}</strong>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* Fees: the only place prices appear */}
        <section className="section bg-white" id="fees" aria-labelledby="fees-title">
          <div className="wrap fees">
            <div>
              <p className="kicker" data-reveal>
                Fees
              </p>
              <h2 className="h2" id="fees-title" data-reveal style={d(1)}>
                One Fixed Fee, <em>Paid In Four Instalments</em>
              </h2>
              <p className="lead" data-reveal style={d(2)}>
                You pay as each stage starts, never everything up front. Government fees are separate and passed on at cost.
              </p>
              <div className="fee-card" data-reveal style={d(3)}>
                <div className="glow" aria-hidden="true" />
                <div className="fee-top">
                  <p className="fee-amount">
                    {gbp(FEES.migrizo)}
                    <small>Migrizo fee, fixed once you sign. No hourly billing.</small>
                  </p>
                  <span className="pill">
                    <ShieldCheck size={14} aria-hidden="true" /> Four instalments
                  </span>
                </div>
                <ol className="fee-rows">
                  {FEE_STAGES.map((s, i) => (
                    <li key={s.title}>
                      <span className="fee-row-n">Instalment 0{i + 1}</span>
                      <span className="fee-row-text">
                        <strong>{s.title}</strong>
                        <span>{s.body}</span>
                      </span>
                      <span className="fee-row-amt">{gbp(s.amount)}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
            <div className="fees-side">
              <CostCalculator reduced={reduced} />
            </div>
          </div>
        </section>

        {/* Founder */}
        <section className="section bg-tint" id="founder" aria-labelledby="founder-title">
          <div className="wrap founder">
            <div className="founder-photo" data-reveal="photo">
              {CONFIG.founderPhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={CONFIG.founderPhoto} alt="Shailendra Pathak, founder of Migrizo" />
              ) : (
                <FounderPlaceholder />
              )}
              <div className="founder-badge">
                <UnionFlag />
                <span>
                  <b>Shailendra Pathak</b>
                  Founder and Principal Case Officer
                </span>
              </div>
              <span className="founder-ring" aria-hidden="true" />
            </div>
            <div>
              <h2 className="kicker" id="founder-title" data-reveal>
                Meet The Founder
              </h2>
              <blockquote className="founder-quote" data-reveal style={d(1)}>
                &ldquo;Most people I meet already have the work. What they lack is <em>a plan, and evidence in the right order.</em>&rdquo;
              </blockquote>
              <div className="founder-words" data-reveal style={d(2)}>
                <p>I started Migrizo because I kept meeting talented people who had ruled themselves out of a visa they could win. Our job is to give your case a clear route, evidence mapped to the criteria and letters that say something specific.</p>
                <p>Alongside Migrizo, I lecture at UK universities and IIT India, and through Migrizo Talent I connect Indian tech talent with UK and European employers. I see every week what UK endorsers and employers look for.</p>
              </div>
              <ul className="creds" data-reveal style={d(4)}>
                {[
                  { Icon: GraduationCap, title: "IIM Calcutta", sub: "Alumnus" },
                  { Icon: Presentation, title: "Guest lecturer", sub: "UK universities and IIT India" },
                  { Icon: Briefcase, title: "Founder, Migrizo Talent", sub: "Connecting Indian tech talent with UK and European employers" },
                  { Icon: BookOpen, title: "Author", sub: "The Scalable Mindset" },
                ].map(({ Icon, title, sub }) => (
                  <li key={title}>
                    <span className="cred-icon">
                      <Icon size={18} aria-hidden="true" />
                    </span>
                    <span>
                      <strong>{title}</strong>
                      <span>{sub}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Founder at guest lectures and London events: a strip that drifts right to left */}
        <section className="gallery" aria-labelledby="gallery-title">
          <div className="wrap gallery-head">
            <h2 className="h3x" id="gallery-title" data-reveal>
              In The Lecture Hall And Around London
            </h2>
            <p data-reveal style={d(1)}>Guest lectures at UK universities and IIT, and time with founders, investors and hiring teams in London.</p>
          </div>
          <div className="gallery-marquee">
            <div className="gallery-track">
              {[0, 1].map((g) => (
                <ul className="gallery-group" key={g} aria-hidden={g === 1 ? "true" : undefined}>
                  {GALLERY.map((p) => (
                    <li key={p.src} style={{ ["--ar" as string]: p.w / 520 } as React.CSSProperties}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.src} alt={g === 1 ? "" : `Shailendra Pathak: ${p.cap}`} width={p.w} height={520} loading="lazy" decoding="async" />
                      <span className="gallery-cap">{p.cap}</span>
                    </li>
                  ))}
                </ul>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="section bg-white" id="faq" aria-labelledby="faq-title">
          <div className="wrap faq-layout">
            <div className="faq-side">
              <p className="kicker" data-reveal>
                FAQ
              </p>
              <h2 className="h2" id="faq-title" data-reveal style={d(1)}>
                Questions People <em>Ask Us First</em>
              </h2>
              <div className="help-card" data-reveal style={d(2)}>
                <div className="glow" aria-hidden="true" />
                <h3>Still unsure?</h3>
                <p>Message us on WhatsApp and a person will reply. Or take the score first and bring it to the call.</p>
                <div className="cta-row">
                  {waBtn("faq", "btn btn--gold btn--sm", "Ask on WhatsApp")}
                </div>
              </div>
            </div>
            <Faq />
          </div>
        </section>

        {/* Final call to action and footer */}
        <section className="final grain" ref={finalRef} aria-labelledby="final-title">
          <Image className="final-photo" src={PHOTOS.night} alt="" fill sizes="100vw" />
          <div className="glow" aria-hidden="true" />
          <div className="wrap final-inner">
            <p className="kicker" data-reveal>
              About a minute
            </p>
            <h2 className="display" id="final-title" data-reveal style={d(1)}>
              Find Out <em>Where You Stand</em>
            </h2>
            <p className="final-sub" data-reveal style={d(2)}>
              Five questions, an honest indicative score and a clear next step. If you are ready, we will tell you. If not, we will tell you what to build.
            </p>
            <div className="cta-row" data-reveal style={d(3)}>
              {ctaScore("final")}
              {waBtn("final", "btn btn--outline-light")}
            </div>
            <p className="final-micro" data-reveal style={d(4)}>
              <Lock size={14} aria-hidden="true" /> Free, private and no documents needed
            </p>
          </div>
          <footer className="footer">
            <div className="wrap footer-grid">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="footer-logo" src={LOGO.white} width={LOGO.w} height={LOGO.h} alt="Migrizo" />
              <div>
                <p>Migrizo is an immigration consultancy and not a law firm. The score is indicative only. Decisions are made by endorsing bodies and the UK Home Office. No outcome is guaranteed. Fees may change.</p>
                <p>Migrizo is independent and not affiliated with any endorsing body or the Home Office.</p>
                <p>© {new Date().getFullYear()} Migrizo Ventures Pvt Ltd. City and field photography from Unsplash.</p>
                <p>
                  <a href={CONFIG.privacyUrl} target="_blank" rel="noopener">
                    Privacy policy
                  </a>
                </p>
              </div>
            </div>
          </footer>
        </section>
        {/* Key facts and endorsing bodies */}
        {CONFIG.showGlance && (
        <section className="section glance" id="facts" aria-labelledby="facts-title">
          <div className="wrap glance-layout">
            <div className="glance-intro" data-reveal="left">
              <Image src={PHOTOS.regent} alt="Union flags over Regent Street in London, with a black cab and a red bus" fill sizes="(min-width: 1000px) 34vw, 92vw" />
              <div className="glance-intro-text">
                <p className="glance-kicker">
                  <UnionFlag /> UK Global Talent Visa
                </p>
                <h2 className="h2" id="facts-title">
                  The Visa <em>At A Glance</em>
                </h2>
                <p>Four facts that make it one of the most flexible ways to live and work in the UK.</p>
              </div>
            </div>
            <Glance reduced={reduced} />
          </div>
        </section>
        )}

        {CONFIG.showMoreSections && (
          <>
        {/* Why applications get refused */}
        <section className="section bg-white refusals" id="refusals-x" aria-labelledby="refusals-title">
          <div className="wrap">
            <div className="sec-head">
              <p className="kicker" data-reveal>
                Refusals
              </p>
              <h2 className="h2" id="refusals-title" data-reveal style={d(1)}>
                Why Strong Profiles Still Get <em className="red-mark">Refused</em>
              </h2>
              <p className="lead" data-reveal style={d(2)}>
                Most refusals are not about talent. They come down to six avoidable mistakes, and this is how we prevent each one.
              </p>
            </div>
            <Reasons reduced={reduced} />
          </div>
        </section>

        {/* Myths */}
        <section className="section myths-dark" id="myths-x" aria-labelledby="myths-title">
          <div className="glow" aria-hidden="true" />
          <div className="wrap">
            <div className="sec-head">
              <p className="kicker" data-reveal>
                Myths
              </p>
              <h2 className="h2" id="myths-title" data-reveal style={d(1)}>
                Six Myths That Stop <em>Talented People Applying</em>
              </h2>
              <p className="lead" data-reveal style={d(2)}>
                Tap any card to see the truth.
              </p>
            </div>
            <Myths reduced={reduced} />
            <div className="center-cta" data-reveal>
              {ctaScore("myths")}
              <span>Takes about a minute. No documents needed.</span>
            </div>
          </div>
        </section>

        {/* Life in the UK: photo band */}
        <section className="section bg-tint ukx" aria-labelledby="uk-title">
          <div className="wrap">
            <div className="sec-head">
              <p className="kicker" data-reveal>
                <UnionFlag /> Life in the UK
              </p>
              <h2 className="h2" id="uk-title" data-reveal style={d(1)}>
                Build Your Life <em>Anywhere In The UK</em>
              </h2>
              <p className="lead" data-reveal style={d(2)}>
                The visa is not tied to an employer or a city. Pick the place that fits your work and your family.
              </p>
            </div>
          </div>
          <div className="city-marquee" data-reveal>
            <div className="city-track">
              {[0, 1].map((g) => (
                <ul className="city-group" key={g} aria-hidden={g === 1 ? "true" : undefined}>
                  {CITIES.map((c) => (
                    <li className="city" key={c.city}>
                      <Image src={PHOTOS[c.img]} alt={g === 1 ? "" : c.alt} fill sizes="300px" />
                      <span className="city-text">
                        <strong>{c.city}</strong>
                        <span>{c.line}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              ))}
            </div>
          </div>
          <div className="wrap">
            <ul className="unlocks">
              {UNLOCKS.map(({ Icon, title }, i) => (
                <li key={title} data-reveal style={d(i)}>
                  <span className="unlock-icon" aria-hidden="true">
                    <Icon size={18} />
                  </span>
                  {title}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Job support: the USP */}
        <section className="jobs" id="jobs-x" aria-labelledby="jobs-title">
          <Image className="jobs-photo" src={PHOTOS.canaryWharf} alt="" fill sizes="100vw" />
          <div className="wrap jobs-layout">
            <div className="jobs-copy">
              <p className="jobs-tag" data-reveal>
                <BriefcaseBusiness size={15} aria-hidden="true" /> Only at Migrizo
              </p>
              <h2 className="h2" id="jobs-title" data-reveal style={d(1)}>
                Visa Approved? <em>We Help You Land The Job.</em>
              </h2>
              <p className="jobs-lead" data-reveal style={d(2)}>
                Most consultants stop at the visa. Through Migrizo Talent, we connect you with UK and European employers and help you get hired as soon as possible.
              </p>
              <div className="cta-row" data-reveal style={d(3)}>
                {ctaScore("jobs")}
                {waBtn("jobs", "btn btn--outline-light")}
              </div>
              <p className="jobs-note" data-reveal style={d(4)}>
                We cannot guarantee a job offer. Introductions depend on your profile and what employers are hiring for.
              </p>
            </div>
            <div className="jmock" data-reveal="right" aria-hidden="true">
              <div className="jmock-top">
                <span className="jmock-avatar">
                  <UserCheck size={18} />
                </span>
                <span>
                  <strong>Your matches</strong>
                  <span>UK and Europe</span>
                </span>
                <span className="jmock-tag">Example</span>
              </div>
              <ul className="jmock-rows">
                {[
                  ["Senior ML Engineer", "Fintech", "London", "Interview", "ok"],
                  ["Product Lead", "SaaS", "Berlin", "Introduced", "go"],
                  ["Data Scientist", "Health tech", "Cambridge", "Interview", "ok"],
                  ["Platform Engineer", "AI lab", "Amsterdam", "Shortlisted", "wait"],
                ].map(([role, sector, city, status, tone], i) => (
                  <li key={role} style={{ ["--k" as string]: i } as React.CSSProperties}>
                    <span className="jmock-role">
                      <strong>{role}</strong>
                      <span>
                        {sector} · {city}
                      </span>
                    </span>
                    <span className="jmock-status" data-tone={tone}>
                      {status}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="jmock-foot">
                <Globe size={14} /> Illustration of how we track introductions
              </p>
            </div>
          </div>
          <div className="wrap">
            <ol className="jobs-steps">
              {JOB_STEPS.map(({ Icon, title, body }, i) => (
                <li key={title} data-reveal style={d(i)}>
                  <div className="jobs-step-top">
                    <span className="jobs-icon" aria-hidden="true">
                      <Icon size={20} />
                    </span>
                    <span className="jobs-num" aria-hidden="true">
                      0{i + 1}
                    </span>
                  </div>
                  <strong>{title}</strong>
                  <span>{body}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

          </>
        )}

      </main>

      {/* Mobile sticky bar */}
      <div className="mbar" data-show={showBar} aria-hidden={!showBar} {...(!showBar ? { inert: true } : {})}>
        <button
          type="button"
          className="btn btn--gold"
          onClick={(e) => {
            track("gtv_cta_click", { location: "sticky_bar" });
            scrollToCalc(e);
          }}
        >
          Check my score
        </button>
        {waBtn("sticky_bar", "btn btn--outline", "WhatsApp")}
      </div>
      <CookieBanner />
    </>
  );
}
