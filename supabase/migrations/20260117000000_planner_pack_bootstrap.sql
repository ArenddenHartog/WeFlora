-- Planner Pack v1.1 — bootstrap intervention + membership

begin;

create extension if not exists pgcrypto;

-- Bootstrap RPC: ensure membership + create intervention
create or replace function public.planner_bootstrap_intervention(
  p_scope_id text,
  p_name text,
  p_municipality text default null,
  p_intervention_type text default 'corridor'
)
returns table(intervention_id uuid, scope_id text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_scope_exists boolean;
  v_is_member boolean;
  v_has_role boolean;
  v_intervention_id uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'planner_auth_required' using errcode = '42501';
  end if;

  if p_scope_id is null or length(trim(p_scope_id)) = 0 then
    raise exception 'planner_scope_id_required' using errcode = '22023';
  end if;

  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'planner_name_required' using errcode = '22023';
  end if;

  select exists(
    select 1 from public.pciv_scope_members m where m.scope_id = p_scope_id
  ) into v_scope_exists;

  if not v_scope_exists then
    insert into public.pciv_scope_members(scope_id, user_id, role)
    values (p_scope_id, v_uid, 'owner');
  else
    select public.pciv_is_member(p_scope_id) into v_is_member;
    if not v_is_member then
      raise exception 'planner_scope_not_member' using errcode = '42501';
    end if;

    select public.pciv_has_role(p_scope_id, array['owner','editor']) into v_has_role;
    if not v_has_role then
      raise exception 'planner_scope_insufficient_role' using errcode = '42501';
    end if;
  end if;

  v_intervention_id := gen_random_uuid();

  insert into public.planner_interventions(
    id,
    scope_id,
    created_by,
    name,
    municipality,
    intervention_type,
    status,
    created_at,
    updated_at
  ) values (
    v_intervention_id,
    p_scope_id,
    v_uid,
    p_name,
    p_municipality,
    p_intervention_type,
    'draft',
    timezone('utc'::text, now()),
    timezone('utc'::text, now())
  );

  intervention_id := v_intervention_id;
  scope_id := p_scope_id;
  return next;
end;
$$;

revoke all on function public.planner_bootstrap_intervention(text, text, text, text) from public;
grant execute on function public.planner_bootstrap_intervention(text, text, text, text) to authenticated;

commit;
