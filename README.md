# Migrizo · Global Talent assessment landing page

Page: `/global-talent-visa-assessment` (root `/` redirects there). Next.js 15 App Router.

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
5. Add Google Tag Manager to `app/layout.tsx` and create triggers for the dataLayer events:
   `gtv_assessment_start`, `gtv_assessment_complete` (score), `gtv_qualified_lead`, `gtv_call_booking_click`, `gtv_whatsapp_click`, `gtv_profile_chip`.

## Local
```
npm install
cp .env.example .env.local
npm run dev
```
