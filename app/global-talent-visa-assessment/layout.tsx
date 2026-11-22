import type { Metadata } from "next";
import { Cabin, Inter } from "next/font/google";
import "./gtv.css";

// Self-hosted by next/font: no layout shift, no render-blocking request to Google.
// Cabin for headings, Inter for everything else.
const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });
const cabin = Cabin({ subsets: ["latin"], display: "swap", variable: "--font-head" });

export const metadata: Metadata = {
  title: "Do you qualify for the UK Global Talent Visa? | Migrizo",
  description:
    "Free 60-second Global Talent eligibility score from UK Global Talent Visa specialists.",
  // Paid landing page: never index.
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

// Runs before first paint: hides [data-reveal] blocks so they can animate in.
// If the page script has not taken over within 3 seconds, everything is shown.
const REVEAL_BOOT = `document.documentElement.classList.add("js-reveal");setTimeout(function(){if(!window.__gtvReveal)document.documentElement.classList.remove("js-reveal")},3000);`;

export default function GtvLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: REVEAL_BOOT }} />
      <div className={`${inter.variable} ${cabin.variable} gtv-root`}>{children}</div>
    </>
  );
}
