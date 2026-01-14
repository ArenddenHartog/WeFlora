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
