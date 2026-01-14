-- PCIV v1.4 — A3: membership-based authorization (pciv_scope_members + tighten RLS)
-- Drop-in SQL. Safe to run once; idempotent where possible.

begin;

-- 0) Extensions (gen_random_uuid)
create extension if not exists pgcrypto;

-- 1) pciv_scope_members (membership authority table)
create table if not exists public.pciv_scope_members (
  id uuid primary key default gen_random_uuid(),
  scope_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  unique (scope_id, user_id),
  constraint pciv_scope_members_role_check
    check (role = any (array['owner','editor','viewer']))
);

create index if not exists pciv_scope_members_scope_id_idx on public.pciv_scope_members (scope_id);
create index if not exists pciv_scope_members_user_id_idx on public.pciv_scope_members (user_id);

-- 2) Helper functions (membership checks)
-- IMPORTANT: Use stable + security invoker semantics. RLS will evaluate with caller identity.
create or replace function public.pciv_is_member(_scope_id text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.pciv_scope_members m
    where m.scope_id = _scope_id
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.pciv_has_role(_scope_id text, _roles text[])
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.pciv_scope_members m
    where m.scope_id = _scope_id
      and m.user_id = auth.uid()
      and m.role = any (_roles)
  );
$$;

-- 3) Enable RLS (do not assume it's enabled already)
alter table public.pciv_scope_members enable row level security;
alter table public.pciv_runs enable row level security;
alter table public.pciv_sources enable row level security;
alter table public.pciv_inputs enable row level security;
alter table public.pciv_constraints enable row level security;
alter table public.pciv_artifacts enable row level security;
alter table public.pciv_input_sources enable row level security;

-- 4) Drop all prior PCIV policies (tighten: membership-based only)
-- NOTE: If some policies don't exist, postgres errors; use DO blocks for safety.

do $$
declare
  r record;
begin
  -- Drop policies across pciv_* tables
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'pciv_scope_members',
        'pciv_runs','pciv_sources','pciv_inputs','pciv_constraints','pciv_artifacts','pciv_input_sources'
      )
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- 5) pciv_scope_members RLS
-- Only members can see members for scopes they belong to.
create policy pciv_scope_members_select
on public.pciv_scope_members
for select
to authenticated
using (public.pciv_is_member(scope_id));

-- Only owners can manage membership (insert/update/delete).
create policy pciv_scope_members_insert_owner
on public.pciv_scope_members
for insert
to authenticated
with check (public.pciv_has_role(scope_id, array['owner']));

create policy pciv_scope_members_update_owner
on public.pciv_scope_members
for update
to authenticated
using (public.pciv_has_role(scope_id, array['owner']))
with check (public.pciv_has_role(scope_id, array['owner']));

create policy pciv_scope_members_delete_owner
on public.pciv_scope_members
for delete
to authenticated
using (public.pciv_has_role(scope_id, array['owner']));

-- 6) pciv_runs RLS (membership-based)
-- Read: any member (viewer/editor/owner)
create policy pciv_runs_select_member
on public.pciv_runs
for select
to authenticated
using (public.pciv_is_member(scope_id));

-- Insert: editor+ (owner/editor)
-- Also enforce user_id is set to auth.uid() OR null (shared run), but membership required either way.
create policy pciv_runs_insert_editor
on public.pciv_runs
for insert
to authenticated
with check (
  public.pciv_has_role(scope_id, array['owner','editor'])
  and (user_id is null or user_id = auth.uid())
);

-- Update/Delete: editor+ AND (if user_id is not null, must match auth.uid()).
-- This prevents editing someone else's owned run even within same scope.
create policy pciv_runs_update_editor
on public.pciv_runs
for update
to authenticated
using (
  public.pciv_has_role(scope_id, array['owner','editor'])
  and (user_id is null or user_id = auth.uid())
)
with check (
  public.pciv_has_role(scope_id, array['owner','editor'])
  and (user_id is null or user_id = auth.uid())
);

create policy pciv_runs_delete_editor
on public.pciv_runs
for delete
to authenticated
using (
  public.pciv_has_role(scope_id, array['owner','editor'])
  and (user_id is null or user_id = auth.uid())
);

-- 7) Child tables: membership is inferred via run_id → pciv_runs(scope_id)
-- Sources
create policy pciv_sources_select_member
on public.pciv_sources
for select
to authenticated
using (
  exists (
    select 1 from public.pciv_runs r
    where r.id = pciv_sources.run_id
      and public.pciv_is_member(r.scope_id)
  )
);

