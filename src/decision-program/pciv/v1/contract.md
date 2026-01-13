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

## NO SCHEMA SPRAWL

All PCIV v1 schemas/types live **only** in `src/decision-program/pciv/v1/schemas.ts`.
