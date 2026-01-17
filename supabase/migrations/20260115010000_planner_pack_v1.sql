-- Planner Pack v1 (Interventions + artifacts)

begin;

create extension if not exists pgcrypto;

-- Core: interventions
create table if not exists public.planner_interventions (
  id uuid primary key default gen_random_uuid(),
  scope_id text not null,
  created_by uuid null references auth.users(id),
  name text not null,
  municipality text null,
  intervention_type text not null,
  status text not null default 'draft',
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint planner_interventions_type_check
    check (intervention_type = any (array['street','park','corridor','district','other'])),
  constraint planner_interventions_status_check
    check (status = any (array['draft','evidence_ready','submission_ready','submitted']))
);

create index if not exists planner_interventions_scope_id_idx on public.planner_interventions (scope_id);

-- Geometry (polygon or corridor)
create table if not exists public.planner_geometries (
  id uuid primary key default gen_random_uuid(),
  intervention_id uuid not null references public.planner_interventions(id) on delete cascade,
  kind text not null,
  geojson jsonb not null,
  corridor_width_m double precision null,
  area_m2 double precision null,
  length_m double precision null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  constraint planner_geometries_kind_check
    check (kind = any (array['polygon','corridor']))
);

create index if not exists planner_geometries_intervention_id_idx on public.planner_geometries (intervention_id);

-- Sources (uploads, baseline, urls)
create table if not exists public.planner_sources (
  id uuid primary key default gen_random_uuid(),
  intervention_id uuid not null references public.planner_interventions(id) on delete cascade,
  kind text not null,
  title text not null,
  uri text null,
  file_id uuid null,
  mime_type text null,
  parse_status text not null default 'pending',
  parse_report jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  constraint planner_sources_kind_check
    check (kind = any (array['upload','url','baseline'])),
  constraint planner_sources_parse_status_check
    check (parse_status = any (array['pending','parsed','partial','failed']))
);

create index if not exists planner_sources_intervention_id_idx on public.planner_sources (intervention_id);

-- Runs
create table if not exists public.planner_runs (
  id uuid primary key default gen_random_uuid(),
  intervention_id uuid not null references public.planner_interventions(id) on delete cascade,
  worker_type text not null,
  status text not null default 'running',
  assumptions jsonb not null default '{}'::jsonb,
  inputs_hash text null,
  started_at timestamptz not null default timezone('utc'::text, now()),
  finished_at timestamptz null,
  constraint planner_runs_worker_type_check
    check (worker_type = any (array['inventory_ingest','planner_pack_compose'])),
  constraint planner_runs_status_check
    check (status = any (array['running','succeeded','failed']))
);

create index if not exists planner_runs_intervention_id_started_at_idx on public.planner_runs (intervention_id, started_at desc);

-- Artifacts
create table if not exists public.planner_artifacts (
  id uuid primary key default gen_random_uuid(),
  intervention_id uuid not null references public.planner_interventions(id) on delete cascade,
  run_id uuid null references public.planner_runs(id) on delete set null,
  type text not null,
  version int not null default 1,
  payload jsonb not null default '{}'::jsonb,
  rendered_html text null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint planner_artifacts_type_check
    check (type = any (array['memo','options','procurement','email_draft','check_report']))
);

create unique index if not exists planner_artifacts_intervention_type_version_idx
  on public.planner_artifacts (intervention_id, type, version);

create index if not exists planner_artifacts_intervention_type_version_desc_idx
  on public.planner_artifacts (intervention_id, type, version desc);

-- RLS helpers
create or replace function public.planner_is_member(_scope_id text)
returns boolean
language sql
stable
as $$
  select coalesce(public.pciv_is_member(_scope_id), false);
$$;

create or replace function public.planner_has_role(_scope_id text, _roles text[])
returns boolean
language sql
stable
as $$
  select coalesce(public.pciv_has_role(_scope_id, _roles), false);
$$;

-- RLS enablement
alter table public.planner_interventions enable row level security;
alter table public.planner_geometries enable row level security;
alter table public.planner_sources enable row level security;
alter table public.planner_runs enable row level security;
alter table public.planner_artifacts enable row level security;

-- Drop existing planner policies if any
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('planner_interventions','planner_geometries','planner_sources','planner_runs','planner_artifacts')
  LOOP
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- Interventions: membership-based
create policy planner_interventions_select_member
on public.planner_interventions
for select
to authenticated
using (public.planner_is_member(scope_id));

create policy planner_interventions_insert_editor
on public.planner_interventions
for insert
to authenticated
with check (public.planner_has_role(scope_id, array['owner','editor']));

create policy planner_interventions_update_editor
on public.planner_interventions
for update
to authenticated
using (public.planner_has_role(scope_id, array['owner','editor']))
with check (public.planner_has_role(scope_id, array['owner','editor']));

create policy planner_interventions_delete_editor
on public.planner_interventions
for delete
to authenticated
using (public.planner_has_role(scope_id, array['owner','editor']));

