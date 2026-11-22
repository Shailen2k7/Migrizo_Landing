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

/**
 * Google Tag Manager container ID, e.g. GTM-ABC1234.
 * Set NEXT_PUBLIC_GTM_ID in Netlify (Environment variables) and redeploy.
 * If it is not set, no Google tag loads at all.
 */
const GTM_ID = (process.env.NEXT_PUBLIC_GTM_ID || "").trim();

/** UK, EEA and Switzerland: ad and analytics cookies stay off until the visitor accepts. */
const CONSENT_REGIONS = [
  "GB", "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT",
  "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE", "IS", "LI", "NO", "CH",
];

/**
 * Google consent mode v2. Runs before GTM.
 * - UK, EEA and Switzerland: everything denied by default (Google applies this by visitor IP).
 * - Everywhere else: granted by default.
 * - A choice made in the cookie banner (stored as "gtv_consent") is restored on every visit.
 */
const CONSENT_BOOT = `
window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
var G={ad_storage:"granted",ad_user_data:"granted",ad_personalization:"granted",analytics_storage:"granted"};
var D={ad_storage:"denied",ad_user_data:"denied",ad_personalization:"denied",analytics_storage:"denied"};
gtag("consent","default",Object.assign({},D,{region:${JSON.stringify(CONSENT_REGIONS)},wait_for_update:500}));
gtag("consent","default",G);
gtag("set","ads_data_redaction",true);
gtag("set","url_passthrough",true);
try{var c=localStorage.getItem("gtv_consent");if(c==="granted")gtag("consent","update",G);else if(c==="denied")gtag("consent","update",D);}catch(e){}
`;

const GTM_BOOT = (id: string) =>
  `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer',${JSON.stringify(id)});`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" suppressHydrationWarning>
      <head>
        {GTM_ID && (
          <>
            <script dangerouslySetInnerHTML={{ __html: CONSENT_BOOT }} />
            <script dangerouslySetInnerHTML={{ __html: GTM_BOOT(GTM_ID) }} />
          </>
        )}
      </head>
      <body>
        {GTM_ID && (
          <noscript>
            <iframe src={`https://www.googletagmanager.com/ns.html?id=${encodeURIComponent(GTM_ID)}`} height="0" width="0" style={{ display: "none", visibility: "hidden" }} />
          </noscript>
        )}
        {children}
      </body>
    </html>
  );
}
