-- Vault storage bucket + policies

insert into storage.buckets (id, name, public)
values ('vault', 'vault', false)
on conflict (id) do nothing;

alter table storage.objects enable row level security;

create policy "Vault storage service role bypass" on storage.objects
  for all to service_role using (true) with check (true);

create policy "Vault storage select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'vault'
    and name like ('vault/global/' || auth.uid()::text || '/%')
  );

create policy "Vault storage insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'vault'
    and name like ('vault/global/' || auth.uid()::text || '/%')
  );

create policy "Vault storage update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'vault'
    and name like ('vault/global/' || auth.uid()::text || '/%')
  )
  with check (
    bucket_id = 'vault'
    and name like ('vault/global/' || auth.uid()::text || '/%')
  );

create policy "Vault storage delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'vault'
    and name like ('vault/global/' || auth.uid()::text || '/%')
  );
