-- CR064 · CLUB RIVAL · COACH MEMORY. The Orb remembers what matters to you, in every Rival app.
-- Supabase (the Club project, the one with glmy in the address) > SQL Editor > New query > paste all of this > Run. Safe to run twice.
-- One row per thing the coach remembers. Saying it again UPDATES the same row (no duplicates). Forget = the row is deleted, gone for good.
-- "Today only" / "this week only" rows carry expires_at and stop counting the moment they expire.
-- Every read and write is locked to YOUR account on the server (row level security). One account can never see another's.
-- scope = 'club' (every Rival app may use it) or one app id (only that app's coach gets it). CareCircle is never in here.

create table if not exists public.coach_memory (
  user_id    uuid not null references auth.users(id) on delete cascade,
  id         uuid not null default gen_random_uuid(),
  scope      text not null default 'club' check (scope in ('club','rep','stride','rankup','bmx','trail','rest','rise','mindrival','mind','money','biz','social','fuel')),
  category   text not null check (category in ('goal','routine','preference','constraint','followup','focus')),
  key        text not null check (char_length(key) between 1 and 60),
  value      text not null check (char_length(value) between 1 and 400),
  source     text not null default 'coach' check (source in ('coach','voice','text','settings')),
  sensitive  boolean not null default false,
  due_at     timestamptz,                         -- follow-ups: when to bring it up
  open       boolean not null default true,       -- follow-ups: still open?
  expires_at timestamptz,                         -- today only / this week only
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  unique (user_id, scope, category, key)
);
create index if not exists coach_memory_user on public.coach_memory (user_id, scope);
alter table public.coach_memory enable row level security;
drop policy if exists coach_memory_own on public.coach_memory;
create policy coach_memory_own on public.coach_memory for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
revoke all on public.coach_memory from anon;
grant select, insert, update, delete on public.coach_memory to authenticated;

-- pause new saves (the coach still uses what's already there)
create table if not exists public.coach_memory_settings (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  paused     boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.coach_memory_settings enable row level security;
drop policy if exists coach_memory_settings_own on public.coach_memory_settings;
create policy coach_memory_settings_own on public.coach_memory_settings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
revoke all on public.coach_memory_settings from anon;
grant select, insert, update, delete on public.coach_memory_settings to authenticated;

-- What one app's coach may read: your club-wide memories + that app's own, nothing expired.
create or replace function public.coach_memory_for(p_app text)
returns setof public.coach_memory language sql stable security invoker set search_path = public as $$
  select * from public.coach_memory
   where user_id = auth.uid()
     and (scope = 'club' or scope = coalesce(p_app, 'club'))
     and (expires_at is null or expires_at > now())
   order by category, updated_at desc
$$;
grant execute on function public.coach_memory_for(text) to authenticated;

-- Save or correct one memory (same scope + category + key = the same row, replaced). Refused while saves are paused.
create or replace function public.coach_memory_put(p_scope text, p_category text, p_key text, p_value text,
  p_source text default 'coach', p_expires timestamptz default null, p_sensitive boolean default false, p_due timestamptz default null)
returns public.coach_memory language plpgsql security invoker set search_path = public as $$
declare uid uuid := auth.uid(); r public.coach_memory;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if coalesce((select paused from public.coach_memory_settings where user_id = uid), false) then raise exception 'memory paused'; end if;
  insert into public.coach_memory (user_id, scope, category, key, value, source, expires_at, sensitive, due_at, open)
    values (uid, coalesce(nullif(p_scope,''),'club'), p_category, lower(trim(p_key)), trim(p_value), coalesce(p_source,'coach'), p_expires, coalesce(p_sensitive,false), p_due, true)
  on conflict (user_id, scope, category, key) do update
    set value = excluded.value, source = excluded.source, expires_at = excluded.expires_at, sensitive = excluded.sensitive,
        due_at = excluded.due_at, open = true, updated_at = now()
  returning * into r;
  return r;
end $$;
grant execute on function public.coach_memory_put(text,text,text,text,text,timestamptz,boolean,timestamptz) to authenticated;

-- Tidy: expired rows are deleted (they already stopped counting when they expired).
create or replace function public.coach_memory_sweep()
returns int language sql security invoker set search_path = public as $$
  with d as (delete from public.coach_memory where user_id = auth.uid() and expires_at is not null and expires_at <= now() returning 1)
  select count(*)::int from d
$$;
grant execute on function public.coach_memory_sweep() to authenticated;

select 'CR064 done: Coach Memory is ready.' as done;
