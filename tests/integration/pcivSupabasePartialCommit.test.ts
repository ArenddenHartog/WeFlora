import { describe, it, before, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  createDraftRun,
  upsertInputs,
  commitRun,
  fetchContextViewByRunId,
  deleteRun
} from '../../src/decision-program/pciv/v1/storage/supabase';
import type { PcivInputV1 } from '../../src/decision-program/pciv/v1/schemas';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

describe('PCIV Supabase Partial Commit with Unset Inputs', () => {
  let supabase: SupabaseClient;
  const testScopeId = 'test-scope-partial-unset-' + Date.now();
  const createdRunIds: string[] = [];

  before(() => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.warn('Skipping integration test: Supabase env vars not set');
      return;
    }
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  });

  afterEach(async () => {
    // Cleanup created runs
    if (supabase && createdRunIds.length > 0) {
      for (const runId of createdRunIds) {
        try {
          await deleteRun(runId);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
      createdRunIds.length = 0;
    }
  });

  it('should commit partial run with unset required inputs', async () => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.log('Test skipped: missing env vars');
      return;
    }

    // 1. Create draft run
    const run = await createDraftRun(testScopeId, { ownership: 'owned' });
    createdRunIds.push(run.id);

    assert.ok(run.id);
    assert.equal(run.status, 'draft');

    // 2. Upsert required input with unset value (all value_* columns null)
    const timestamp = new Date().toISOString();
    const inputs: PcivInputV1[] = [
      {
        id: crypto.randomUUID(),
        runId: run.id,
        pointer: '/test/required-field',
        label: 'Required Test Field',
        domain: 'site',
        required: true,
        fieldType: 'text',
        options: null,
        valueKind: 'string',
        // All value columns null/undefined (unset state)
        valueString: null,
        valueNumber: null,
        valueBoolean: null,
        valueEnum: null,
        valueJson: null,
        provenance: 'unknown',
        updatedBy: 'system',
        updatedAt: timestamp,
        evidenceSnippet: null,
        sourceIds: []
      }
    ];

    await upsertInputs(run.id, inputs);

    // 3. Commit with allowPartial=true
    const committedRun = await commitRun(run.id, true);

    // 4. Assertions on committed run
    assert.equal(committedRun.status, 'partial_committed');
    assert.equal(committedRun.allowPartial, true);
    assert.ok(committedRun.committedAt);

    // 5. Resolve context view
    const contextView = await fetchContextViewByRunId(run.id);

    assert.equal(contextView.run.status, 'partial_committed');
    assert.equal(contextView.run.allowPartial, true);
    assert.ok(contextView.run.committedAt);

    // Check that the input exists and shows unset state
    const input = contextView.inputsByPointer['/test/required-field'];
    assert.ok(input);
    assert.equal(input.valueKind, 'string');
    assert.equal(input.valueString, null);
    assert.equal(input.valueNumber, null);
    assert.equal(input.valueBoolean, null);
    assert.equal(input.valueEnum, null);
    assert.equal(input.valueJson, null);
  });

  it('should fail to commit if value column mismatches value_kind', async () => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.log('Test skipped: missing env vars');
      return;
    }

    const run = await createDraftRun(testScopeId + '-mismatch', { ownership: 'owned' });
    createdRunIds.push(run.id);

    const timestamp = new Date().toISOString();

    // Attempt to upsert input with wrong value column (should throw runtime invariant error)
    const inputs: PcivInputV1[] = [
      {
        id: crypto.randomUUID(),
        runId: run.id,
        pointer: '/test/mismatch-field',
        label: 'Mismatch Field',
        domain: 'site',
        required: true,
        fieldType: 'text',
        options: null,
        valueKind: 'string',
        valueString: null,
        valueNumber: 42, // Wrong! Should be valueString
        valueBoolean: null,
        valueEnum: null,
        valueJson: null,
        provenance: 'user-entered',
        updatedBy: 'user',
        updatedAt: timestamp,
        evidenceSnippet: null,
        sourceIds: []
      }
    ];

    await assert.rejects(
      upsertInputs(run.id, inputs),
      /pciv_v1_runtime_invariant_failed/
    );
  });

  it('should succeed with correctly set value matching value_kind', async () => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.log('Test skipped: missing env vars');
      return;
    }

    const run = await createDraftRun(testScopeId + '-correct', { ownership: 'owned' });
    createdRunIds.push(run.id);

    const timestamp = new Date().toISOString();
    const inputs: PcivInputV1[] = [
      {
        id: crypto.randomUUID(),
        runId: run.id,
        pointer: '/test/correct-field',
        label: 'Correct Field',
        domain: 'site',
        required: true,
        fieldType: 'text',
        options: null,
        valueKind: 'string',
        valueString: 'test value', // Correct: matches valueKind
        valueNumber: null,
        valueBoolean: null,
        valueEnum: null,
        valueJson: null,
        provenance: 'user-entered',
        updatedBy: 'user',
        updatedAt: timestamp,
        evidenceSnippet: null,
        sourceIds: []
      }
    ];

    // Should not throw
    await upsertInputs(run.id, inputs);

    // Verify it persisted correctly
    const contextView = await fetchContextViewByRunId(run.id);
    const input = contextView.inputsByPointer['/test/correct-field'];
    assert.equal(input.valueString, 'test value');
    assert.equal(input.valueNumber, null);
    assert.equal(input.valueBoolean, null);
  });
});
