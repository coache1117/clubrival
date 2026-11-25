-- CR069 · FIX THE POINTS FOR GOOD. Mind said "Club won't take the 500 XP level-up" even after CR063.
-- Most likely an older script (FU001 Fuel, SR001 Social or MR001 Mind) was run after CR063 and put back the old points function.
-- This is the newest one. Run it once: Supabase (the Club project, glmy in the address) > SQL Editor > New query > paste all > Run.
-- Safe to run twice. From now on, never re-run FU001, SR001, MR001, CR032 or CR063 - this one replaces them all.

do $$
declare
  base text[] := array['stride','rep','rankup','mind','bmx','trail','rest','money','rise','biz','mindrival','social','fuel'];
  t text; lst text[]; extra text[];
begin
  foreach t in array array['club_xp','club_session','club_summary'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('select coalesce(array_agg(distinct app), ''{}'') from public.%I', t) into extra;
    select array_agg(distinct a order by a) into lst from unnest(base || extra) a where a is not null;
    execute format('alter table public.%I drop constraint if exists %I', t, t || '_app_check');
    execute format('alter table public.%I add constraint %I check (app = any (%L::text[]))', t, t || '_app_check', lst);
  end loop;
  -- the kinds, and the 500 XP level-up rule
  alter table public.club_xp drop constraint if exists club_xp_kind_check;
  alter table public.club_xp add constraint club_xp_kind_check check (kind in ('session','rival','levelup'));
  -- any old points rule, whatever it was named (e.g. "xp in (10, 100)"), goes
  for t in select conname from pg_constraint where conrelid = 'public.club_xp'::regclass and contype = 'c' and pg_get_constraintdef(oid) ~ '\mxp\M' and pg_get_constraintdef(oid) !~ 'kind' loop
    execute format('alter table public.club_xp drop constraint %I', t);
  end loop;
  alter table public.club_xp add constraint club_xp_xp_check check (xp in (10, 100, 500));
end $$;

create or replace function public.club_award(p_rows jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); r jsonb; n int := 0; k text; t timestamptz; lv int; rid text;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 200 then raise exception 'bad rows'; end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    k := r->>'kind';
    if k is null or k not in ('session','rival','levelup') then continue; end if;
    if (r->>'app') not in ('stride','rep','rankup','mind','bmx','trail','rest','money','rise','biz','mindrival','social','fuel') then continue; end if;
    begin t := (r->>'at')::timestamptz; exception when others then t := now(); end;
    if t is null or t > now() + interval '5 minutes' then t := now(); end if;
    if k = 'levelup' then
      begin lv := (r->>'level')::int; exception when others then lv := null; end;
      if lv is null or lv < 2 or lv > 200 then continue; end if;
      rid := 'lvl-' || (r->>'app') || '-' || lv;
    else
      if coalesce(char_length(r->>'id'), 0) < 3 then continue; end if;
      rid := left(r->>'id', 80);
    end if;
    begin
      insert into public.club_xp (user_id, id, app, kind, xp, at)
        values (uid, rid, r->>'app', k, case when k = 'levelup' then 500 when k = 'rival' then 100 else 10 end, t)
        on conflict (user_id, id) do nothing;
      if found then n := n + 1; end if;
    exception when others then null;   -- CR069: a bad row is skipped, never the whole batch
    end;
  end loop;
  return n;
end $$;
revoke all on function public.club_award(jsonb) from public, anon;
grant execute on function public.club_award(jsonb) to authenticated;

select 'CR069 done: points fixed for every app (10 / 100 / 500), one bad row can never block the rest.' as done;
-- check: this should list 10, 100 and 500
select pg_get_constraintdef(oid) as xp_rule from pg_constraint where conname = 'club_xp_xp_check';
