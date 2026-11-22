import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Migrizo | UK Global Talent Visa specialists",
  description: "UK Global Talent Visa and Innovator Founder Visa specialists.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0F1838",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
