-- Vector schema for embeddings + governance metadata
-- Requires pgvector extension in Supabase

create extension if not exists vector;

create table if not exists species_embeddings (
  id uuid primary key default gen_random_uuid(),
  species_id uuid not null,
  chunk_id text not null,
  content text not null,
  embedding vector(1536) not null,
  source text not null default 'canonical',
  version text,
  updated_at timestamptz default now()
);

create index if not exists species_embeddings_embedding_idx
  on species_embeddings using ivfflat (embedding vector_cosine_ops);

create table if not exists document_embeddings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  project_id uuid,
  file_id uuid not null,
  chunk_id text not null,
  content text not null,
  embedding vector(1536) not null,
  origin text not null default 'user',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists document_embeddings_embedding_idx
  on document_embeddings using ivfflat (embedding vector_cosine_ops);

create table if not exists web_embeddings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  query text,
  url text not null,
  domain text,
  fetched_at timestamptz default now(),
  crawl_version text,
  content text not null,
  embedding vector(1536) not null,
  origin text not null default 'web',
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists web_embeddings_embedding_idx
  on web_embeddings using ivfflat (embedding vector_cosine_ops);

-- Enable row-level security
alter table species_embeddings enable row level security;
alter table document_embeddings enable row level security;
alter table web_embeddings enable row level security;

-- Species embeddings: allow read to authenticated users (adjust as needed)
drop policy if exists "species_embeddings_read" on species_embeddings;
create policy "species_embeddings_read" on species_embeddings
  for select
  to authenticated
  using (true);

-- Document embeddings: user-scoped access
drop policy if exists "document_embeddings_rw" on document_embeddings;
create policy "document_embeddings_rw" on document_embeddings
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Web embeddings: allow read to authenticated users (adjust for shared vs per-user)
drop policy if exists "web_embeddings_read" on web_embeddings;
create policy "web_embeddings_read" on web_embeddings
  for select
  to authenticated
  using (user_id is null or auth.uid() = user_id);
