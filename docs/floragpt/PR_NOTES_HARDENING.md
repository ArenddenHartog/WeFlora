# FloraGPT Hardening Notes (v0.1)

## Files changed (key)
- `src/floragpt/utils/extractReferencedSourceIds.ts` — schema-aligned citation extraction
- `src/floragpt/orchestrator/buildCitations.ts` — whitelist citations by referenced source_ids
- `contexts/ChatContext.tsx` — citations derived from payload references (feature-flagged)
- `src/floragpt/schemas/*.v0_1.json` — schema contracts for v0.1
- `scripts/test-floragpt.ts` — validation + citation whitelist + boundary checks

## Guaranteed behavior (v0.1)
- Citations are derived only from schema-defined string[] locations.
- Evidence is scoped to `project:<id>` or `global`; cross-project items are dropped.
- Schema pinning requires `meta.schema_version === "v0.1"` for schema-path success.
 - Enforced in: `extractReferencedSourceIds.ts`, `buildCitationsFromEvidencePack` (whitelist), and ChatContext FloraGPT message assembly.
 - Note: `general_research` does not surface “Verified” in v0.1 because the schema defines no citation fields (expected).

## Not supported in v0.1 (by schema)
- `general_research` citations: no citations fields exist in v0.1 schemas.
- `meta.sources_used`: not allowed in v0.1 schemas.

## Tests
- `node --experimental-strip-types scripts/test-floragpt.ts`
