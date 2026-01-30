-- Flow drafts for builder persistence

create table if not exists public.flow_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  flow_id text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, flow_id)
);

create index if not exists flow_drafts_user_idx on public.flow_drafts (user_id, updated_at desc);

alter table public.flow_drafts enable row level security;

create policy "Flow drafts service role bypass" on public.flow_drafts
  for all to service_role using (true) with check (true);

create policy "Flow drafts select" on public.flow_drafts
  for select to authenticated
  using (user_id = auth.uid());

create policy "Flow drafts insert" on public.flow_drafts
  for insert to authenticated
  with check (user_id = auth.uid());

create policy "Flow drafts update" on public.flow_drafts
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
