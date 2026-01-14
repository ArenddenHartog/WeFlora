-- =========================================================
-- PCIV v1.x: Scope membership + membership-based RLS + bootstrap RPC
-- =========================================================

-- 0) Membership table
create table if not exists public.pciv_scope_members (
  scope_id    text not null,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null,
  granted_by  uuid null references auth.users(id) on delete set null,
  granted_at  timestamptz not null default timezone('utc'::text, now()),

  constraint pciv_scope_members_role_check
    check (role in ('owner','editor','viewer')),

  constraint pciv_scope_members_pkey
    primary key (scope_id, user_id)
);

create index if not exists pciv_scope_members_scope_id_idx
  on public.pciv_scope_members(scope_id);

create index if not exists pciv_scope_members_user_id_idx
  on public.pciv_scope_members(user_id);

-- 1) Helpers: role rank + membership predicate
create or replace function public.pciv_role_rank(role text)
returns int
language sql
immutable
as $$
  select case role
    when 'viewer' then 10
    when 'editor' then 20
    when 'owner'  then 30
    else 0
  end;
$$;

-- SECURITY DEFINER so it can be used inside RLS without recursion issues.
create or replace function public.pciv_has_scope_role(p_scope_id text, p_min_role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.pciv_scope_members m
    where m.scope_id = p_scope_id
      and m.user_id = auth.uid()
      and public.pciv_role_rank(m.role) >= public.pciv_role_rank(p_min_role)
  );
$$;

-- 2) Guard: prevent removing/downgrading the last owner
create or replace function public.pciv_scope_members_prevent_last_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_count int;
begin
  if (tg_op = 'DELETE' and old.role = 'owner') then
    select count(*)
      into owner_count
    from public.pciv_scope_members
    where scope_id = old.scope_id
      and role = 'owner'
      and user_id <> old.user_id;

    if owner_count = 0 then
      raise exception 'pciv_scope_members_last_owner_forbidden'
        using errcode = '23514';
    end if;
  end if;

  if (tg_op = 'UPDATE' and old.role = 'owner' and new.role <> 'owner') then
    select count(*)
      into owner_count
    from public.pciv_scope_members
    where scope_id = old.scope_id
      and role = 'owner'
      and user_id <> old.user_id;

    if owner_count = 0 then
      raise exception 'pciv_scope_members_last_owner_forbidden'
        using errcode = '23514';
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists pciv_scope_members_last_owner_guard on public.pciv_scope_members;
create trigger pciv_scope_members_last_owner_guard
before update or delete on public.pciv_scope_members
for each row execute function public.pciv_scope_members_prevent_last_owner();

-- 3) RLS for membership table
alter table public.pciv_scope_members enable row level security;

drop policy if exists pciv_scope_members_select_self_scope on public.pciv_scope_members;
create policy pciv_scope_members_select_self_scope
on public.pciv_scope_members
for select
to authenticated
using (public.pciv_has_scope_role(scope_id, 'viewer'));

drop policy if exists pciv_scope_members_insert_owner_only on public.pciv_scope_members;
create policy pciv_scope_members_insert_owner_only
on public.pciv_scope_members
for insert
to authenticated
with check (
  public.pciv_has_scope_role(scope_id, 'owner')
  and (granted_by is null or granted_by = auth.uid())
);

drop policy if exists pciv_scope_members_update_owner_only on public.pciv_scope_members;
create policy pciv_scope_members_update_owner_only
on public.pciv_scope_members
for update
to authenticated
using (public.pciv_has_scope_role(scope_id, 'owner'))
with check (public.pciv_has_scope_role(scope_id, 'owner'));

drop policy if exists pciv_scope_members_delete_owner_only on public.pciv_scope_members;
create policy pciv_scope_members_delete_owner_only
on public.pciv_scope_members
for delete
to authenticated
using (public.pciv_has_scope_role(scope_id, 'owner'));

-- 4) Tighten ALL PCIV table RLS to membership-based
--    Roles:
--      - viewer: read
--      - editor: write child rows (sources/inputs/constraints/artifacts/links) + create/commit runs
--      - owner : delete runs (and thus cascade delete everything)
--    Note: You can later choose to require owner for commit if you want, but this is minimal + practical.