create policy pciv_sources_insert_editor
on public.pciv_sources
for insert
to authenticated
with check (
  exists (
    select 1 from public.pciv_runs r
    where r.id = pciv_sources.run_id
      and public.pciv_has_role(r.scope_id, array['owner','editor'])
      and (r.user_id is null or r.user_id = auth.uid())
  )
);

create policy pciv_sources_update_editor
on public.pciv_sources
for update
to authenticated
using (
  exists (
    select 1 from public.pciv_runs r
    where r.id = pciv_sources.run_id
      and public.pciv_has_role(r.scope_id, array['owner','editor'])
      and (r.user_id is null or r.user_id = auth.uid())
  )
)
with check (
  exists (
    select 1 from public.pciv_runs r
    where r.id = pciv_sources.run_id
      and public.pciv_has_role(r.scope_id, array['owner','editor'])
      and (r.user_id is null or r.user_id = auth.uid())
  )
);

create policy pciv_sources_delete_editor
on public.pciv_sources
for delete
to authenticated
using (
  exists (
    select 1 from public.pciv_runs r
    where r.id = pciv_sources.run_id
      and public.pciv_has_role(r.scope_id, array['owner','editor'])
      and (r.user_id is null or r.user_id = auth.uid())
  )
);

-- Inputs
create policy pciv_inputs_select_member
on public.pciv_inputs
for select
to authenticated
using (
  exists (
    select 1 from public.pciv_runs r
    where r.id = pciv_inputs.run_id
      and public.pciv_is_member(r.scope_id)
  )
);

create policy pciv_inputs_insert_editor
on public.pciv_inputs
for insert
to authenticated
with check (
  exists (
    select 1 from public.pciv_runs r
    where r.id = pciv_inputs.run_id
      and public.pciv_has_role(r.scope_id, array['owner','editor'])
      and (r.user_id is null or r.user_id = auth.uid())
  )
);

create policy pciv_inputs_update_editor
on public.pciv_inputs
for update
to authenticated
using (
  exists (
    select 1 from public.pciv_runs r
    where r.id = pciv_inputs.run_id
      and public.pciv_has_role(r.scope_id, array['owner','editor'])
      and (r.user_id is null or r.user_id = auth.uid())
  )
)
with check (
  exists (
    select 1 from public.pciv_runs r
    where r.id = pciv_inputs.run_id
      and public.pciv_has_role(r.scope_id, array['owner','editor'])
      and (r.user_id is null or r.user_id = auth.uid())
  )
);

create policy pciv_inputs_delete_editor
on public.pciv_inputs
for delete
to authenticated
using (
  exists (
    select 1 from public.pciv_runs r
    where r.id = pciv_inputs.run_id
      and public.pciv_has_role(r.scope_id, array['owner','editor'])
      and (r.user_id is null or r.user_id = auth.uid())
  )
);

-- Constraints
create policy pciv_constraints_select_member
on public.pciv_constraints
for select
to authenticated
using (
  exists (
    select 1 from public.pciv_runs r
    where r.id = pciv_constraints.run_id
      and public.pciv_is_member(r.scope_id)
  )
);

create policy pciv_constraints_insert_editor
on public.pciv_constraints
for insert
to authenticated
with check (
  exists (
    select 1 from public.pciv_runs r
    where r.id = pciv_constraints.run_id
      and public.pciv_has_role(r.scope_id, array['owner','editor'])
      and (r.user_id is null or r.user_id = auth.uid())
  )
);

create policy pciv_constraints_update_editor
on public.pciv_constraints
for update
to authenticated
using (
  exists (
    select 1 from public.pciv_runs r
    where r.id = pciv_constraints.run_id
      and public.pciv_has_role(r.scope_id, array['owner','editor'])
      and (r.user_id is null or r.user_id = auth.uid())
  )
)
with check (
  exists (
    select 1 from public.pciv_runs r
    where r.id = pciv_constraints.run_id
      and public.pciv_has_role(r.scope_id, array['owner','editor'])
      and (r.user_id is null or r.user_id = auth.uid())
  )
);

create policy pciv_constraints_delete_editor
on public.pciv_constraints
for delete
to authenticated
using (
  exists (
    select 1 from public.pciv_runs r
    where r.id = pciv_constraints.run_id
      and public.pciv_has_role(r.scope_id, array['owner','editor'])
      and (r.user_id is null or r.user_id = auth.uid())
  )
);

