-- GainZone core schema (lives next to GrindZone's tables in the same *ZONE Supabase project).
-- Every table is user-scoped (RLS) and sync-friendly:
--   updated_at        -> set by the client, used for last-write-wins
--   deleted           -> soft delete (tombstone); rows are NEVER physically deleted
--   server_updated_at -> set by the server, used as the pull cursor
-- Extra safety for training history:
--   * there is no DELETE policy: the app cannot erase a row, only mark it deleted
--   * every change archives the previous version in gain_history (full audit trail)

create or replace function public.gain_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- server-side last-write-wins: ignore stale updates coming from another device
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    return null;
  end if;
  new.server_updated_at := clock_timestamp();
  return new;
end;
$$;

create table if not exists public.gain_profile (
  id uuid primary key,
  user_id uuid not null default auth.uid(),
  name text not null default '',
  height_cm numeric,
  birth_year smallint,
  sex text,
  goal text,
  weekly_goal smallint not null default 4,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  server_updated_at timestamptz not null default now()
);

create table if not exists public.gain_exercises (
  id uuid primary key,
  user_id uuid not null default auth.uid(),
  name text not null default '',
  name_ru text not null default '',
  grp text not null default 'chest',
  equip text not null default 'other',
  log_type text not null default 'weight_reps',
  muscles jsonb not null default '{}'::jsonb,
  rest integer not null default 120,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  server_updated_at timestamptz not null default now()
);

create table if not exists public.gain_templates (
  id uuid primary key,
  user_id uuid not null default auth.uid(),
  name text not null default '',
  note text not null default '',
  exercises jsonb not null default '[]'::jsonb,
  sort_order double precision not null default 0,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  server_updated_at timestamptz not null default now()
);

create table if not exists public.gain_workouts (
  id uuid primary key,
  user_id uuid not null default auth.uid(),
  template_id uuid,
  name text not null default '',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_sec integer not null default 0,
  exercises jsonb not null default '[]'::jsonb,
  note text not null default '',
  feeling smallint,
  energy smallint,
  bodyweight numeric,
  volume numeric not null default 0,
  sets_count integer not null default 0,
  prs_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  server_updated_at timestamptz not null default now()
);

create table if not exists public.gain_metrics (
  id uuid primary key,
  user_id uuid not null default auth.uid(),
  date date not null,
  weight numeric,
  body_fat numeric,
  waist numeric,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  server_updated_at timestamptz not null default now()
);

-- Every previous version of every row, written by the database itself.
create table if not exists public.gain_history (
  rev_id bigserial primary key,
  table_name text not null,
  row_id uuid not null,
  user_id uuid not null,
  data jsonb not null,
  archived_at timestamptz not null default now()
);
create index if not exists gain_history_user_idx on public.gain_history (user_id, table_name, row_id);
alter table public.gain_history enable row level security;
drop policy if exists "own rows: select" on public.gain_history;
create policy "own rows: select" on public.gain_history for select to authenticated using ((select auth.uid()) = user_id);

create or replace function public.gain_archive()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if to_jsonb(old) - 'server_updated_at' is distinct from to_jsonb(new) - 'server_updated_at' then
    insert into public.gain_history (table_name, row_id, user_id, data)
    values (tg_table_name, old.id, old.user_id, to_jsonb(old));
  end if;
  return new;
end;
$$;
revoke execute on function public.gain_archive() from public, anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['gain_profile', 'gain_exercises', 'gain_templates', 'gain_workouts', 'gain_metrics'] loop
    execute format('create index if not exists %I on public.%I (user_id, server_updated_at)', t || '_user_sync_idx', t);
    execute format('drop trigger if exists %I on public.%I', t || '_touch', t);
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.gain_touch()', t || '_touch', t);
    execute format('drop trigger if exists %I on public.%I', t || '_archive', t);
    execute format('create trigger %I after update on public.%I for each row execute function public.gain_archive()', t || '_archive', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows: select" on public.%I', t);
    execute format('drop policy if exists "own rows: insert" on public.%I', t);
    execute format('drop policy if exists "own rows: update" on public.%I', t);
    execute format('create policy "own rows: select" on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t);
    execute format('create policy "own rows: insert" on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "own rows: update" on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    -- intentionally NO delete policy: training history can never be erased from the app
  end loop;
end;
$$;
