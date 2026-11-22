-- BIZ RIVAL · BZ001 · run once in Supabase, the CLUB project (glmyzwxinguqcqtgodts): SQL Editor > New query > paste > Run. Safe to run twice.
-- Your business assistant's records. Each person only ever sees their own. The Google key lives in biz_secret, which the app can NOT read.

-- 1. Everything the app shows: knowledge, settings, rules, contacts, threads, jobs (one row per person, with a revision number)
create table if not exists public.biz_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  rev int not null default 1,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.biz_state enable row level security;
drop policy if exists biz_state_own on public.biz_state;
create policy biz_state_own on public.biz_state for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.biz_state to authenticated;

-- 2. Holds on a time slot: the database refuses a second hold on the same start time, so two jobs can never book the same slot
create table if not exists public.biz_hold (
  user_id uuid not null references auth.users(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  thread_id text not null,
  status text not null default 'held' check (status in ('held','booked','released')),
  created_at timestamptz not null default now(),
  primary key (user_id, starts_at)
);
alter table public.biz_hold enable row level security;
drop policy if exists biz_hold_own on public.biz_hold;
create policy biz_hold_own on public.biz_hold for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.biz_hold to authenticated;

-- 3. Every send / book / publish, once. The key is unique, so a retry after a time-out can never send or book twice.
create table if not exists public.biz_run (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  kind text not null,
  status text not null default 'running' check (status in ('running','done','failed','check')),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);
alter table public.biz_run enable row level security;
drop policy if exists biz_run_read on public.biz_run;
create policy biz_run_read on public.biz_run for select using (auth.uid() = user_id);
grant select on public.biz_run to authenticated;

-- 4. The Google connection (refresh token). No policy = the app can never read it. Only the Netlify functions (service key) can.
create table if not exists public.biz_secret (
  user_id uuid primary key references auth.users(id) on delete cascade,
  google_email text,
  refresh_token text,
  scopes text,
  connected_at timestamptz default now()
);
alter table public.biz_secret enable row level security;
revoke all on public.biz_secret from anon, authenticated;

-- 5. Biz Rival earns Club XP like every Rival app
alter table public.club_xp drop constraint if exists club_xp_app_check;
alter table public.club_xp add constraint club_xp_app_check check (app in ('stride','rep','rankup','mind','bmx','trail','rest','money','rise','biz'));
alter table public.club_session drop constraint if exists club_session_app_check;
alter table public.club_session add constraint club_session_app_check check (app in ('stride','rep','rankup','mind','bmx','trail','rest','money','rise','biz'));
alter table public.club_summary drop constraint if exists club_summary_app_check;
alter table public.club_summary add constraint club_summary_app_check check (app in ('stride','rep','rankup','mind','bmx','trail','rest','money','rise','biz'));
