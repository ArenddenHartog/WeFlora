-- Vault Review RPCs
-- These RPCs support the review queue workflow in /vault/review

-- Optional: Create a vault_reviews table to track review history
-- (Not strictly required, but useful for audit trail)
create table if not exists public.vault_reviews (
  id uuid primary key default gen_random_uuid(),
  vault_id uuid not null references public.vault_objects(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id),
  status text not null check (status in ('in_progress', 'approved', 'rejected', 'deferred')),
  notes text,
  previous_confidence numeric,
  new_confidence numeric,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists vault_reviews_vault_idx on public.vault_reviews (vault_id, created_at desc);
create index if not exists vault_reviews_reviewer_idx on public.vault_reviews (reviewer_id, status);

alter table public.vault_reviews enable row level security;

create policy "Vault reviews service role bypass" on public.vault_reviews
  for all to service_role using (true) with check (true);

create policy "Vault reviews select" on public.vault_reviews
  for select to authenticated
  using (reviewer_id = auth.uid());

create policy "Vault reviews insert" on public.vault_reviews
  for insert to authenticated
  with check (reviewer_id = auth.uid());

create policy "Vault reviews update" on public.vault_reviews
  for update to authenticated
  using (reviewer_id = auth.uid())
  with check (reviewer_id = auth.uid());

-- Claim next review item
-- Returns the next vault object that needs review (low/missing confidence)
-- and creates an in_progress review record
create or replace function public.vault_claim_next_review()
returns table(
  id uuid,
  filename text,
  mime_type text,
  size_bytes bigint,
  confidence numeric,
  storage_bucket text,
  storage_path text,
  tags text[],
  created_at timestamptz
)
language plpgsql
security definer
as $$
declare
  v_vault_id uuid;
begin
  -- Find next item needing review that isn't already being reviewed by this user
  select v.id into v_vault_id
  from public.vault_objects v
  where v.owner_user_id = auth.uid()
    and (v.confidence is null or v.confidence < 0.8)
    and not exists (
      select 1 from public.vault_reviews r
      where r.vault_id = v.id
        and r.reviewer_id = auth.uid()
        and r.status = 'in_progress'
    )
  order by 
    -- Prioritize: no confidence > low confidence
    case when v.confidence is null then 0 else 1 end,
    v.confidence asc,
    v.created_at asc
  limit 1;

  if v_vault_id is null then
    return;
  end if;

  -- Create in_progress review record
  insert into public.vault_reviews (vault_id, reviewer_id, status, previous_confidence)
  select v_vault_id, auth.uid(), 'in_progress', vo.confidence
  from public.vault_objects vo
  where vo.id = v_vault_id;

  -- Return the vault object
  return query
  select 
    v.id,
    v.filename,
    v.mime_type,
    v.size_bytes,
    v.confidence,
    v.storage_bucket,
    v.storage_path,
    v.tags,
    v.created_at
  from public.vault_objects v
  where v.id = v_vault_id;
end;
$$;

-- Update review (approve/reject with optional confidence update)
create or replace function public.vault_update_review(
  p_vault_id uuid,
  p_status text,
  p_confidence numeric default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_review_id uuid;
  v_old_confidence numeric;
begin
  -- Validate status
  if p_status not in ('approved', 'rejected', 'deferred') then
    raise exception 'Invalid status. Must be approved, rejected, or deferred.';
  end if;

  -- Get the current in_progress review
  select r.id, r.previous_confidence into v_review_id, v_old_confidence
  from public.vault_reviews r
  where r.vault_id = p_vault_id
    and r.reviewer_id = auth.uid()
    and r.status = 'in_progress'
  order by r.created_at desc
  limit 1;

  if v_review_id is null then
    raise exception 'No in_progress review found for this vault object.';
  end if;

  -- Update the review record
  update public.vault_reviews
  set 
    status = p_status,
    notes = p_notes,
    new_confidence = p_confidence,
    completed_at = now()
  where id = v_review_id;

  -- Update vault object confidence if provided and approved
  if p_confidence is not null and p_status = 'approved' then
    update public.vault_objects
    set 
      confidence = p_confidence,
      updated_at = now()
    where id = p_vault_id
      and owner_user_id = auth.uid();
  end if;

  return jsonb_build_object(
    'success', true,
    'review_id', v_review_id,
    'vault_id', p_vault_id,
    'status', p_status,
    'old_confidence', v_old_confidence,
    'new_confidence', p_confidence
  );
end;
$$;

-- Get review status for a vault object
create or replace function public.vault_get_review_status(p_vault_id uuid)
returns jsonb
language sql
security definer
stable
as $$
  select jsonb_build_object(
    'vault_id', v.id,
    'confidence', v.confidence,
    'needs_review', (v.confidence is null or v.confidence < 0.8),
    'in_progress_review', (
      select jsonb_build_object(
        'review_id', r.id,
        'started_at', r.created_at
      )
      from public.vault_reviews r
      where r.vault_id = v.id
        and r.reviewer_id = auth.uid()
        and r.status = 'in_progress'
      limit 1
    ),
    'last_review', (
      select jsonb_build_object(
        'review_id', r.id,
        'status', r.status,
        'completed_at', r.completed_at,
        'new_confidence', r.new_confidence
      )
      from public.vault_reviews r
      where r.vault_id = v.id
        and r.reviewer_id = auth.uid()
        and r.status != 'in_progress'
      order by r.completed_at desc
      limit 1
    )
  )
  from public.vault_objects v
  where v.id = p_vault_id
    and v.owner_user_id = auth.uid();
$$;

-- Grant execute permissions
grant execute on function public.vault_claim_next_review() to authenticated;
grant execute on function public.vault_update_review(uuid, text, numeric, text) to authenticated;
grant execute on function public.vault_get_review_status(uuid) to authenticated;

comment on function public.vault_claim_next_review() is 
  'Claims the next vault object needing review and returns its details. Creates an in_progress review record.';

comment on function public.vault_update_review(uuid, text, numeric, text) is 
  'Completes a review with status (approved/rejected/deferred), optional confidence update, and notes.';

comment on function public.vault_get_review_status(uuid) is 
  'Gets the current review status of a vault object including any in-progress or completed reviews.';