-- Ensure RLS is enabled
alter table public.pciv_runs enable row level security;
alter table public.pciv_sources enable row level security;
alter table public.pciv_inputs enable row level security;
alter table public.pciv_input_sources enable row level security;
alter table public.pciv_constraints enable row level security;
alter table public.pciv_artifacts enable row level security;

-- ---- pciv_runs ----
drop policy if exists pciv_runs_select_owned on public.pciv_runs;
drop policy if exists pciv_runs_select_shared_auth on public.pciv_runs;
drop policy if exists pciv_runs_select_shared_anon on public.pciv_runs;
drop policy if exists pciv_runs_insert_owned on public.pciv_runs;
drop policy if exists pciv_runs_insert_shared on public.pciv_runs;
drop policy if exists pciv_runs_update_owned on public.pciv_runs;
drop policy if exists pciv_runs_update_shared on public.pciv_runs;
drop policy if exists pciv_runs_delete_owned on public.pciv_runs;
drop policy if exists pciv_runs_delete_shared on public.pciv_runs;

create policy pciv_runs_select_member_view
on public.pciv_runs
for select
to authenticated
using (public.pciv_has_scope_role(scope_id, 'viewer'));

create policy pciv_runs_insert_member_edit
on public.pciv_runs
for insert
to authenticated
with check (public.pciv_has_scope_role(scope_id, 'editor'));

create policy pciv_runs_update_member_edit
on public.pciv_runs
for update
to authenticated
using (public.pciv_has_scope_role(scope_id, 'editor'))
with check (public.pciv_has_scope_role(scope_id, 'editor'));

create policy pciv_runs_delete_owner_only
on public.pciv_runs
for delete
to authenticated
using (public.pciv_has_scope_role(scope_id, 'owner'));

-- ---- pciv_sources ----
drop policy if exists pciv_sources_select on public.pciv_sources;
drop policy if exists pciv_sources_insert_owned on public.pciv_sources;
drop policy if exists pciv_sources_insert_shared on public.pciv_sources;
drop policy if exists pciv_sources_update_owned on public.pciv_sources;
drop policy if exists pciv_sources_update_shared on public.pciv_sources;
drop policy if exists pciv_sources_delete_owned on public.pciv_sources;
drop policy if exists pciv_sources_delete_shared on public.pciv_sources;

create policy pciv_sources_select_member_view
on public.pciv_sources
for select
to authenticated
using (
  public.pciv_has_scope_role(
    (select r.scope_id from public.pciv_runs r where r.id = pciv_sources.run_id),
    'viewer'
  )
);

create policy pciv_sources_insert_member_edit
on public.pciv_sources
for insert
to authenticated
with check (
  public.pciv_has_scope_role(
    (select r.scope_id from public.pciv_runs r where r.id = pciv_sources.run_id),
    'editor'
  )
);

create policy pciv_sources_update_member_edit
on public.pciv_sources
for update
to authenticated
using (
  public.pciv_has_scope_role(
    (select r.scope_id from public.pciv_runs r where r.id = pciv_sources.run_id),
    'editor'
  )
)
with check (
  public.pciv_has_scope_role(
    (select r.scope_id from public.pciv_runs r where r.id = pciv_sources.run_id),
    'editor'
  )
);

create policy pciv_sources_delete_member_edit
on public.pciv_sources
for delete
to authenticated
using (
  public.pciv_has_scope_role(
    (select r.scope_id from public.pciv_runs r where r.id = pciv_sources.run_id),
    'editor'
  )
);

-- ---- pciv_inputs ----
drop policy if exists pciv_inputs_select on public.pciv_inputs;
drop policy if exists pciv_inputs_insert_owned on public.pciv_inputs;
drop policy if exists pciv_inputs_insert_shared on public.pciv_inputs;
drop policy if exists pciv_inputs_update_owned on public.pciv_inputs;
drop policy if exists pciv_inputs_update_shared on public.pciv_inputs;
drop policy if exists pciv_inputs_delete_owned on public.pciv_inputs;
drop policy if exists pciv_inputs_delete_shared on public.pciv_inputs;

