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

**Note**: As of v1.4, ownership model is superseded by membership-based authorization (see below).

## Authorization Model (v1.4)

PCIV scopes use membership-based authorization via the `pciv_scope_members` table.

### Membership Roles

Three roles define access levels:

| Role | Permissions |
|------|-------------|
| **viewer** | Read-only access to all PCIV data for the scope |
| **editor** | Read/write access to sources, inputs, constraints, artifacts; can create and commit runs |
| **owner** | Full access including run deletion and membership management |

### Role Assignment

- **Planning + CTIV**: Users should have `editor` or `owner` role to create/modify planning context.
- **Skills/Agents**: Default to `viewer` role for read-only context access. Grant `editor` role if skill needs to update context.
- **Collaboration**: Owners can invite users and assign roles via `upsertScopeMember()`.

### Bootstrap Process

New scopes are initialized via `pciv_bootstrap_scope()` RPC:
- Requires authenticated user
- Creates first owner membership for the calling user
- Optionally creates initial draft run
- Refuses to reinitialize existing scopes (safe against foot-guns)

The adapter's `createDraftRun()` automatically calls bootstrap on first use for owned scopes.

### Membership Management

Adapter exports:
- `listScopeMembers(scopeId)`: List all members (requires viewer role)
- `upsertScopeMember(scopeId, userId, role)`: Add/update member (requires owner role)
- `removeScopeMember(scopeId, userId)`: Remove member (requires owner role)

Protected invariant: Cannot remove or downgrade the last owner (enforced by DB trigger).

## Row Level Security (RLS) (v1.3+)

All PCIV tables enforce Row Level Security:

- **Membership-based** (v1.4): Access determined by `pciv_scope_members` role.
- **Service role**: Bypasses RLS for admin operations.
- **Child tables** (sources, inputs, constraints, etc.): Inherit access from parent run's scope membership.

### Access Rules

| Role | Read Access | Write Access | Delete Runs | Manage Members |
|------|-------------|--------------|-------------|----------------|
| viewer | ✅ All scope data | ❌ No | ❌ No | ❌ No |
| editor | ✅ All scope data | ✅ Sources, inputs, constraints, artifacts, runs | ❌ No | ❌ No |
| owner | ✅ All scope data | ✅ All operations | ✅ Yes | ✅ Yes |

Non-members have no access to the scope.

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
- Includes membership table: `pciv_scope_members` access only via adapter.

## Version History

- **v1.0**: Initial schema pack, storage adapter, and migrations.
- **v1.1**: Database-level invariants (committed_at consistency, value_kind enforcement).
- **v1.3**: Row Level Security, ownership model, auth-aware adapter, RLS error classes.
- **v1.3.1**: Allow "unset" values in partial commits (all value_* columns NULL is valid).
- **v1.3.2**: Canonical latest run resolver, Planning hydration smoke test, explicit unset semantics documentation.
- **v1.4**: Membership-based authorization, scope bootstrap RPC, role hierarchy (viewer/editor/owner).

## Unset Values and Partial Commits (v1.3.1+)

### Value States

PCIV supports three distinct value states for inputs and constraints:

#### UNSET
- **Definition**: All value columns are NULL (`value_string`, `value_number`, `value_boolean`, `value_enum`, `value_json` all NULL)
- **Semantics**: Value has not been provided yet
- **Storage**: `value_kind` is still present, indicating the expected type, but no actual value is stored
- **Use case**: Required fields in partial commits where user hasn't filled in the value yet

```typescript
// Example: Unset required input
{
  pointer: '/project/budget',
  label: 'Project Budget',
  required: true,
  value_kind: 'number',
  value_string: null,
  value_number: null,    // All value columns are NULL
  value_boolean: null,
  value_enum: null,
  value_json: null
}
```

#### EMPTY STRING
- **Definition**: `value_kind='string'` and `value_string=''` (empty string)
- **Semantics**: User explicitly entered an empty value
- **Storage**: `value_string` is set to empty string, all other value columns are NULL
- **Use case**: Optional text fields where user intentionally left blank

```typescript
// Example: Explicitly empty string
{
  pointer: '/project/notes',
  label: 'Project Notes',
  required: false,
  value_kind: 'string',
  value_string: '',      // Explicit empty string
  value_number: null,
  value_boolean: null,
  value_enum: null,
  value_json: null
}
```

#### UNKNOWN
- **Definition**: Only represented by UNSET state
- **Semantics**: Value is not known/not provided
- **Exception**: Some domains MAY model "unknown" as an explicit enum option (e.g., `value_enum: 'unknown'`) if the domain requires distinguishing between "not answered" and "answered as unknown"

### Partial Commits

When `run.status` is `'partial_committed'`:

- **Allow partial**: Run was committed with `allowPartial=true` flag
- **Incomplete data**: One or more required inputs MAY be in UNSET state
- **Proceed with caution**: Consumers (Planning, Skills) CAN proceed but MUST handle missing required inputs gracefully

### Consumer Obligations

All consumers (Planning, Skills, Evidence UI) MUST follow these rules:

1. **Treat UNSET required inputs as "missing"**
   - Do not assume default values
   - Show clear UI indication that value is missing
   - Validation errors/warnings should highlight missing required fields

2. **MAY proceed if `run.status === 'partial_committed'`**
   - Partial commits explicitly permit missing required inputs
   - Consumer should show warnings but not block usage
   - Planning execution MAY continue with incomplete context (skill handles missing values)

3. **MUST NOT overwrite user-entered values implicitly**
   - Never replace explicit empty string with inferred value
   - Never replace user-entered value with model inference without explicit user action
   - Model suggestions should be shown alongside user values, not replacing them

4. **MUST keep missing inputs visible after partial commit**
   - Planning UI must still show which required fields are UNSET
   - Users should be able to return and complete missing values
   - Partial commit does NOT mean "hide all validation errors"

### Example Workflow

```typescript
// 1. User creates context intake with some required fields UNSET
const inputs = [
  { pointer: '/site/location', required: true, value_kind: 'string', /* all value_* null */ },
  { pointer: '/site/size', required: false, value_kind: 'number', value_number: 5000, /* others null */ }
];

// 2. User clicks "Proceed with partial context"
await commitRun(runId, allowPartial: true);
// Result: run.status = 'partial_committed', run.allowPartial = true

// 3. Planning loads context
const contextView = await fetchContextViewByRunId(runId);
const location = contextView.inputsByPointer['/site/location'];
// location has all value_* null → treat as MISSING

// 4. Planning proceeds but shows warnings
if (location.required && isUnset(location)) {
  showWarning('Location is required but not provided');
  // Execution MAY continue, skill handles missing value
}
```

### Database Constraints (v1.3.1+)

Both `pciv_inputs` and `pciv_constraints` tables enforce:

```sql
-- VALID: All value columns NULL (unset)
-- VALID: Exactly one value column matches value_kind
-- INVALID: Multiple value columns set
-- INVALID: Wrong value column for value_kind
```

### Runtime Invariants (v1.3.1+)

The adapter validates value column consistency via `invariantPCIVValueColumnsMatchKind`:

- ✅ UNSET: `value_kind` present, all `value_*` NULL
- ✅ CORRECT: One matching value column for `value_kind`
- ❌ WRONG TYPE: Value column doesn't match `value_kind`
- ❌ MULTIPLE: More than one value column set

Violations throw `PcivRuntimeInvariantError` with error code `pciv_v1_runtime_invariant_failed`.


