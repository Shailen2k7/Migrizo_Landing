# Migrizo · Global Talent assessment landing page

Page: `/` and `/global-talent-visa-assessment` show the same landing page (a rewrite in `next.config.mjs`, no redirect, so ad click IDs are kept). Next.js 15 App Router.

## Files
- `app/global-talent-visa-assessment/GtvLanding.tsx`: the page (one client component). **CONFIG block at the top**: booking URL, WhatsApp number, founder photo.
- `app/global-talent-visa-assessment/page.tsx`: reads `?seg=tech|research|arts` on the server so the right H1 ships in the HTML.
- `app/global-talent-visa-assessment/gtv.css`: all styles and animations.
- `lib/gtv-scoring.ts`: questions, weights and `QUALIFY_THRESHOLD` (shared by page and API).
- `app/api/gtv-lead/route.ts`: validates, recalculates the score, saves to Supabase, optional webhook.
- `supabase/migrations/0001_gtv_leads.sql`: leads table with RLS on.

## Put it on GitHub
1. On github.com create a new **private** repository (no README, no .gitignore).
2. In this folder run:
```
git init
git add .
git commit -m "Global Talent assessment landing page"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
git push -u origin main
```
Or drag the folder's contents into the repository page on github.com (Add file, Upload files).

## Go live (Netlify + Supabase)
1. Supabase: SQL Editor, run `supabase/migrations/0001_gtv_leads.sql`.
2. Netlify: import the repo. Build settings come from `netlify.toml`.
3. Netlify env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (optional `GTV_LEAD_WEBHOOK_URL`, `GTV_LEAD_WEBHOOK_SECRET`).
4. Domain: add the subdomain in Netlify, then a CNAME at your DNS provider pointing to the Netlify site.
5. Netlify env var `NEXT_PUBLIC_GTM_ID` = your GTM container ID (e.g. `GTM-ABC1234`), then redeploy. Without it no Google tag loads.

## Leads into the Migrizo CRM
Set `CRM_INGEST_SECRET` in this site's Netlify env vars to the same value as `INGEST_SECRET` in the CRM's
Netlify site, then redeploy. Every lead is then created in crm.migrizo.com through the CRM's own intake
endpoint (`/api/ingest/meta-lead`, the one Meta ads and the website popup use): duplicate check by phone,
today's call queue, the automatic "How it works" email, activity timeline and ingest log.
- visa_type `gtv`; source `Google Ads` (when a gclid, gbraid or wbraid is present) or `GTV Landing Page`
- tags `gtv-landing`, plus `gtv-qualified` for a score of 60+
- field becomes the CRM industry; score, band, answers, LinkedIn, gclid and UTMs are in the lead's intake answers
- the Supabase `gtv_leads` table keeps a full copy as a backup
Optional: `CRM_INGEST_URL` (defaults to https://crm.migrizo.com/api/ingest/meta-lead).

## Google Ads and YouTube Ads setup (in Google Tag Manager)
Already built into the page:
- Google Tag Manager loads from `NEXT_PUBLIC_GTM_ID` (`app/layout.tsx`).
- Consent mode v2: UK, EEA and Switzerland start with ad cookies denied (by IP), everywhere else granted.
  Visitors with a European time zone see a small Accept / Reject banner; the choice is remembered.
  `url_passthrough` and `ads_data_redaction` are on, so the gclid survives even when cookies are refused.
- gclid, gbraid, wbraid and UTMs are captured and saved with every lead in Supabase (for offline conversion import).
- Privacy policy link (https://migrizo.com/privacy) under the form, in the footer and in the banner.

dataLayer events:
| Event | When | Data |
|---|---|---|
| `gtv_assessment_start` | first answer | `method` |
| `gtv_assessment_complete` | form submitted (every lead) | `score`, `band`, `lead_id`, `user_data.email`, `user_data.phone_number` |
| `gtv_qualified_lead` | form submitted, score 60+ | same as above |
| `gtv_call_booking_click` | booking button on the result | `score`, `location` |
| `gtv_whatsapp_click` | any WhatsApp button | `location`, `score` |
| `gtv_cta_click` | any "Check my score" button | `location` |
| `gtv_profile_chip` | profile chip in the hero | `profile`, `field` |
| `gtv_consent_update` | banner choice | `consent` |

In GTM:
1. Tag **Google tag** with your Google Ads ID (`AW-...`), trigger All Pages. Turn on "Include user-provided data from your website" and use a User-Provided Data variable: Email = Data Layer Variable `user_data.email`, Phone = `user_data.phone_number` (enhanced conversions).
2. **Conversion Linker** tag, trigger All Pages.
3. Data Layer Variables: `lead_id`, `score`, `user_data.email`, `user_data.phone_number`.
4. Custom Event triggers: `gtv_assessment_complete`, `gtv_qualified_lead`, `gtv_call_booking_click`, `gtv_whatsapp_click`.
5. **Google Ads Conversion Tracking** tags (create the conversion actions in Google Ads first):
   - "GTV Lead" (primary) on `gtv_assessment_complete`, Transaction ID = `{{lead_id}}`.
   - "GTV Qualified Lead" on `gtv_qualified_lead`, Transaction ID = `{{lead_id}}`.
   - "Booking click" and "WhatsApp click" as secondary conversions.
6. Preview in GTM, submit a test lead, check the tags fire, then Publish.

Ad final URL: `https://gtv.migrizo.com/` (add `?seg=tech`, `?seg=research` or `?seg=arts` for matching headlines). Turn on auto-tagging in Google Ads.

## Local
```
npm install
cp .env.example .env.local
npm run dev
```
