/**
 * Global Talent eligibility score: single source of truth.
 *
 * Imported by the client calculator (to show the score instantly) and by
 * /api/gtv-lead (to recalculate on the server, so a tampered client score
 * is never trusted). Edit weights here and both sides stay in sync.
 */

/** Score at or above this books a strategy call. Below it gets the readiness guide. */
export const QUALIFY_THRESHOLD = 60;
/** Score at or above this is labelled "Strong profile". */
export const STRONG_THRESHOLD = 75;

export type Option = { id: string; label: string; points: number; hint?: string };
export type Question = {
  id: "field" | "years" | "role" | "evidence" | "timeline";
  title: string;
  helper?: string;
  multi?: boolean;
  /** Multi-select only: points per selected item and overall cap. */
  perItem?: number;
  cap?: number;
  options: Option[];
};

export const QUESTIONS: Question[] = [
  {
    id: "field",
    title: "Which field is your work in?",
    helper: "Pick the one closest to how you would describe your work.",
    options: [
      { id: "digital", label: "Digital technology", points: 10, hint: "Engineering, AI, data, product, tech founders" },
      { id: "research", label: "Research or academia", points: 10, hint: "Science, medicine, engineering, humanities" },
      { id: "arts", label: "Arts and culture", points: 10, hint: "Music, film, theatre, literature, visual arts" },
      { id: "design", label: "Design", points: 10, hint: "Product, UX, fashion, architecture" },
      { id: "other", label: "Something else", points: 0 },
    ],
  },
  {
    id: "years",
    title: "How many years have you worked in this field?",
    options: [
      { id: "lt2", label: "Under 2 years", points: 0 },
      { id: "2to5", label: "2 to 5 years", points: 10 },
      { id: "5to10", label: "5 to 10 years", points: 20 },
      { id: "10plus", label: "10+ years", points: 25 },
    ],
  },
  {
    id: "role",
    title: "What best describes your current role?",
    options: [
      { id: "ic", label: "Individual contributor", points: 5 },
      { id: "senior", label: "Senior or lead", points: 12 },
      { id: "exec", label: "Head, Director, VP or C-level", points: 20 },
      { id: "founder", label: "Founder", points: 20 },
    ],
  },
  {
    id: "evidence",
    title: "Which of these can you show evidence of?",
    helper: "Select all that apply. Rough is fine, we refine this on the call.",
    multi: true,
    perItem: 7,
    cap: 35,
    options: [
      { id: "awards", label: "Awards or prizes", points: 7 },
      { id: "media", label: "Media coverage", points: 7 },
      { id: "talks", label: "Talks or conference speaking", points: 7 },
      { id: "patents", label: "Patents or publications", points: 7 },
      { id: "scale", label: "Work used at scale", points: 7 },
      { id: "judging", label: "Judging or mentoring", points: 7 },
      { id: "revenue", label: "Founder revenue or funding", points: 7 },
      { id: "none", label: "None of these yet", points: 0 },
    ],
  },
  {
    id: "timeline",
    title: "When would you like to move to the UK?",
    options: [
      { id: "3m", label: "Within 3 months", points: 10 },
      { id: "3to6", label: "3 to 6 months", points: 7 },
      { id: "6to12", label: "6 to 12 months", points: 3 },
      { id: "exploring", label: "Just exploring", points: 0 },
    ],
  },
];

export type Answers = Partial<Record<Question["id"], string | string[]>>;

/** Pure scoring function. Unknown ids score 0, so it is safe on untrusted input. */
export function calculateScore(answers: Answers): number {
  let total = 0;
  for (const q of QUESTIONS) {
    const a = answers[q.id];
    if (q.multi) {
      const picked = Array.isArray(a) ? Array.from(new Set(a)) : [];
      if (picked.includes("none")) continue;
      const valid = picked.filter((id) => q.options.some((o) => o.id === id && o.points > 0));
      total += Math.min(valid.length * (q.perItem ?? 0), q.cap ?? Infinity);
    } else if (typeof a === "string") {
      total += q.options.find((o) => o.id === a)?.points ?? 0;
    }
  }
  return Math.max(0, Math.min(100, total));
}

export type Band = "strong" | "promising" | "building";
export function scoreBand(score: number): Band {
  if (score >= STRONG_THRESHOLD) return "strong";
  if (score >= QUALIFY_THRESHOLD) return "promising";
  return "building";
}

const BREAKDOWN_LABELS: Record<Question["id"], string> = {
  field: "Field",
  years: "Experience",
  role: "Seniority",
  evidence: "Evidence",
  timeline: "Timeline",
};

/** Per-question points and maximums, used for the result breakdown bars. */
export function scoreBreakdown(answers: Answers) {
  return QUESTIONS.map((q) => {
    const max = q.multi ? q.cap ?? 0 : Math.max(...q.options.map((o) => o.points));
    const points = calculateScore({ [q.id]: answers[q.id] } as Answers);
    return { id: q.id, label: BREAKDOWN_LABELS[q.id], points, max };
  });
}
