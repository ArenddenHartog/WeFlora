-- Vault Review Queue RPC
-- Returns items that need review (pending, needs_review status)

-- Add status column to vault_objects if not exists
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'vault_objects' 
    and column_name = 'status'
  ) then
    alter table public.vault_objects 
    add column status text not null default 'pending' 
    check (status in ('draft', 'pending', 'needs_review', 'in_review', 'accepted', 'blocked'));
  end if;
end $$;

-- Add record_type column if not exists
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'vault_objects' 
    and column_name = 'record_type'
  ) then
    alter table public.vault_objects 
    add column record_type text null;
  end if;
end $$;

-- Add title column if not exists (separate from filename)
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'vault_objects' 
    and column_name = 'title'
  ) then
    alter table public.vault_objects 
    add column title text null;
  end if;
end $$;

-- Add description column if not exists
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'vault_objects' 
    and column_name = 'description'
  ) then
    alter table public.vault_objects 
    add column description text null;
  end if;
end $$;

-- Add relevance column if not exists
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'vault_objects' 
    and column_name = 'relevance'
  ) then
    alter table public.vault_objects 
    add column relevance numeric null;
  end if;
end $$;

-- Create the review queue RPC
create or replace function public.vault_review_queue(
  p_limit int default 50
)
returns table(
  id uuid,
  owner_user_id uuid,
  filename text,
  title text,
  description text,
  record_type text,
  mime_type text,
  size_bytes bigint,
  confidence numeric,
  relevance numeric,
  status text,
  storage_bucket text,
  storage_path text,
  tags text[],
  created_at timestamptz,
  updated_at timestamptz,
  issues text[]
)
language sql
stable
security definer
as $$
  select 
    v.id,
    v.owner_user_id,
    v.filename,
    v.title,
    v.description,
    v.record_type,
    v.mime_type,
    v.size_bytes,
    v.confidence,
    v.relevance,
    v.status,
    v.storage_bucket,
    v.storage_path,
    v.tags,
    v.created_at,
    v.updated_at,
    -- Compute issues array
    array_remove(array[
      case when v.sha256 is null then 'Checksum missing' else null end,
      case when v.tags is null or array_length(v.tags, 1) is null or array_length(v.tags, 1) = 0 then 'No tags assigned' else null end,
      case when v.confidence is null then 'Confidence not set' else null end,
      case when v.record_type is null then 'Record type not set' else null end,
      case when v.title is null or v.title = '' then 'Title not set' else null end
    ], null) as issues
  from public.vault_objects v
  where v.owner_user_id = auth.uid()
    and v.status in ('pending', 'needs_review')
    -- Exclude items currently being reviewed
    and not exists (
      select 1 from public.vault_reviews r
      where r.vault_id = v.id
        and r.status = 'in_progress'
    )
  order by
    -- Prioritize: items with more issues first
    case when v.confidence is null then 0 else 1 end,
    v.confidence asc nulls first,
    v.created_at asc
  limit p_limit;
$$;

-- Grant permissions
grant execute on function public.vault_review_queue(int) to authenticated;

comment on function public.vault_review_queue(int) is 
  'Returns vault objects that are pending review (status = pending or needs_review). 
   Excludes items currently in_review by another reviewer.';

