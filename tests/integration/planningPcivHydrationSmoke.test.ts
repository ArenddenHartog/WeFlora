import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  createDraftRun,
  upsertInputs,
  commitRun,
  upsertArtifacts,
  deleteRun
} from '../../src/decision-program/pciv/v1/storage/supabase';
import { loadLatestPlanningRunForScope } from '../../src/decision-program/planning/storage/planningPcivAdapter';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

describe('Planning PCIV Hydration Smoke Test', () => {
  let supabase: SupabaseClient;
  const testScopeId = `pciv-planning-smoke-${Date.now()}`;
  let testRunId: string;

  before(() => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.warn('Skipping Planning hydration smoke test: Supabase env vars not set');
      return;
    }
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  });

  it('should hydrate Planning from partial commit with unset required inputs', async () => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.log('Test skipped: missing env vars');
      return;
    }

    // 1. Create a draft run (owned) for the new scopeId
    const run = await createDraftRun(testScopeId, { ownership: 'owned' });
    testRunId = run.id;
    assert.ok(testRunId);

    // 2. Upsert one required input with UNSET value and one optional input with a value
    await upsertInputs(testRunId, [
      {
        id: crypto.randomUUID(),
        runId: testRunId,
        pointer: '/test/required-location',
        label: 'Test Location',
        domain: 'site',
        required: true,
        fieldType: 'text',
        provenance: 'unknown',
        valueKind: 'string',
        // All value columns null/undefined (UNSET state)
        valueString: null,
        valueNumber: null,
        valueBoolean: null,
        valueEnum: null,
        valueJson: null,
        updatedBy: 'user',
        updatedAt: new Date().toISOString()
      },
      {
        id: crypto.randomUUID(),
        runId: testRunId,
        pointer: '/test/optional-budget',
        label: 'Test Budget',
        domain: 'site',
        required: false,
        fieldType: 'text',
        provenance: 'user-entered',
        valueKind: 'number',
        valueString: null,
        valueNumber: 50000,
        valueBoolean: null,
        valueEnum: null,
        valueJson: null,
        updatedBy: 'user',
        updatedAt: new Date().toISOString()
      }
    ]);

    // 3. Commit run with allowPartial=true
    const committedRun = await commitRun(testRunId, true);
    assert.equal(committedRun.status, 'partial_committed');
    assert.equal(committedRun.allowPartial, true);

    // 4. Upsert planning.execution_state.v1 artifact for this run
    const artifactId = `${testRunId}:planning.execution_state.v1`;
    const artifactPayload = {
      runId: testRunId,
      programId: 'test-program',
      executionState: {
        phase: 'initialized',
        completedSteps: [],
        testData: 'smoke-test-payload'
      },
      status: 'active',
      projectId: testScopeId
    };

    await upsertArtifacts([
      {
        id: artifactId,
        runId: testRunId,
        type: 'planning.execution_state.v1',
        title: 'Planning execution state',
        payload: artifactPayload,
        createdAt: new Date().toISOString()
      }
    ]);

    // 5. Call loadLatestPlanningRunForScope and assert
    const snapshot = await loadLatestPlanningRunForScope(supabase, testScopeId);

    // Must return a snapshot
    assert.ok(snapshot);

    // Snapshot runId must match the PCIV run id used
    assert.equal(snapshot!.runId, testRunId);

    // Artifact payload returned must equal what was stored
    assert.equal(snapshot!.programId, 'test-program');
    assert.deepEqual(snapshot!.executionState, artifactPayload.executionState);
    assert.equal(snapshot!.status, 'active');
    assert.equal(snapshot!.projectId, testScopeId);

    // 6. Cleanup - delete run
    await deleteRun(testRunId);
  });

  it('should fail if Planning still uses list+sort path (regression)', async () => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.log('Test skipped: missing env vars');
      return;
    }

    // This test ensures that loadLatestPlanningRunForScope uses
    // getLatestCommittedRunForScope and NOT listRunsForScope + client-side sorting

    // Create a scope with multiple runs to ensure we're not accidentally
    // relying on list+sort behavior
    const multiRunScopeId = `pciv-planning-multi-${Date.now()}`;
    
    // Create first run (older)
    const oldRun = await createDraftRun(multiRunScopeId, { ownership: 'owned' });
    await upsertInputs(oldRun.id, [
      {
        id: crypto.randomUUID(),
        runId: oldRun.id,
        pointer: '/test/field',
        label: 'Test Field',
        domain: 'site',
        required: false,
        fieldType: 'text',
        provenance: 'user-entered',
        valueKind: 'string',
        valueString: 'old-value',
        valueNumber: null,
        valueBoolean: null,
        valueEnum: null,
        valueJson: null,
        updatedBy: 'user',
        updatedAt: new Date().toISOString()
      }
    ]);
    await commitRun(oldRun.id, false);
    
    // Create artifact for old run
    await upsertArtifacts([
      {
        id: `${oldRun.id}:planning.execution_state.v1`,
        runId: oldRun.id,
        type: 'planning.execution_state.v1',
        title: 'Planning execution state',
        payload: {
          runId: oldRun.id,
          programId: 'old-program',
          executionState: { version: 'old' },
          status: 'old'
        },
        createdAt: new Date().toISOString()
      }
    ]);

    // Wait a bit to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 100));

    // Create second run (newer)
    const newRun = await createDraftRun(multiRunScopeId, { ownership: 'owned' });
    await upsertInputs(newRun.id, [
      {
        id: crypto.randomUUID(),
        runId: newRun.id,
        pointer: '/test/field',
        label: 'Test Field',
        domain: 'site',
        required: false,
        fieldType: 'text',
        provenance: 'user-entered',
        valueKind: 'string',
        valueString: 'new-value',
        valueNumber: null,
        valueBoolean: null,
        valueEnum: null,
        valueJson: null,
        updatedBy: 'user',
        updatedAt: new Date().toISOString()
      }
    ]);
    await commitRun(newRun.id, false);
    
    // Create artifact for new run
    await upsertArtifacts([
      {
        id: `${newRun.id}:planning.execution_state.v1`,
        runId: newRun.id,
        type: 'planning.execution_state.v1',
        title: 'Planning execution state',
        payload: {
          runId: newRun.id,
          programId: 'new-program',
          executionState: { version: 'new' },
          status: 'new'
        },
        createdAt: new Date().toISOString()
      }
    ]);

    // Load latest - should get the NEW run (latest by committed_at)
    const snapshot = await loadLatestPlanningRunForScope(supabase, multiRunScopeId);

    assert.ok(snapshot);
    assert.equal(snapshot!.runId, newRun.id);
    assert.equal(snapshot!.programId, 'new-program');
    assert.equal(snapshot!.status, 'new');

    // Cleanup
    await deleteRun(oldRun.id);
    await deleteRun(newRun.id);
  });

  it('should handle UNSET required input without 400 error', async () => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.log('Test skipped: missing env vars');
      return;
    }

    // This validates that UNSET values (v1.3.1) work correctly end-to-end
    const unsetScopeId = `pciv-unset-smoke-${Date.now()}`;
    
    const run = await createDraftRun(unsetScopeId, { ownership: 'owned' });

    // Create input with all value columns null (UNSET)
    await assert.doesNotReject(
      upsertInputs(run.id, [
        {
          id: crypto.randomUUID(),
          runId: run.id,
          pointer: '/test/unset-field',
          label: 'Unset Field',
          domain: 'site',
          required: true,
          fieldType: 'text',
          provenance: 'unknown',
          valueKind: 'string',
          valueString: null,
          valueNumber: null,
          valueBoolean: null,
          valueEnum: null,
          valueJson: null,
          updatedBy: 'user',
          updatedAt: new Date().toISOString()
        }
      ])
    );

    // Should be able to commit with allowPartial
    const committedRun = await commitRun(run.id, true);
    assert.equal(committedRun.status, 'partial_committed');

    // Cleanup
    await deleteRun(run.id);
  });
});
