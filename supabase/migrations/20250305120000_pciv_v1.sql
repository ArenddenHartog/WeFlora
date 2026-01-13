create table if not exists public.pciv_runs (
  id uuid primary key default gen_random_uuid(),
  scope_id text not null,
  user_id uuid null,
  status text not null default 'draft',
  allow_partial boolean not null default false,
  committed_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint pciv_runs_status_check check (status in ('draft', 'committed', 'partial_committed'))
);

create index if not exists pciv_runs_scope_id_idx on public.pciv_runs (scope_id);

create table if not exists public.pciv_sources (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.pciv_runs(id) on delete cascade,
  kind text not null,
  title text not null,
  uri text not null,
  file_id uuid null,
  mime_type text null,
  size_bytes bigint null,
  parse_status text not null,
  excerpt text null,
  raw_meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  constraint pciv_sources_kind_check check (kind in ('file', 'url', 'gis', 'api', 'manual')),
  constraint pciv_sources_parse_status_check check (parse_status in ('pending', 'parsed', 'failed', 'unsupported'))
);

create index if not exists pciv_sources_run_id_idx on public.pciv_sources (run_id);

create table if not exists public.pciv_inputs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.pciv_runs(id) on delete cascade,
  pointer text not null,
  label text not null,
  domain text not null,
  required boolean not null default false,
  field_type text not null,
  options text[] null,
  value_kind text not null,
  value_string text null,
  value_number double precision null,
  value_boolean boolean null,
  value_enum text null,
  value_json jsonb null,
  provenance text not null,
  updated_by text not null,
  updated_at timestamptz not null default timezone('utc', now()),
  evidence_snippet text null,
  constraint pciv_inputs_pointer_unique unique (run_id, pointer),
  constraint pciv_inputs_domain_check check (domain in ('site', 'regulatory', 'equity', 'biophysical')),
  constraint pciv_inputs_field_type_check check (field_type in ('text', 'select', 'boolean')),
  constraint pciv_inputs_value_kind_check check (value_kind in ('string', 'number', 'boolean', 'enum', 'json')),
  constraint pciv_inputs_provenance_check check (provenance in ('source-backed', 'model-inferred', 'user-entered', 'unknown')),
  constraint pciv_inputs_updated_by_check check (updated_by in ('user', 'model', 'system'))
);

create index if not exists pciv_inputs_run_id_idx on public.pciv_inputs (run_id);
create index if not exists pciv_inputs_pointer_idx on public.pciv_inputs (pointer);

create table if not exists public.pciv_input_sources (
  input_id uuid not null references public.pciv_inputs(id) on delete cascade,
  source_id uuid not null references public.pciv_sources(id) on delete cascade,
  primary key (input_id, source_id)
);

create table if not exists public.pciv_constraints (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.pciv_runs(id) on delete cascade,
  key text not null,
  domain text not null,
  label text not null,
  value_kind text not null,
  value_string text null,
  value_number double precision null,
  value_boolean boolean null,
  value_enum text null,
  value_json jsonb null,
  provenance text not null,
  source_id uuid null references public.pciv_sources(id) on delete set null,
  snippet text null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint pciv_constraints_domain_check check (domain in ('site', 'regulatory', 'equity', 'biophysical')),
  constraint pciv_constraints_value_kind_check check (value_kind in ('string', 'number', 'boolean', 'enum', 'json')),
  constraint pciv_constraints_provenance_check check (provenance in ('source-backed', 'model-inferred', 'user-entered', 'unknown'))
);

create index if not exists pciv_constraints_run_id_idx on public.pciv_constraints (run_id);

create table if not exists public.pciv_artifacts (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.pciv_runs(id) on delete cascade,
  type text not null,
  title text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists pciv_artifacts_run_id_idx on public.pciv_artifacts (run_id);
