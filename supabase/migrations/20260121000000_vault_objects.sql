-- Vault objects + links (global storage references)

create extension if not exists pgcrypto;

create table if not exists public.vault_objects (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  filename text not null,
  mime_type text not null,
  size_bytes bigint not null,
  sha256 text null,
  storage_bucket text not null,
  storage_path text not null,
  source_kind text not null default 'upload',
  connector_id text null,
  external_ref text null,
  tags text[] not null default '{}'
);

create table if not exists public.vault_links (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  vault_object_id uuid not null references public.vault_objects(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  label text null
);

create index if not exists vault_objects_owner_idx on public.vault_objects (owner_user_id, created_at desc);
create index if not exists vault_links_project_idx on public.vault_links (project_id, created_at desc);

alter table public.vault_objects enable row level security;
alter table public.vault_links enable row level security;

create policy "Vault objects service role bypass" on public.vault_objects
  for all to service_role using (true) with check (true);

create policy "Vault links service role bypass" on public.vault_links
  for all to service_role using (true) with check (true);

create policy "Vault objects select" on public.vault_objects
  for select to authenticated
  using (owner_user_id = auth.uid());

create policy "Vault objects insert" on public.vault_objects
  for insert to authenticated
  with check (owner_user_id = auth.uid());

create policy "Vault links select" on public.vault_links
  for select to authenticated
  using (created_by = auth.uid());

create policy "Vault links insert" on public.vault_links
  for insert to authenticated
  with check (created_by = auth.uid());