-- Child tables: membership inferred via intervention
create policy planner_geometries_select_member
on public.planner_geometries
for select
to authenticated
using (
  exists (
    select 1 from public.planner_interventions i
    where i.id = planner_geometries.intervention_id
      and public.planner_is_member(i.scope_id)
  )
);

create policy planner_geometries_insert_editor
on public.planner_geometries
for insert
to authenticated
with check (
  exists (
    select 1 from public.planner_interventions i
    where i.id = planner_geometries.intervention_id
      and public.planner_has_role(i.scope_id, array['owner','editor'])
  )
);

create policy planner_geometries_update_editor
on public.planner_geometries
for update
to authenticated
using (
  exists (
    select 1 from public.planner_interventions i
    where i.id = planner_geometries.intervention_id
      and public.planner_has_role(i.scope_id, array['owner','editor'])
  )
)
with check (
  exists (
    select 1 from public.planner_interventions i
    where i.id = planner_geometries.intervention_id
      and public.planner_has_role(i.scope_id, array['owner','editor'])
  )
);

create policy planner_geometries_delete_editor
on public.planner_geometries
for delete
to authenticated
using (
  exists (
    select 1 from public.planner_interventions i
    where i.id = planner_geometries.intervention_id
      and public.planner_has_role(i.scope_id, array['owner','editor'])
  )
);

create policy planner_sources_select_member
on public.planner_sources
for select
to authenticated
using (
  exists (
    select 1 from public.planner_interventions i
    where i.id = planner_sources.intervention_id
      and public.planner_is_member(i.scope_id)
  )
);

create policy planner_sources_insert_editor
on public.planner_sources
for insert
to authenticated
with check (
  exists (
    select 1 from public.planner_interventions i
    where i.id = planner_sources.intervention_id
      and public.planner_has_role(i.scope_id, array['owner','editor'])
  )
);

create policy planner_sources_update_editor
on public.planner_sources
for update
to authenticated
using (
  exists (
    select 1 from public.planner_interventions i
    where i.id = planner_sources.intervention_id
      and public.planner_has_role(i.scope_id, array['owner','editor'])
  )
)
with check (
  exists (
    select 1 from public.planner_interventions i
    where i.id = planner_sources.intervention_id
      and public.planner_has_role(i.scope_id, array['owner','editor'])
  )
);

create policy planner_sources_delete_editor
on public.planner_sources
for delete
to authenticated
using (
  exists (
    select 1 from public.planner_interventions i
    where i.id = planner_sources.intervention_id
      and public.planner_has_role(i.scope_id, array['owner','editor'])
  )
);

create policy planner_runs_select_member
on public.planner_runs
for select
to authenticated
using (
  exists (
    select 1 from public.planner_interventions i
    where i.id = planner_runs.intervention_id
      and public.planner_is_member(i.scope_id)
  )
);

create policy planner_runs_insert_editor
on public.planner_runs
for insert
to authenticated
with check (
  exists (
    select 1 from public.planner_interventions i
    where i.id = planner_runs.intervention_id
      and public.planner_has_role(i.scope_id, array['owner','editor'])
  )
);

create policy planner_runs_update_editor
on public.planner_runs
for update
to authenticated
using (
  exists (
    select 1 from public.planner_interventions i
    where i.id = planner_runs.intervention_id
      and public.planner_has_role(i.scope_id, array['owner','editor'])
  )
)
with check (
  exists (
    select 1 from public.planner_interventions i
    where i.id = planner_runs.intervention_id
      and public.planner_has_role(i.scope_id, array['owner','editor'])
  )
);

create policy planner_runs_delete_editor
on public.planner_runs
for delete
to authenticated
using (
  exists (
    select 1 from public.planner_interventions i
    where i.id = planner_runs.intervention_id
      and public.planner_has_role(i.scope_id, array['owner','editor'])
  )
);

create policy planner_artifacts_select_member
on public.planner_artifacts
for select
to authenticated
using (
  exists (
    select 1 from public.planner_interventions i
    where i.id = planner_artifacts.intervention_id
      and public.planner_is_member(i.scope_id)
  )
);

create policy planner_artifacts_insert_editor
on public.planner_artifacts
for insert
to authenticated
with check (
  exists (
    select 1 from public.planner_interventions i
    where i.id = planner_artifacts.intervention_id
      and public.planner_has_role(i.scope_id, array['owner','editor'])
  )
);

create policy planner_artifacts_update_editor
on public.planner_artifacts
for update
to authenticated
using (
  exists (
    select 1 from public.planner_interventions i
    where i.id = planner_artifacts.intervention_id
      and public.planner_has_role(i.scope_id, array['owner','editor'])
  )
)
with check (
  exists (
    select 1 from public.planner_interventions i
    where i.id = planner_artifacts.intervention_id
      and public.planner_has_role(i.scope_id, array['owner','editor'])
  )
);

create policy planner_artifacts_delete_editor
on public.planner_artifacts
for delete
to authenticated
using (
  exists (
    select 1 from public.planner_interventions i
    where i.id = planner_artifacts.intervention_id
      and public.planner_has_role(i.scope_id, array['owner','editor'])
  )
);

commit;
