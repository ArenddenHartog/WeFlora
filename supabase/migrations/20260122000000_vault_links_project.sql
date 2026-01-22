-- Vault project linking tables for global vault objects

create table if not exists public.project_vault_links (
  project_id text not null,
  vault_id uuid not null references public.vault_objects(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (project_id, vault_id)
);

create index if not exists project_vault_links_project_idx on public.project_vault_links (project_id, created_at desc);

alter table public.project_vault_links enable row level security;

create policy "Project vault links service role bypass" on public.project_vault_links
  for all to service_role using (true) with check (true);

create policy "Project vault links select" on public.project_vault_links
  for select to authenticated
  using (exists (
    select 1
    from public.projects
    where projects.id = project_vault_links.project_id
      and projects.user_id = auth.uid()
  ));

create policy "Project vault links insert" on public.project_vault_links
  for insert to authenticated
  with check (exists (
    select 1
    from public.projects
    where projects.id = project_vault_links.project_id
      and projects.user_id = auth.uid()
  ));
