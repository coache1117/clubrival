-- CR001 · CLUB RIVAL · shared XP for every Rival app. Run once in Supabase (SQL Editor -> New query -> paste -> Run). Safe to run twice.
-- One row per thing that earned XP. The id comes from the app (one per finished session / rival win), so a retry,
-- a re-sync or reopening a result can never pay twice.
create table if not exists public.club_xp (
  user_id uuid not null references auth.users(id) on delete cascade,
  id      text not null check (char_length(id) between 3 and 80),
  app     text not null check (app in ('stride','rep','rankup','mind','bmx','trail','rest')),
  kind    text not null check (kind in ('session','rival')),
  xp      int  not null check (xp in (10,100)),
  at      timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists club_xp_user_at on public.club_xp (user_id, at);
alter table public.club_xp enable row level security;
drop policy if exists club_xp_own_select on public.club_xp;
create policy club_xp_own_select on public.club_xp for select using (auth.uid() = user_id);
grant select on public.club_xp to authenticated;
-- Apps never write the table directly. They call this, and the SERVER sets the XP: 10 for a finished session, 100 for beating your rival.
create or replace function public.club_award(p_rows jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); r jsonb; n int := 0; k text; t timestamptz;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 200 then raise exception 'bad rows'; end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    k := r->>'kind';
    if k is null or k not in ('session','rival') then continue; end if;
    if coalesce(char_length(r->>'id'), 0) < 3 then continue; end if;
    if (r->>'app') not in ('stride','rep','rankup','mind','bmx','trail','rest') then continue; end if;
    begin t := (r->>'at')::timestamptz; exception when others then t := now(); end;
    -- a time in the future is not allowed; an older session keeps its real time, so it lands in the week it really happened
    if t is null or t > now() + interval '5 minutes' then t := now(); end if;
    insert into public.club_xp (user_id, id, app, kind, xp, at)
      values (uid, left(r->>'id', 80), r->>'app', k, case when k = 'rival' then 100 else 10 end, t)
      on conflict (user_id, id) do nothing;
    if found then n := n + 1; end if;
  end loop;
  return n;
end $$;
revoke all on function public.club_award(jsonb) from public, anon;
grant execute on function public.club_award(jsonb) to authenticated;

-- Which paid apps a member can open. Filled in when billing is switched on; empty for now. Members can only read their own.
create table if not exists public.club_access (
  user_id uuid not null references auth.users(id) on delete cascade,
  app     text not null,
  at      timestamptz not null default now(),
  primary key (user_id, app)
);
alter table public.club_access enable row level security;
drop policy if exists club_access_own_select on public.club_access;
create policy club_access_own_select on public.club_access for select using (auth.uid() = user_id);
grant select on public.club_access to authenticated;
