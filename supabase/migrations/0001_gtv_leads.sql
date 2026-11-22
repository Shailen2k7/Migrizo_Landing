-- Global Talent assessment leads.
-- Run in Supabase: SQL Editor > New query > paste > Run (or `supabase db push`).

create table if not exists public.gtv_leads (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),

  -- contact
  name            text not null,
  email           text not null,
  whatsapp        text not null,
  linkedin        text,
  consent         boolean not null default false,

  -- answers
  field           text,
  years           text,
  role            text,
  evidence        text[] not null default '{}',
  timeline        text,

  -- score (recalculated on the server)
  score           smallint not null check (score between 0 and 100),
  band            text not null check (band in ('strong', 'promising', 'building')),
  qualified       boolean not null,
  client_score    smallint,
  score_mismatch  boolean not null default false,

  -- attribution
  gclid           text,
  gbraid          text,
  wbraid          text,
  utm_source      text,
  utm_medium      text,
  utm_campaign    text,
  utm_term        text,
  utm_content     text,
  seg             text,
  landing_url     text,
  referrer        text,
  tracking        jsonb not null default '{}'::jsonb,
  user_agent      text,
  source          text not null default 'gtv-assessment-landing',

  -- sales workflow
  status          text not null default 'new' check (status in ('new', 'contacted', 'call_booked', 'won', 'lost', 'nurture')),
  notes           text
);

create index if not exists gtv_leads_created_at_idx on public.gtv_leads (created_at desc);
create index if not exists gtv_leads_email_idx on public.gtv_leads (email);
create index if not exists gtv_leads_qualified_idx on public.gtv_leads (qualified, created_at desc);

-- Lock the table down. Inserts come only from the Netlify function using the
-- service role key, which bypasses RLS. No anon or authenticated access at all.
alter table public.gtv_leads enable row level security;
revoke all on public.gtv_leads from anon, authenticated;
