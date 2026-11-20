-- CLUB RIVAL · CR032 · run once in Supabase, the CLUB project (glmyzwxinguqcqtgodts): SQL Editor > New query > paste > Run. Safe to run twice.
-- Adds the app level-up reward: +500 XP once, when you level up inside an app (RankUp, Stride, Rep ...).
-- The server sets the amount and the row id, so the same level can never pay twice. Leveling up in the Club itself pays nothing.

-- 1. 'levelup' is a kind of XP row now (session and rival stay as they are)
alter table public.club_xp drop constraint if exists club_xp_kind_check;
alter table public.club_xp add constraint club_xp_kind_check check (kind in ('session','rival','levelup'));

-- 1b. every Rival app is on the lists (safe if they are already there; includes Rise and Biz)
alter table public.club_xp drop constraint if exists club_xp_app_check;
alter table public.club_xp add constraint club_xp_app_check check (app in ('stride','rep','rankup','mind','bmx','trail','rest','money','rise','biz'));
alter table public.club_session drop constraint if exists club_session_app_check;
alter table public.club_session add constraint club_session_app_check check (app in ('stride','rep','rankup','mind','bmx','trail','rest','money','rise','biz'));
alter table public.club_summary drop constraint if exists club_summary_app_check;
alter table public.club_summary add constraint club_summary_app_check check (app in ('stride','rep','rankup','mind','bmx','trail','rest','money','rise','biz'));

-- 2. club_award: same as before, plus levelup. Every app that is already a Club app stays on the list.
create or replace function public.club_award(p_rows jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); r jsonb; n int := 0; k text; t timestamptz; lv int; rid text;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 200 then raise exception 'bad rows'; end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    k := r->>'kind';
    if k is null or k not in ('session','rival','levelup') then continue; end if;
    if (r->>'app') not in ('stride','rep','rankup','mind','bmx','trail','rest','money','rise','biz') then continue; end if;
    begin t := (r->>'at')::timestamptz; exception when others then t := now(); end;
    if t is null or t > now() + interval '5 minutes' then t := now(); end if;
    if k = 'levelup' then
      begin lv := (r->>'level')::int; exception when others then lv := null; end;
      if lv is null or lv < 2 or lv > 200 then continue; end if;
      rid := 'lvl-' || (r->>'app') || '-' || lv;           -- one row per app per level, forever
    else
      if coalesce(char_length(r->>'id'), 0) < 3 then continue; end if;
      rid := left(r->>'id', 80);
    end if;
    insert into public.club_xp (user_id, id, app, kind, xp, at)
      values (uid, rid, r->>'app', k, case when k = 'levelup' then 500 when k = 'rival' then 100 else 10 end, t)
      on conflict (user_id, id) do nothing;
    if found then n := n + 1; end if;
  end loop;
  return n;
end $$;
revoke all on function public.club_award(jsonb) from public, anon;
grant execute on function public.club_award(jsonb) to authenticated;
