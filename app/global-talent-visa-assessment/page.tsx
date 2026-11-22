import GtvLanding from "./GtvLanding";

/**
 * /global-talent-visa-assessment
 *
 * Thin server wrapper: reads ?seg= (tech | research | arts) on the server so the
 * matching H1 is in the first HTML response. No flash, no layout shift, faster LCP.
 * Everything else lives in the client component GtvLanding.tsx.
 */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.seg) ? sp.seg[0] : sp.seg;
  const seg = raw && ["tech", "research", "arts"].includes(raw) ? raw : undefined;
  return <GtvLanding seg={seg} />;
}
