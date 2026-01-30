-- Vault Inventory v1 view + RPC

create or replace view public.vault_inventory_v1 as
select
  v.id as vault_id,
  v.owner_user_id,
  v.created_at,
  v.updated_at,
  v.filename,
  v.mime_type,
  v.size_bytes,
  v.confidence,
  v.storage_bucket,
  v.storage_path,
  v.source_kind,
  v.tags,
  coalesce(p.project_link_count, 0) as project_link_count,
  coalesce(p.project_ids, '{}'::text[]) as project_ids,
  (v.confidence is not null) as has_confidence,
  false as has_provenance,
  v.confidence as best_confidence,
  v.filename as source_file_name
from public.vault_objects v
left join (
  select vault_id,
    count(*) as project_link_count,
    array_agg(project_id) as project_ids
  from public.project_vault_links
  group by vault_id
) p on p.vault_id = v.id;

create or replace function public.vault_list_inventory(
  p_scope text default null,
  p_limit int default 50,
  p_cursor timestamptz default null
)
returns setof public.vault_inventory_v1
language sql
stable
as $$
  select *
  from public.vault_inventory_v1
  where (p_scope is null or p_scope = any(project_ids))
    and (p_cursor is null or updated_at < p_cursor)
  order by updated_at desc
  limit p_limit;
$$;