-- Artifacts
create policy pciv_artifacts_select_member
on public.pciv_artifacts
for select
to authenticated
using (
  exists (
    select 1 from public.pciv_runs r
    where r.id = pciv_artifacts.run_id
      and public.pciv_is_member(r.scope_id)
  )
);

create policy pciv_artifacts_insert_editor
on public.pciv_artifacts
for insert
to authenticated
with check (
  exists (
    select 1 from public.pciv_runs r
    where r.id = pciv_artifacts.run_id
      and public.pciv_has_role(r.scope_id, array['owner','editor'])
      and (r.user_id is null or r.user_id = auth.uid())
  )
);

create policy pciv_artifacts_update_editor
on public.pciv_artifacts
for update
to authenticated
using (
  exists (
    select 1 from public.pciv_runs r
    where r.id = pciv_artifacts.run_id
      and public.pciv_has_role(r.scope_id, array['owner','editor'])
      and (r.user_id is null or r.user_id = auth.uid())
  )
)
with check (
  exists (
    select 1 from public.pciv_runs r
    where r.id = pciv_artifacts.run_id
      and public.pciv_has_role(r.scope_id, array['owner','editor'])
      and (r.user_id is null or r.user_id = auth.uid())
  )
);

create policy pciv_artifacts_delete_editor
on public.pciv_artifacts
for delete
to authenticated
using (
  exists (
    select 1 from public.pciv_runs r
    where r.id = pciv_artifacts.run_id
      and public.pciv_has_role(r.scope_id, array['owner','editor'])
      and (r.user_id is null or r.user_id = auth.uid())
  )
);

-- Join table pciv_input_sources
-- Select: member of scope via input.run_id
create policy pciv_input_sources_select_member
on public.pciv_input_sources
for select
to authenticated
using (
  exists (
    select 1
    from public.pciv_inputs i
    join public.pciv_runs r on r.id = i.run_id
    where i.id = pciv_input_sources.input_id
      and public.pciv_is_member(r.scope_id)
  )
);

-- Insert/Delete: editor+ via input.run_id
create policy pciv_input_sources_insert_editor
on public.pciv_input_sources
for insert
to authenticated
with check (
  exists (
    select 1
    from public.pciv_inputs i
    join public.pciv_runs r on r.id = i.run_id
    where i.id = pciv_input_sources.input_id
      and public.pciv_has_role(r.scope_id, array['owner','editor'])
      and (r.user_id is null or r.user_id = auth.uid())
  )
);

create policy pciv_input_sources_delete_editor
on public.pciv_input_sources
for delete
to authenticated
using (
  exists (
    select 1
    from public.pciv_inputs i
    join public.pciv_runs r on r.id = i.run_id
    where i.id = pciv_input_sources.input_id
      and public.pciv_has_role(r.scope_id, array['owner','editor'])
      and (r.user_id is null or r.user_id = auth.uid())
  )
);

-- 8) Bootstrap RPC: create scope + first owner (no foot-guns)
-- - Requires authenticated user
-- - Creates membership owner row if not exists
-- - Returns scope_id and membership id
-- - SECURITY DEFINER so it can insert into membership even if future policies change
create or replace function public.pciv_create_scope_owner(_scope_id text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_scope text;
  v_user uuid;
  v_member_id uuid;
begin
  v_user := auth.uid();
  if v_user is null then
    raise exception 'pciv_auth_required' using errcode = '42501';
  end if;

  -- Generate a scope if not provided
  if _scope_id is null or length(trim(_scope_id)) = 0 then
    v_scope := 'pciv-' || replace(gen_random_uuid()::text, '-', '');
  else
    v_scope := _scope_id;
  end if;

  -- Ensure the user becomes owner (idempotent)
  insert into public.pciv_scope_members (scope_id, user_id, role)
  values (v_scope, v_user, 'owner')
  on conflict (scope_id, user_id) do update
    set role = 'owner';

  select id into v_member_id
  from public.pciv_scope_members
  where scope_id = v_scope and user_id = v_user;

  return jsonb_build_object(
    'scope_id', v_scope,
    'user_id', v_user,
    'member_id', v_member_id,
    'role', 'owner'
  );
end;
$$;

revoke all on function public.pciv_create_scope_owner(text) from public;
grant execute on function public.pciv_create_scope_owner(text) to authenticated;

-- Optional: keep pciv_introspect callable
-- (If you already grant this elsewhere, this is harmless.)
grant execute on function public.pciv_introspect() to anon, authenticated;

commit;
