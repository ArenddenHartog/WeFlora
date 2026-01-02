alter table public.messages
  add column if not exists floragpt_payload jsonb null,
  add column if not exists citations jsonb null,
  add column if not exists context_snapshot jsonb null,
  add column if not exists grounding jsonb null,
  add column if not exists suggested_actions jsonb null;