-- Update vault_claim_next_review to set status to in_review
create or replace function public.vault_claim_next_review()
returns table(
  id uuid,
  filename text,
  title text,
  description text,
  record_type text,
  mime_type text,
  size_bytes bigint,
  confidence numeric,
  relevance numeric,
  status text,
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
  -- Find next item needing review that isn't already being reviewed
  select v.id into v_vault_id
  from public.vault_objects v
  where v.owner_user_id = auth.uid()
    and v.status in ('pending', 'needs_review')
    and not exists (
      select 1 from public.vault_reviews r
      where r.vault_id = v.id
        and r.status = 'in_progress'
    )
  order by 
    case when v.confidence is null then 0 else 1 end,
    v.confidence asc,
    v.created_at asc
  limit 1
  for update skip locked;

  if v_vault_id is null then
    return;
  end if;

  -- Update vault object status to in_review
  update public.vault_objects
  set status = 'in_review',
      updated_at = now()
  where vault_objects.id = v_vault_id;

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
    v.title,
    v.description,
    v.record_type,
    v.mime_type,
    v.size_bytes,
    v.confidence,
    v.relevance,
    v.status,
    v.storage_bucket,
    v.storage_path,
    v.tags,
    v.created_at
  from public.vault_objects v
  where v.id = v_vault_id;
end;
$$;

-- Enhanced vault_update_review that also updates vault_objects status
create or replace function public.vault_update_review(
  p_id uuid,
  p_record_type text default null,
  p_title text default null,
  p_description text default null,
  p_tags text[] default null,
  p_confidence numeric default null,
  p_relevance numeric default null,
  p_status text default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_review_id uuid;
  v_old_confidence numeric;
  v_new_status text;
begin
  -- Map review action to vault status
  v_new_status := case p_status
    when 'accepted' then 'accepted'
    when 'blocked' then 'blocked'
    when 'needs_review' then 'needs_review'
    when 'draft' then 'draft'
    else null
  end;

  -- Get the current in_progress review (if any)
  select r.id, r.previous_confidence into v_review_id, v_old_confidence
  from public.vault_reviews r
  where r.vault_id = p_id
    and r.reviewer_id = auth.uid()
    and r.status = 'in_progress'
  order by r.created_at desc
  limit 1;

  -- Update the vault object
  update public.vault_objects
  set 
    record_type = coalesce(p_record_type, record_type),
    title = coalesce(p_title, title),
    description = coalesce(p_description, description),
    tags = coalesce(p_tags, tags),
    confidence = coalesce(p_confidence, confidence),
    relevance = coalesce(p_relevance, relevance),
    status = coalesce(v_new_status, status),
    updated_at = now()
  where id = p_id
    and owner_user_id = auth.uid();

  -- Complete the review if we have one
  if v_review_id is not null and v_new_status in ('accepted', 'blocked', 'needs_review') then
    update public.vault_reviews
    set 
      status = case v_new_status 
        when 'accepted' then 'approved'
        when 'blocked' then 'rejected'
        else 'deferred'
      end,
      notes = p_description,
      new_confidence = p_confidence,
      completed_at = now()
    where id = v_review_id;
  end if;

  return jsonb_build_object(
    'success', true,
    'vault_id', p_id,
    'new_status', v_new_status,
    'review_id', v_review_id
  );
end;
$$;

grant execute on function public.vault_update_review(uuid, text, text, text, text[], numeric, numeric, text) to authenticated;

comment on function public.vault_update_review(uuid, text, text, text, text[], numeric, numeric, text) is 
  'Updates a vault object with review data. Updates record_type, title, description, tags, confidence, relevance, and status.';

-- Function to get a single vault object for review
create or replace function public.vault_get_for_review(p_id uuid)
returns table(
  id uuid,
  owner_user_id uuid,
  filename text,
  title text,
  description text,
  record_type text,
  mime_type text,
  size_bytes bigint,
  sha256 text,
  confidence numeric,
  relevance numeric,
  status text,
  storage_bucket text,
  storage_path text,
  tags text[],
  created_at timestamptz,
  updated_at timestamptz,
  issues text[]
)
language sql
stable
security definer
as $$
  select 
    v.id,
    v.owner_user_id,
    v.filename,
    v.title,
    v.description,
    v.record_type,
    v.mime_type,
    v.size_bytes,
    v.sha256,
    v.confidence,
    v.relevance,
    v.status,
    v.storage_bucket,
    v.storage_path,
    v.tags,
    v.created_at,
    v.updated_at,
    array_remove(array[
      case when v.sha256 is null then 'Checksum missing' else null end,
      case when v.tags is null or array_length(v.tags, 1) is null or array_length(v.tags, 1) = 0 then 'No tags assigned' else null end,
      case when v.confidence is null then 'Confidence not set' else null end,
      case when v.record_type is null then 'Record type not set' else null end,
      case when v.title is null or v.title = '' then 'Title not set' else null end
    ], null) as issues
  from public.vault_objects v
  where v.id = p_id
    and v.owner_user_id = auth.uid();
$$;

grant execute on function public.vault_get_for_review(uuid) to authenticated;

comment on function public.vault_get_for_review(uuid) is 
  'Gets a single vault object by ID for review purposes.';