create policy pciv_inputs_select_member_view
on public.pciv_inputs
for select
to authenticated
using (
  public.pciv_has_scope_role(
    (select r.scope_id from public.pciv_runs r where r.id = pciv_inputs.run_id),
    'viewer'
  )
);

create policy pciv_inputs_insert_member_edit
on public.pciv_inputs
for insert
to authenticated
with check (
  public.pciv_has_scope_role(
    (select r.scope_id from public.pciv_runs r where r.id = pciv_inputs.run_id),
    'editor'
  )
);

create policy pciv_inputs_update_member_edit
on public.pciv_inputs
for update
to authenticated
using (
  public.pciv_has_scope_role(
    (select r.scope_id from public.pciv_runs r where r.id = pciv_inputs.run_id),
    'editor'
  )
)
with check (
  public.pciv_has_scope_role(
    (select r.scope_id from public.pciv_runs r where r.id = pciv_inputs.run_id),
    'editor'
  )
);

create policy pciv_inputs_delete_member_edit
on public.pciv_inputs
for delete
to authenticated
using (
  public.pciv_has_scope_role(
    (select r.scope_id from public.pciv_runs r where r.id = pciv_inputs.run_id),
    'editor'
  )
);

-- ---- pciv_constraints ----
drop policy if exists pciv_constraints_select on public.pciv_constraints;
drop policy if exists pciv_constraints_insert_owned on public.pciv_constraints;
drop policy if exists pciv_constraints_insert_shared on public.pciv_constraints;
drop policy if exists pciv_constraints_update_owned on public.pciv_constraints;
drop policy if exists pciv_constraints_update_shared on public.pciv_constraints;
drop policy if exists pciv_constraints_delete_owned on public.pciv_constraints;
drop policy if exists pciv_constraints_delete_shared on public.pciv_constraints;

create policy pciv_constraints_select_member_view
on public.pciv_constraints
for select
to authenticated
using (
  public.pciv_has_scope_role(
    (select r.scope_id from public.pciv_runs r where r.id = pciv_constraints.run_id),
    'viewer'
  )
);

create policy pciv_constraints_insert_member_edit
on public.pciv_constraints
for insert
to authenticated
with check (
  public.pciv_has_scope_role(
    (select r.scope_id from public.pciv_runs r where r.id = pciv_constraints.run_id),
    'editor'
  )
);

create policy pciv_constraints_update_member_edit
on public.pciv_constraints
for update
to authenticated
using (
  public.pciv_has_scope_role(
    (select r.scope_id from public.pciv_runs r where r.id = pciv_constraints.run_id),
    'editor'
  )
)
with check (
  public.pciv_has_scope_role(
    (select r.scope_id from public.pciv_runs r where r.id = pciv_constraints.run_id),
    'editor'
  )
);

create policy pciv_constraints_delete_member_edit
on public.pciv_constraints
for delete
to authenticated
using (
  public.pciv_has_scope_role(
    (select r.scope_id from public.pciv_runs r where r.id = pciv_constraints.run_id),
    'editor'
  )
);

-- ---- pciv_artifacts ----
drop policy if exists pciv_artifacts_select on public.pciv_artifacts;
drop policy if exists pciv_artifacts_insert_owned on public.pciv_artifacts;
drop policy if exists pciv_artifacts_insert_shared on public.pciv_artifacts;
drop policy if exists pciv_artifacts_update_owned on public.pciv_artifacts;
drop policy if exists pciv_artifacts_update_shared on public.pciv_artifacts;
drop policy if exists pciv_artifacts_delete_owned on public.pciv_artifacts;
drop policy if exists pciv_artifacts_delete_shared on public.pciv_artifacts;

create policy pciv_artifacts_select_member_view
on public.pciv_artifacts
for select
to authenticated
using (
  public.pciv_has_scope_role(
    (select r.scope_id from public.pciv_runs r where r.id = pciv_artifacts.run_id),
    'viewer'
  )
);

create policy pciv_artifacts_insert_member_edit
on public.pciv_artifacts
for insert
to authenticated
with check (
  public.pciv_has_scope_role(
    (select r.scope_id from public.pciv_runs r where r.id = pciv_artifacts.run_id),
    'editor'
  )
);

