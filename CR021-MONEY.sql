-- CR021 · CLUB RIVAL · lets Money Rival earn Club XP and show its sessions. Run once in Supabase (SQL Editor > New query > paste > Run).
-- Same project as the Club (glmyzwxinguqcqtgodts). Run CR001 and CR008 first (already done). Safe to run twice.
alter table public.club_xp drop constraint if exists club_xp_app_check;
alter table public.club_xp add constraint club_xp_app_check check (app in ('stride','rep','rankup','mind','bmx','trail','rest','money'));
alter table public.club_session drop constraint if exists club_session_app_check;
alter table public.club_session add constraint club_session_app_check check (app in ('stride','rep','rankup','mind','bmx','trail','rest','money'));

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
    if (r->>'app') not in ('stride','rep','rankup','mind','bmx','trail','rest','money') then continue; end if;
    begin t := (r->>'at')::timestamptz; exception when others then t := now(); end;
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
