-- CR008 · CLUB RIVAL · the results of each session, so the panel in Club Rival can show them.
-- Run once in Supabase (SQL Editor -> New query -> paste -> Run). Run CR001-CLUB.sql first. Safe to run twice.
-- One row per finished session. The id is the same id the app uses for its XP row, so a session can never show twice.
-- data looks like: {"program":"PURE POWER","metrics":[{"k":"Squat","v":190,"u":"lb","pr":true},{"k":"Sets","v":5}]}
create table if not exists public.club_session (
  user_id uuid not null references auth.users(id) on delete cascade,
  id      text not null check (char_length(id) between 3 and 80),
  app     text not null check (app in ('stride','rep','rankup','mind','bmx','trail','rest')),
  at      timestamptz not null default now(),
  title   text check (title is null or char_length(title) <= 80),
  data    jsonb not null default '{}'::jsonb check (pg_column_size(data) < 16000),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists club_session_user_at on public.club_session (user_id, at);
alter table public.club_session enable row level security;
drop policy if exists club_session_own on public.club_session;
create policy club_session_own on public.club_session for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.club_session to authenticated;