create policy pciv_artifacts_update_member_edit
on public.pciv_artifacts
for update
to authenticated
using (
  public.pciv_has_scope_role(
    (select r.scope_id from public.pciv_runs r where r.id = pciv_artifacts.run_id),
    'editor'
  )
)
with check (
  public.pciv_has_scope_role(
    (select r.scope_id from public.pciv_runs r where r.id = pciv_artifacts.run_id),
    'editor'
  )
);

create policy pciv_artifacts_delete_member_edit
on public.pciv_artifacts
for delete
to authenticated
using (
  public.pciv_has_scope_role(
    (select r.scope_id from public.pciv_runs r where r.id = pciv_artifacts.run_id),
    'editor'
  )
);

-- ---- pciv_input_sources (join table) ----
drop policy if exists pciv_input_sources_select on public.pciv_input_sources;
drop policy if exists pciv_input_sources_insert_owned on public.pciv_input_sources;
drop policy if exists pciv_input_sources_insert_shared on public.pciv_input_sources;
drop policy if exists pciv_input_sources_delete_owned on public.pciv_input_sources;
drop policy if exists pciv_input_sources_delete_shared on public.pciv_input_sources;

create policy pciv_input_sources_select_member_view
on public.pciv_input_sources
for select
to authenticated
using (
  public.pciv_has_scope_role(
    (select r.scope_id
     from public.pciv_inputs i
     join public.pciv_runs r on r.id = i.run_id
     where i.id = pciv_input_sources.input_id),
    'viewer'
  )
);

create policy pciv_input_sources_insert_member_edit
on public.pciv_input_sources
for insert
to authenticated
with check (
  public.pciv_has_scope_role(
    (select r.scope_id
     from public.pciv_inputs i
     join public.pciv_runs r on r.id = i.run_id
     where i.id = pciv_input_sources.input_id),
    'editor'
  )
);

create policy pciv_input_sources_delete_member_edit
on public.pciv_input_sources
for delete
to authenticated
using (
  public.pciv_has_scope_role(
    (select r.scope_id
     from public.pciv_inputs i
     join public.pciv_runs r on r.id = i.run_id
     where i.id = pciv_input_sources.input_id),
    'editor'
  )
);

-- 5) Bootstrap RPC: create scope + first owner (+ optional initial draft run)
--    - Auth required
--    - Refuses to bootstrap if scope already has any members
--    - Inserts membership owner row for auth.uid()
--    - Optionally inserts an initial draft run and returns its id
create or replace function public.pciv_bootstrap_scope(p_scope_id text, p_create_draft_run boolean default true)
returns table(scope_id text, run_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_exists boolean;
  v_run_id uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'pciv_auth_required' using errcode = '42501';
  end if;

  if p_scope_id is null or length(trim(p_scope_id)) = 0 then
    raise exception 'pciv_scope_id_required' using errcode = '22023';
  end if;

  if length(p_scope_id) > 200 then
    raise exception 'pciv_scope_id_too_long' using errcode = '22023';
  end if;

  select exists(
    select 1 from public.pciv_scope_members m where m.scope_id = p_scope_id
  ) into v_exists;

  if v_exists then
    raise exception 'pciv_scope_already_initialized' using errcode = '23505';
  end if;

  -- Create first owner membership
  insert into public.pciv_scope_members(scope_id, user_id, role, granted_by)
  values (p_scope_id, v_uid, 'owner', v_uid);

  if p_create_draft_run then
    v_run_id := gen_random_uuid();
    insert into public.pciv_runs(id, scope_id, user_id, status, allow_partial, committed_at, created_at, updated_at)
    values (v_run_id, p_scope_id, v_uid, 'draft', false, null, timezone('utc'::text, now()), timezone('utc'::text, now()));
  else
    v_run_id := null;
  end if;

  scope_id := p_scope_id;
  run_id := v_run_id;
  return next;
end;
$$;

revoke all on function public.pciv_bootstrap_scope(text, boolean) from public;
grant execute on function public.pciv_bootstrap_scope(text, boolean) to authenticated;
