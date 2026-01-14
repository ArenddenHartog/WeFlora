import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

const hasEnv = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY && SUPABASE_ANON_KEY;

if (!hasEnv) {
  console.log('Skipping PCIV production smoke test: missing SUPABASE env vars');
}

describe('PCIV v1.2 Production Smoke', { skip: !hasEnv }, () => {
  const scopeId = `pciv-prod-smoke-${Date.now()}`;
  let runId: string | null = null;
  let createDraftRun: any;
  let upsertSources: any;
  let upsertInputs: any;
  let upsertConstraints: any;
  let linkInputSources: any;
  let commitRun: any;
  let deleteRun: any;
  let resolveContextView: any;

  // Lazy-load adapter to avoid env var issues
  const loadDeps = async () => {
    if (!createDraftRun) {
      const adapterModule = await import('../../src/decision-program/pciv/v1/storage/supabase.ts');
      const resolverModule = await import('../../src/decision-program/pciv/v1/resolveContextView.ts');
      createDraftRun = adapterModule.createDraftRun;
      upsertSources = adapterModule.upsertSources;
      upsertInputs = adapterModule.upsertInputs;
      upsertConstraints = adapterModule.upsertConstraints;
      linkInputSources = adapterModule.linkInputSources;
      commitRun = adapterModule.commitRun;
      deleteRun = adapterModule.deleteRun;
      resolveContextView = resolverModule.resolveContextView;
    }
    return { createDraftRun, upsertSources, upsertInputs, upsertConstraints, linkInputSources, commitRun, deleteRun, resolveContextView };
  };

  test('full workflow: create → populate → commit → resolve', async () => {
    const { createDraftRun, upsertSources, upsertInputs, upsertConstraints, linkInputSources, commitRun, deleteRun, resolveContextView } = await loadDeps();

    try {
      // Create draft run
      const run = await createDraftRun(scopeId);
      runId = run.id;
      assert.ok(run.id, 'Run ID should exist');
      assert.strictEqual(run.status, 'draft', 'Initial status should be draft');

      // Upsert sources
      const sources = [
        {
          id: crypto.randomUUID(),
          runId: run.id,
          kind: 'manual' as const,
          title: 'Smoke Test Source',
          uri: 'smoke:test:source',
          fileId: null,
          mimeType: null,
          sizeBytes: null,
          parseStatus: 'parsed' as const,
          excerpt: 'Test source',
          rawMeta: {},
          createdAt: new Date().toISOString()
        }
      ];
      await upsertSources(run.id, sources);

      // Upsert inputs
      const inputs = [
        {
          id: crypto.randomUUID(),
          runId: run.id,
          pointer: 'smoke_input_1',
          label: 'Smoke Input 1',
          domain: 'site' as const,
          required: true,
          fieldType: 'text' as const,
          options: null,
          valueKind: 'string' as const,
          valueString: 'test value',
          valueNumber: null,
          valueBoolean: null,
          valueEnum: null,
          valueJson: null,
          provenance: 'source-backed' as const,
          updatedBy: 'system' as const,
          updatedAt: new Date().toISOString(),
          evidenceSnippet: 'snippet',
          sourceIds: [sources[0].id]
        },
        {
          id: crypto.randomUUID(),
          runId: run.id,
          pointer: 'smoke_input_2',
          label: 'Smoke Input 2',
          domain: 'regulatory' as const,
          required: false,
          fieldType: 'text' as const,
          options: null,
          valueKind: 'number' as const,
          valueString: null,
          valueNumber: 100,
          valueBoolean: null,
          valueEnum: null,
          valueJson: null,
          provenance: 'user-entered' as const,
          updatedBy: 'user' as const,
          updatedAt: new Date().toISOString(),
          evidenceSnippet: null,
          sourceIds: []
        }
      ];
      await upsertInputs(run.id, inputs);

      // Link input sources
      await linkInputSources(run.id, [
        { inputId: inputs[0].id, sourceId: sources[0].id }
      ]);

      // Upsert constraints
      const constraints = [
        {
          id: crypto.randomUUID(),
          runId: run.id,
          key: 'smoke_constraint',
          domain: 'regulatory' as const,
          label: 'Smoke Constraint',
          valueKind: 'boolean' as const,
          valueString: null,
          valueNumber: null,
          valueBoolean: true,
          valueEnum: null,
          valueJson: null,
          provenance: 'source-backed' as const,
          sourceId: sources[0].id,
          snippet: 'constraint snippet',
          createdAt: new Date().toISOString()
        }
      ];
      await upsertConstraints(run.id, constraints);

      // Commit run
      const committedRun = await commitRun(run.id, false);
      assert.strictEqual(committedRun.status, 'committed', 'Status should be committed');
      assert.ok(committedRun.committedAt, 'committedAt should be set');

      // Resolve ContextView
      const view = await resolveContextView({ scopeId, prefer: 'latest_commit' });
      
      // Validate ContextView structure
      assert.strictEqual(view.run.id, run.id, 'ContextView run ID should match');
      assert.strictEqual(view.run.status, 'committed', 'ContextView status should be committed');
      assert.strictEqual(Object.keys(view.inputsByPointer).length, 2, 'Should have 2 inputs');
      assert.strictEqual(Object.keys(view.sourcesById).length, 1, 'Should have 1 source');
      assert.strictEqual(view.constraints.length, 1, 'Should have 1 constraint');

      // Verify runtime invariants are enforced
      assert.ok(view.inputsByPointer['smoke_input_1'], 'Input 1 should exist by pointer');
      assert.ok(view.inputsByPointer['smoke_input_2'], 'Input 2 should exist by pointer');
      assert.strictEqual(
        view.inputsByPointer['smoke_input_1'].pointer,
        'smoke_input_1',
        'inputsByPointer key should match input.pointer'
      );
      assert.strictEqual(
        view.inputsByPointer['smoke_input_2'].pointer,
        'smoke_input_2',
        'inputsByPointer key should match input.pointer'
      );

      // Verify source references
      const input1 = view.inputsByPointer['smoke_input_1'];
      assert.ok(input1.sourceIds && input1.sourceIds.length > 0, 'Input 1 should have source IDs');
      for (const sourceId of input1.sourceIds!) {
        assert.ok(view.sourcesById[sourceId], `Source ${sourceId} should exist in sourcesById`);
      }

      // Cleanup
      await deleteRun(run.id);
      runId = null;
    } catch (err) {
      // Ensure cleanup on failure
      if (runId) {
        await deleteRun(runId);
      }
      throw err;
    }
  });

  test('runtime invariants enforce committed_at consistency', async () => {
    const { createDraftRun, upsertInputs, commitRun, deleteRun, resolveContextView } = await loadDeps();

    try {
      // Create and commit a minimal run
      const run = await createDraftRun(`${scopeId}-invariant-test`);
      runId = run.id;

      await upsertInputs(run.id, [
        {
          id: crypto.randomUUID(),
          runId: run.id,
          pointer: 'test_input',
          label: 'Test',
          domain: 'site' as const,
          required: false,
          fieldType: 'text' as const,
          options: null,
          valueKind: 'string' as const,
          valueString: 'test',
          valueNumber: null,
          valueBoolean: null,
          valueEnum: null,
          valueJson: null,
          provenance: 'user-entered' as const,
          updatedBy: 'user' as const,
          updatedAt: new Date().toISOString(),
          evidenceSnippet: null,
          sourceIds: []
        }
      ]);

      const committedRun = await commitRun(run.id, false);
      
      // Resolve should succeed with proper committed_at
      const view = await resolveContextView({ scopeId: `${scopeId}-invariant-test`, prefer: 'latest_commit' });
      assert.strictEqual(view.run.status, 'committed');
      assert.ok(view.run.committedAt, 'Committed run should have committedAt');

      await deleteRun(run.id);
      runId = null;
    } catch (err) {
      if (runId) {
        await deleteRun(runId);
      }
      throw err;
    }
  });
});
