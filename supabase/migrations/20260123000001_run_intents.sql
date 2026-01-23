-- Run intents for idempotent session creation

create table if not exists public.run_intents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  idempotency_key text not null,
  intent jsonb not null,
  session_id uuid not null,
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

alter table public.run_intents enable row level security;

create policy "Run intents service role bypass" on public.run_intents
  for all to service_role using (true) with check (true);

create policy "Run intents select" on public.run_intents
  for select to authenticated
  using (user_id = auth.uid());

create policy "Run intents insert" on public.run_intents
  for insert to authenticated
  with check (user_id = auth.uid());

create or replace function public.create_session_with_idempotency(
  p_idempotency_key text,
  p_intent jsonb
)
returns table (session_id uuid)
language plpgsql
security definer
as $$
begin
  select run_intents.session_id
    into session_id
  from public.run_intents
  where run_intents.user_id = auth.uid()
    and run_intents.idempotency_key = p_idempotency_key
  limit 1;

  if session_id is null then
    insert into public.run_intents (user_id, idempotency_key, intent, session_id)
    values (auth.uid(), p_idempotency_key, p_intent, gen_random_uuid())
    returning run_intents.session_id into session_id;
  end if;

  return next;
end;
$$;
