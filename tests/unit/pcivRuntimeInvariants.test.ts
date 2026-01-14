import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import { assertContextViewInvariants } from '../../src/decision-program/pciv/v1/runtimeInvariants.ts';
import type { PcivContextViewV1 } from '../../src/decision-program/pciv/v1/schemas.ts';

describe('PCIV v1.2 Runtime Invariants', () => {
  const createValidContextView = (): PcivContextViewV1 => ({
    run: {
      id: crypto.randomUUID(),
      scopeId: 'test-scope',
      userId: null,
      status: 'committed',
      allowPartial: false,
      committedAt: '2026-01-14T10:00:00.000+00:00',
      createdAt: '2026-01-14T09:00:00.000+00:00',
      updatedAt: '2026-01-14T10:00:00.000+00:00'
    },
    inputsByPointer: {
      'test_input_1': {
        id: crypto.randomUUID(),
        runId: crypto.randomUUID(),
        pointer: 'test_input_1',
        label: 'Test Input 1',
        domain: 'site',
        required: true,
        fieldType: 'text',
        options: null,
        valueKind: 'string',
        valueString: 'test',
        valueNumber: null,
        valueBoolean: null,
        valueEnum: null,
        valueJson: null,
        provenance: 'user-entered',
        updatedBy: 'user',
        updatedAt: '2026-01-14T10:00:00.000+00:00',
        evidenceSnippet: null,
        sourceIds: []
      }
    },
    sourcesById: {
      [crypto.randomUUID()]: {
        id: crypto.randomUUID(),
        runId: crypto.randomUUID(),
        kind: 'manual',
        title: 'Test Source',
        uri: 'manual:test',
        fileId: null,
        mimeType: null,
        sizeBytes: null,
        parseStatus: 'parsed',
        excerpt: null,
        rawMeta: {},
        createdAt: '2026-01-14T09:30:00.000+00:00'
      }
    },
    constraints: [],
    artifactsByType: {}
  });

  test('valid ContextView passes all invariants', () => {
    const view = createValidContextView();
    // Make sure sourcesById key matches source.id
    const sourceId = Object.keys(view.sourcesById)[0];
    view.sourcesById[sourceId].id = sourceId;
    view.sourcesById[sourceId].runId = view.run.id;
    view.inputsByPointer['test_input_1'].runId = view.run.id;
    
    assert.doesNotThrow(() => assertContextViewInvariants(view));
  });

  test('inputsByPointer key mismatch throws pciv_v1_runtime_invariant_failed', () => {
    const view = createValidContextView();
    view.inputsByPointer['wrong_key'] = view.inputsByPointer['test_input_1'];
    delete view.inputsByPointer['test_input_1'];

    assert.throws(
      () => assertContextViewInvariants(view),
      (err: Error) => {
        return (
          err.message.includes('pciv_v1_runtime_invariant_failed') &&
          err.message.includes('inputsByPointer_key_mismatch')
        );
      }
    );
  });

  test('sourcesById key mismatch throws pciv_v1_runtime_invariant_failed', () => {
    const view = createValidContextView();
    const sourceId = Object.keys(view.sourcesById)[0];
    const wrongId = crypto.randomUUID();
    view.sourcesById[wrongId] = view.sourcesById[sourceId];
    view.sourcesById[wrongId].id = wrongId; // Keep source.id matching for first invariant
    view.sourcesById[wrongId].runId = view.run.id;
    view.inputsByPointer['test_input_1'].runId = view.run.id;
    delete view.sourcesById[sourceId];

    // Now break the key mismatch: set source.id to a DIFFERENT UUID (not the key)
    view.sourcesById[wrongId].id = crypto.randomUUID();

    assert.throws(
      () => assertContextViewInvariants(view),
      (err: Error) => {
        return (
          err.message.includes('pciv_v1_runtime_invariant_failed') &&
          err.message.includes('sourcesById_key_mismatch')
        );
      }
    );
  });

  test('broken input->source reference throws pciv_v1_runtime_invariant_failed', () => {
    const view = createValidContextView();
    const sourceId = Object.keys(view.sourcesById)[0];
    view.sourcesById[sourceId].id = sourceId;
    view.sourcesById[sourceId].runId = view.run.id;
    view.inputsByPointer['test_input_1'].runId = view.run.id;
    // Use a valid UUID that doesn't exist in sourcesById
    view.inputsByPointer['test_input_1'].sourceIds = [crypto.randomUUID()];

    assert.throws(
      () => assertContextViewInvariants(view),
      (err: Error) => {
        return (
          err.message.includes('pciv_v1_runtime_invariant_failed') &&
          err.message.includes('input_source_reference_broken')
        );
      }
    );
  });

  test('committed status without committedAt throws pciv_v1_runtime_invariant_failed', () => {
    const view = createValidContextView();
    const sourceId = Object.keys(view.sourcesById)[0];
    view.sourcesById[sourceId].id = sourceId;
    view.sourcesById[sourceId].runId = view.run.id;
    view.inputsByPointer['test_input_1'].runId = view.run.id;
    view.run.status = 'committed';
    view.run.committedAt = null;

    assert.throws(
      () => assertContextViewInvariants(view),
      (err: Error) => {
        return (
          err.message.includes('pciv_v1_runtime_invariant_failed') &&
          err.message.includes('committed_status_without_timestamp')
        );
      }
    );
  });

  test('draft status with committedAt throws pciv_v1_runtime_invariant_failed', () => {
    const view = createValidContextView();
    const sourceId = Object.keys(view.sourcesById)[0];
    view.sourcesById[sourceId].id = sourceId;
    view.sourcesById[sourceId].runId = view.run.id;
    view.inputsByPointer['test_input_1'].runId = view.run.id;
    view.run.status = 'draft';
    view.run.committedAt = '2026-01-14T10:00:00.000+00:00';

    assert.throws(
      () => assertContextViewInvariants(view),
      (err: Error) => {
        return (
          err.message.includes('pciv_v1_runtime_invariant_failed') &&
          err.message.includes('draft_status_with_timestamp')
        );
      }
    );
  });

  test('input with source references validates successfully', () => {
    const view = createValidContextView();
    const sourceId = Object.keys(view.sourcesById)[0];
    view.sourcesById[sourceId].id = sourceId;
    view.sourcesById[sourceId].runId = view.run.id;
    view.inputsByPointer['test_input_1'].runId = view.run.id;
    view.inputsByPointer['test_input_1'].sourceIds = [sourceId];
    view.inputsByPointer['test_input_1'].provenance = 'source-backed';

    assert.doesNotThrow(() => assertContextViewInvariants(view));
  });

  test('error message includes scopeId and runId', () => {
    const view = createValidContextView();
    const sourceId = Object.keys(view.sourcesById)[0];
    view.sourcesById[sourceId].id = sourceId;
    view.sourcesById[sourceId].runId = view.run.id;
    view.inputsByPointer['test_input_1'].runId = view.run.id;
    view.run.status = 'committed';
    view.run.committedAt = null;

    try {
      assertContextViewInvariants(view);
      assert.fail('Should have thrown');
    } catch (err: any) {
      assert.strictEqual(err.scopeId, 'test-scope', 'Error should have scopeId');
      assert.strictEqual(err.runId, view.run.id, 'Error should have runId');
      assert.strictEqual(err.invariantName, 'committed_status_without_timestamp', 'Error should have invariantName');
    }
  });
});
