create table if not exists public.context_intake_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null,
  run_id text null,
  status text not null default 'draft',
  draft jsonb not null default '{}'::jsonb,
  commit jsonb null,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.context_intake_runs enable row level security;

create policy "context_intake_runs_owner_select"
on public.context_intake_runs
for select
using (
  auth.uid() = user_id
  and exists (
    select 1 from public.projects
    where public.projects.id = context_intake_runs.project_id
      and public.projects.user_id = auth.uid()
  )
);

create policy "context_intake_runs_owner_insert"
on public.context_intake_runs
for insert
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.projects
    where public.projects.id = context_intake_runs.project_id
      and public.projects.user_id = auth.uid()
  )
);

create policy "context_intake_runs_owner_update"
on public.context_intake_runs
for update
using (
  auth.uid() = user_id
  and exists (
    select 1 from public.projects
    where public.projects.id = context_intake_runs.project_id
      and public.projects.user_id = auth.uid()
  )
);

create policy "context_intake_runs_owner_delete"
on public.context_intake_runs
for delete
using (
  auth.uid() = user_id
  and exists (
    select 1 from public.projects
    where public.projects.id = context_intake_runs.project_id
      and public.projects.user_id = auth.uid()
  )
);
