-- Flow drafts fix: Auto-set user_id on insert/update
-- This fixes the issue where upsert fails because user_id is NOT NULL but not provided

-- Create trigger function to auto-set user_id
create or replace function public.set_flow_draft_user_id()
returns trigger
language plpgsql
security definer
as $$
begin
  -- Always set user_id to current auth user if not provided
  new.user_id := coalesce(new.user_id, auth.uid());
  
  -- Ensure user_id matches auth user (prevent impersonation)
  if new.user_id != auth.uid() then
    raise exception 'Cannot create/update flow draft for another user';
  end if;
  
  return new;
end;
$$;

-- Drop existing trigger if any
drop trigger if exists set_flow_draft_user_id_trigger on public.flow_drafts;

-- Create trigger for insert and update
create trigger set_flow_draft_user_id_trigger
  before insert or update on public.flow_drafts
  for each row execute function public.set_flow_draft_user_id();

comment on function public.set_flow_draft_user_id() is 
  'Trigger function that auto-sets user_id to current auth user on flow_drafts insert/update';

-- Also add a helper function to upsert flow drafts more easily
create or replace function public.upsert_flow_draft(
  p_flow_id text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_result record;
begin
  insert into public.flow_drafts (user_id, flow_id, payload, updated_at)
  values (auth.uid(), p_flow_id, p_payload, now())
  on conflict (user_id, flow_id)
  do update set
    payload = p_payload,
    updated_at = now()
  returning id, flow_id, updated_at into v_result;

  return jsonb_build_object(
    'success', true,
    'id', v_result.id,
    'flow_id', v_result.flow_id,
    'updated_at', v_result.updated_at
  );
end;
$$;

grant execute on function public.upsert_flow_draft(text, jsonb) to authenticated;

comment on function public.upsert_flow_draft(text, jsonb) is 
  'Upserts a flow draft for the current user. Automatically handles user_id.';

-- Create session with idempotency (referenced in SessionWizard but may not exist)
create or replace function public.create_session_with_idempotency(
  p_idempotency_key text,
  p_intent jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_session_id uuid;
  v_existing_id uuid;
begin
  -- Check for existing session with same idempotency key (within 24 hours)
  select ar.id into v_existing_id
  from public.agent_runs ar
  where ar.user_id = auth.uid()
    and ar.title = p_idempotency_key
    and ar.created_at > now() - interval '24 hours'
  limit 1;

  if v_existing_id is not null then
    return jsonb_build_object(
      'session_id', v_existing_id,
      'idempotent', true
    );
  end if;

  -- Create new session
  insert into public.agent_runs (scope_id, user_id, title, status)
  values (
    coalesce(p_intent->>'scope_id', 'default'),
    auth.uid(),
    p_idempotency_key,
    'running'
  )
  returning id into v_session_id;

  return jsonb_build_object(
    'session_id', v_session_id,
    'idempotent', false
  );
end;
$$;

grant execute on function public.create_session_with_idempotency(text, jsonb) to authenticated;

comment on function public.create_session_with_idempotency(text, jsonb) is 
  'Creates a new session with idempotency key. Returns existing session if duplicate within 24h.';
