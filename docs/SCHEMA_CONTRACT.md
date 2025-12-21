# Schema Contract (MVP)

This document is the **source-of-truth** for which Supabase tables/columns the WeFlora client may call during MVP hardening.

## Exists (client may read/write)

### `projects`
- **exists**
- **columns used by client (MVP contract)**:
  - `id` (uuid, PK)
  - `user_id` (uuid)
  - `name` (text)
  - `status` (text)
  - `date` (date/text)
  - `created_at` (timestamptz)

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
  - `species`
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

