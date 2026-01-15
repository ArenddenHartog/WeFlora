import { PcivContextViewV1Schema, type PcivContextViewV1 } from './schemas.ts';

/**
 * PCIV v1.2 Runtime Invariants
 * 
 * These assertions enforce additional correctness guarantees beyond what Zod schemas validate.
 * They run at the ContextView boundary and MUST NOT be bypassed in production code.
 */

class PcivRuntimeInvariantError extends Error {
  invariantName: string;
  scopeId?: string;
  runId?: string;

  constructor(
    invariantName: string,
    message: string,
    scopeId?: string,
    runId?: string
  ) {
    super(`pciv_v1_runtime_invariant_failed: ${invariantName} - ${message}`);
    this.name = 'PcivRuntimeInvariantError';
    this.invariantName = invariantName;
    this.scopeId = scopeId;
    this.runId = runId;
  }
}

/**
 * Assert that ContextView passes all runtime invariants.
 * Throws PcivRuntimeInvariantError on any violation.
 * 
 * @param view - The ContextView to validate
 * @throws {PcivRuntimeInvariantError} If any invariant is violated
 */
export const assertContextViewInvariants = (view: PcivContextViewV1): void => {
  const scopeId = view.run.scopeId;
  const runId = view.run.id;

  // First, validate against Zod schema
  const parseResult = PcivContextViewV1Schema.safeParse(view);
  if (!parseResult.success) {
    throw new PcivRuntimeInvariantError(
      'schema_validation',
      `ContextView failed schema validation: ${JSON.stringify(parseResult.error.errors)}`,
      scopeId,
      runId
    );
  }

  // Invariant a) inputsByPointer keys MUST equal input.pointer for every entry
  for (const [pointer, input] of Object.entries(view.inputsByPointer)) {
    if (input.pointer !== pointer) {
      throw new PcivRuntimeInvariantError(
        'inputsByPointer_key_mismatch',
        `inputsByPointer key "${pointer}" does not match input.pointer "${input.pointer}"`,
        scopeId,
        runId
      );
    }
  }

  // Invariant b) sourcesById keys MUST equal source.id for every entry
  for (const [sourceId, source] of Object.entries(view.sourcesById)) {
    if (source.id !== sourceId) {
      throw new PcivRuntimeInvariantError(
        'sourcesById_key_mismatch',
        `sourcesById key "${sourceId}" does not match source.id "${source.id}"`,
        scopeId,
        runId
      );
    }
  }

  // Invariant c) Every input->source link must reference existing source IDs
  // Note: PcivInputV1Schema has optional sourceIds array
  for (const [pointer, input] of Object.entries(view.inputsByPointer)) {
    const sourceIds = input.sourceIds ?? [];
    for (const sourceId of sourceIds) {
      if (!view.sourcesById[sourceId]) {
        throw new PcivRuntimeInvariantError(
          'input_source_reference_broken',
          `Input "${pointer}" references non-existent source "${sourceId}"`,
          scopeId,
          runId
        );
      }
    }
  }

  // Invariant d) run.status vs run.committedAt consistency (mirrors DB invariant)
  const { status, committedAt } = view.run;
  if ((status === 'committed' || status === 'partial_committed') && !committedAt) {
    throw new PcivRuntimeInvariantError(
      'committed_status_without_timestamp',
      `Run has status "${status}" but committedAt is null`,
      scopeId,
      runId
    );
  }
  if (status === 'draft' && committedAt !== null) {
    throw new PcivRuntimeInvariantError(
      'draft_status_with_timestamp',
      `Run has status "draft" but committedAt is not null: ${committedAt}`,
      scopeId,
      runId
    );
  }
};

/**
 * PCIV v1.3.1 Runtime Invariant: Value columns match value_kind
 * 
 * Validates that input/constraint value columns are consistent with value_kind:
 * - VALID: All value_* columns are NULL (unset state)
 * - VALID: Exactly one value_* column is set and matches value_kind
 * - INVALID: Multiple value_* columns set
 * - INVALID: Wrong value_* column for the given value_kind
 */
export function invariantPCIVValueColumnsMatchKind(params: {
  value_kind: 'string' | 'number' | 'boolean' | 'enum' | 'json';
  value_string: string | null;
  value_number: number | null;
  value_boolean: boolean | null;
  value_enum: string | null;
  value_json: unknown | null;
  scopeId?: string;
  runId?: string;
  pointer?: string;
}): void {
  const {
    value_kind,
    value_string,
    value_number,
    value_boolean,
    value_enum,
    value_json,
    scopeId,
    runId,
    pointer
  } = params;

  // Count non-null value columns
  const setColumns = [
    value_string !== null,
    value_number !== null,
    value_boolean !== null,
    value_enum !== null,
    value_json !== null
  ].filter(Boolean).length;

  // Case 1: All NULL (unset) - VALID
  if (setColumns === 0) {
    return;
  }

  // Case 2: More than one column set - INVALID
  if (setColumns > 1) {
    const context = [
      runId ? `runId=${runId}` : null,
      scopeId ? `scopeId=${scopeId}` : null,
      pointer ? `pointer=${pointer}` : null
    ].filter(Boolean).join(', ');

    throw new PcivRuntimeInvariantError(
      'pciv_value_columns_match_kind',
      `Multiple value columns set (expected exactly one for value_kind='${value_kind}')` +
      (context ? `. Context: ${context}` : ''),
      scopeId,
      runId
    );
  }

  // Case 3: Exactly one column set - must match value_kind
  const isValid = 
    (value_kind === 'string' && value_string !== null) ||
    (value_kind === 'number' && value_number !== null) ||
    (value_kind === 'boolean' && value_boolean !== null) ||
    (value_kind === 'enum' && value_enum !== null) ||
    (value_kind === 'json' && value_json !== null);

  if (!isValid) {
    const setColumn = 
      value_string !== null ? 'value_string' :
      value_number !== null ? 'value_number' :
      value_boolean !== null ? 'value_boolean' :
      value_enum !== null ? 'value_enum' :
      'value_json';

    const context = [
      runId ? `runId=${runId}` : null,
      scopeId ? `scopeId=${scopeId}` : null,
      pointer ? `pointer=${pointer}` : null
    ].filter(Boolean).join(', ');

    throw new PcivRuntimeInvariantError(
      'pciv_value_columns_match_kind',
      `Wrong value column '${setColumn}' for value_kind='${value_kind}'` +
      (context ? `. Context: ${context}` : ''),
      scopeId,
      runId
    );
  }
}
