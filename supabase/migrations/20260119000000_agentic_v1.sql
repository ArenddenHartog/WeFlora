-- Agentic v1: Registry + Runs + Steps + Artifacts

-- Ensure pgcrypto is available for gen_random_uuid
create extension if not exists pgcrypto;

-- Agent profiles
create table if not exists public.agent_profiles (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null,
  spec_version text not null,
  schema_version text not null,
  name text not null,
  category text not null,
  description text not null,
  inputs jsonb not null default '[]'::jsonb,
  output_modes jsonb not null default '["ok","insufficient_data","rejected"]'::jsonb,
  output_schema jsonb not null,
  tags text[] not null default '{}',
  tooling jsonb,
  governance jsonb,
  created_at timestamptz not null default now(),
  unique (agent_id, spec_version)
);

-- Agent runs
create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  scope_id text not null,
  user_id uuid null references auth.users(id),
  title text,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Agent steps
create table if not exists public.agent_steps (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.agent_runs(id) on delete cascade,
  scope_id text not null,
  agent_id text not null,
  agent_version text not null,
  workflow_id text null,
  workflow_version text null,
  workflow_step_id text null,
  status text not null,
  inputs jsonb not null default '{}'::jsonb,
  output jsonb not null,
  metrics jsonb,
  error jsonb,
  created_at timestamptz not null default now(),
  started_at timestamptz null,
  finished_at timestamptz null,
  constraint agent_steps_output_has_mode check (output ? 'mode')
);

create index if not exists agent_steps_run_id_created_at_idx on public.agent_steps (run_id, created_at);
create index if not exists agent_steps_scope_id_created_at_idx on public.agent_steps (scope_id, created_at);

-- Agent artifacts
create table if not exists public.agent_artifacts (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.agent_runs(id) on delete cascade,
  scope_id text not null,
  type text not null,
  title text,
  version int not null,
  status text not null,
  supersedes uuid null references public.agent_artifacts(id),
  derived_from_steps uuid[] not null default '{}',
  content jsonb not null,
  evidence jsonb not null default '[]'::jsonb,
  assumptions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint agent_artifacts_version_min check (version >= 1),
  constraint agent_artifacts_superseded_requires_supersedes check (status <> 'superseded' or supersedes is not null),
  unique (run_id, type, version)
);

create index if not exists agent_artifacts_scope_type_created_at_idx on public.agent_artifacts (scope_id, type, created_at desc);

-- RLS
alter table public.agent_profiles enable row level security;
alter table public.agent_runs enable row level security;
alter table public.agent_steps enable row level security;
alter table public.agent_artifacts enable row level security;

-- Service role bypass
create policy "Agent profiles service role bypass" on public.agent_profiles for all to service_role using (true) with check (true);
create policy "Agent runs service role bypass" on public.agent_runs for all to service_role using (true) with check (true);
create policy "Agent steps service role bypass" on public.agent_steps for all to service_role using (true) with check (true);
create policy "Agent artifacts service role bypass" on public.agent_artifacts for all to service_role using (true) with check (true);

-- Agent profiles: read-only for authenticated
create policy "Agent profiles select" on public.agent_profiles
  for select to authenticated
  using (true);

-- Agent runs: owned or shared
create policy "Agent runs select" on public.agent_runs
  for select to authenticated
  using (user_id = auth.uid() or user_id is null);

create policy "Agent runs insert" on public.agent_runs
  for insert to authenticated
  with check (user_id = auth.uid() or user_id is null);

create policy "Agent runs update" on public.agent_runs
  for update to authenticated
  using (user_id = auth.uid() or user_id is null)
  with check (user_id = auth.uid() or user_id is null);

-- Agent steps: select/insert by run access
create policy "Agent steps select" on public.agent_steps
  for select to authenticated
  using (
    exists (
      select 1 from public.agent_runs
      where agent_runs.id = agent_steps.run_id
      and (agent_runs.user_id = auth.uid() or agent_runs.user_id is null)
    )
  );

create policy "Agent steps insert" on public.agent_steps
  for insert to authenticated
  with check (
    exists (
      select 1 from public.agent_runs
      where agent_runs.id = agent_steps.run_id
      and (agent_runs.user_id = auth.uid() or agent_runs.user_id is null)
    )
  );

-- Agent artifacts: select/insert by run access
create policy "Agent artifacts select" on public.agent_artifacts
  for select to authenticated
  using (
    exists (
      select 1 from public.agent_runs
      where agent_runs.id = agent_artifacts.run_id
      and (agent_runs.user_id = auth.uid() or agent_runs.user_id is null)
    )
  );

create policy "Agent artifacts insert" on public.agent_artifacts
  for insert to authenticated
  with check (
    exists (
      select 1 from public.agent_runs
      where agent_runs.id = agent_artifacts.run_id
      and (agent_runs.user_id = auth.uid() or agent_runs.user_id is null)
    )
  );
