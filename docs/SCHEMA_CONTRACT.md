# Schema Contract (MVP)

This document is the **source-of-truth** for which Supabase tables/columns the WeFlora client may call during MVP hardening.

## Exists (client may read/write)

### `species`
- **exists**
- **columns used by client (MVP contract)**:
  - `id` (uuid, PK)
  - `species` (text)
  - `common_name` (text)
  - `family` (text, nullable)
  - `tags` (jsonb, nullable)
  - `updated_at` (timestamptz)
  - `genus` (text, nullable)
  - `synonyms` (text, nullable)
  - `order` (text, nullable)
  - `class` (text, nullable)
  - `code` (text, nullable)
  - `form` (text, nullable)
  - `leaf_type` (text, nullable)
  - `growth_rate` (text, nullable)
  - `longevity` (text, nullable)
  - `height_maturity` (numeric, nullable)

### `species_embeddings`
- **exists**
- **columns used by client (MVP contract)**:
  - `id` (uuid, PK)
  - `species_id` (uuid)
  - `chunk_id` (text)
  - `content` (text)
  - `embedding` (vector(1536))
  - `source` (text)
  - `version` (text, nullable)
  - `updated_at` (timestamptz)

### `document_embeddings`
- **exists**
- **columns used by client (MVP contract)**:
  - `id` (uuid, PK)
  - `user_id` (uuid)
  - `project_id` (uuid, nullable)
  - `file_id` (uuid)
  - `chunk_id` (text)
  - `content` (text)
  - `embedding` (vector(1536))
  - `origin` (text)
  - `metadata` (jsonb)
  - `created_at` (timestamptz)

### `web_embeddings`
- **exists**
- **columns used by client (MVP contract)**:
  - `id` (uuid, PK)
  - `user_id` (uuid, nullable)
  - `query` (text, nullable)
  - `url` (text)
  - `domain` (text, nullable)
  - `fetched_at` (timestamptz)
  - `crawl_version` (text, nullable)
  - `content` (text)
  - `embedding` (vector(1536))
  - `origin` (text)
  - `metadata` (jsonb)

### `projects`
- **exists**
- **columns used by client (MVP contract)**:
  - `id` (uuid, PK)
  - `user_id` (uuid)
  - `name` (text)
  - `status` (text)
  - `date` (date/text)
  - `created_at` (timestamptz)

### `files`
- **exists**
- **columns used by client (MVP contract)**:
  - `id` (uuid, PK)
  - `project_id` (uuid, nullable)
  - `user_id` (uuid)
  - `name` (text)
  - `size` (text, nullable)
  - `type` (text, nullable)
  - `category` (text, nullable)
  - `tags` (text[], nullable)
  - `created_at` (timestamptz)
  - `scope` (text)
  - `mime_type` (text, nullable)
  - `visibility` (text)
  - `status` (text)
  - `storage_path` (text, nullable)
  - `related_entity_id` (uuid, nullable)

### `matrices`
- **exists**
- **columns used by client (MVP contract)**:
  - `id` (uuid, PK)
  - `user_id` (uuid)
  - `project_id` (uuid, nullable)
  - `parent_id` (uuid, nullable)
  - `title` (text)
  - `description` (text, nullable)
  - `columns` (jsonb)
  - `rows` (jsonb)
  - `updated_at` (timestamptz)

### `reports`
- **exists**
- **columns used by client (MVP contract)**:
  - `id` (uuid, PK)
  - `user_id` (uuid)
  - `project_id` (uuid, nullable)
  - `parent_id` (uuid, nullable)
  - `title` (text)
  - `content` (text)
  - `tags` (jsonb, nullable)
  - `updated_at` (timestamptz)

## Does NOT exist (client must not call)

The following are **not present in the current DB schema** and must be gated off:

- Tables:
  - `workspaces`
  - `tasks`
  - `comments`
- Columns:
  - `projects.workspace_id`
  - `projects.members`

## Planned (future work — do not call until enabled)

- `workspaces`
- `project_members` (or equivalent join table)
- `species`
- `tasks`
- `comments`

## Rules (hard requirements)

1. **Never send unknown columns**
   - Any `insert` / `update` payload must contain **only columns that exist** (per this contract).
2. **Reconcile temp IDs → UUIDs before FK usage**
   - If a record is created optimistically with a temp ID (e.g. `proj-*`, `mtx-*`, `rep-*`), the client must reconcile to the returned DB UUID (`insert(...).select('*').single()`) before using it as a foreign key.
3. **Snake_case mapping**
   - DB is `snake_case`; client uses `camelCase`.
   - Always map explicitly (e.g. `project_id` ⇄ `projectId`).
