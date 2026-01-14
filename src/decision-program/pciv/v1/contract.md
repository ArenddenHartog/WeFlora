# PCIV → Planning & Skills Contract (v1)

## Canonical consumer surface: `PcivContextViewV1`

All consumers MUST read and interpret the same normalized view shape:

```ts
PcivContextViewV1 = {
  run: PcivRunV1;
  sourcesById: Record<sourceId, PcivSourceV1>;
  inputsByPointer: Record<pointer, PcivInputV1>;
  constraints: PcivConstraintV1[];
  artifactsByType: Record<string, PcivArtifactV1[]>;
}
```

## Glossary

- **scopeId (semantic)**: the identifier consumers use to resolve PCIV context.
- **projectId (persisted legacy field name)**: storage/DB field name that stores the same identifier for backward compatibility.
- Consumers MUST use `scopeId`; storage persists it as `projectId`.

### Invariants

- `run` is the canonical run metadata, including commit status and timestamps.
- `sourcesById` is the source registry keyed by source id.
- `inputsByPointer` is the canonical field registry keyed by `pointer`.
- `constraints` are the derived or asserted constraints for the run.
- `artifactsByType` groups artifacts by semantic type.

## Provenance rules

- `provenance === 'source-backed'` requires at least one source reference for the input/constraint.
- `provenance === 'unknown'` implies **no value** is present across all `value_*` fields.

## `value_kind` rules

- `value_kind` dictates the **single** typed value that may be present:
  - `string` → `valueString`
  - `number` → `valueNumber`
  - `boolean` → `valueBoolean`
  - `enum` → `valueEnum`
  - `json` → `valueJson`
- All other `value_*` fields MUST be nullish.

## Planning hydration

Planning consumes `PcivContextViewV1` and patches its planning context from `inputsByPointer`:

- Each `pointer` maps to a planning context field.
- Planning reads the single typed value determined by `value_kind`.
- No new logic is introduced here; the contract only defines the normalized surface.

## Skills / agents updates

Skills/agents are consumers and producers of PCIV v1 data.

- They MUST read from `PcivContextViewV1` (never ad hoc state).
- They MUST write updates via the v1 storage adapter by emitting:
  - `PcivInputV1` updates, and/or
  - `PcivConstraintV1` updates.
- They MUST NOT mutate state directly or bypass the adapter.

## Consumers

- Planning UI
- Planning execution program
- Skills/agents
- Evidence UI

## ContextView Resolver Boundary

Only the resolver boundary may serve PCIV v1 context to consumers.

- Planning → `resolveContextView(...)`
- Skills → `getContextViewForSkill(...)` → `resolveContextView(...)`
- No consumer may read v1 tables directly.
- No consumer may read localStorage for PCIV data.
- Deterministic precedence: if multiple committed runs exist for a scope/user, the resolver selects the latest
  `committed`/`partial_committed` run by `committedAt`, falling back to `updatedAt` with a stable tie-breaker.
- Context versioning: consumers use `run.committedAt` (or `run.updatedAt` when needed) as the
  `contextVersionId` applied into planning state.

## NO SCHEMA SPRAWL

All PCIV v1 schemas/types live **only** in `src/decision-program/pciv/v1/schemas.ts`.

## Ownership & Sharing Model (v1.3)

PCIV runs support two ownership models:

- **Owned runs** (`user_id` set): Private to the user who created the run. Only the owner can read/write.
- **Shared runs** (`user_id` NULL): Readable and writable by all authenticated users.

The adapter's `createDraftRun()` accepts an `ownership` parameter:
- `ownership: 'owned'` (default): Creates a run owned by the current authenticated user.
- `ownership: 'shared'`: Creates a run accessible to all authenticated users.

## Row Level Security (RLS) (v1.3)

All PCIV tables enforce Row Level Security:

- **Owned runs**: Only the owner (matching `auth.uid()`) can access the run and its child records.
- **Shared runs**: All authenticated users can access the run and its child records.
- **Service role**: Bypasses RLS for admin operations.
- **Child tables** (sources, inputs, constraints, etc.): Inherit access rules from parent run via `EXISTS` clauses.

### Access Rules

| Run Type | Authenticated User Access | Anonymous Access |
|----------|---------------------------|------------------|
| Owned (user_id set) | Owner only (read/write) | Denied |
| Shared (user_id NULL) | All users (read/write) | Denied |

### Error Handling

The adapter distinguishes between authentication and authorization failures:

- **PcivAuthRequiredError**: Thrown when operation requires authentication (HTTP 401 / PGRST301). User needs to log in.
- **PcivRlsDeniedError**: Thrown when authenticated user lacks permission (HTTP 403 / 42501). User is logged in but doesn't own the resource.
- Generic errors: Thrown for other failures (network, validation, etc.).

Consumers should catch these errors and provide appropriate UX:
- `PcivAuthRequiredError` → Show login prompt
- `PcivRlsDeniedError` → Show "access denied" message
- Other errors → Show generic error

## Adapter-Only Database Access

All database operations MUST go through the storage adapter (`src/decision-program/pciv/v1/storage/supabase.ts`).

- No direct Supabase queries outside the adapter.
- No localStorage for PCIV data persistence.
- Adapter handles RLS error classification automatically.

## Version History

- **v1.0**: Initial schema pack, storage adapter, and migrations.
- **v1.1**: Database-level invariants (committed_at consistency, value_kind enforcement).
- **v1.3**: Row Level Security, ownership model, auth-aware adapter, RLS error classes.

