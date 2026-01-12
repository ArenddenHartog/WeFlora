import assert from 'node:assert/strict';
import test from 'node:test';
import { buildProgram } from '../../src/decision-program/orchestrator/buildProgram.ts';
import { planRun } from '../../src/decision-program/orchestrator/planRun.ts';
import { listMissingPointersBySeverity } from '../../src/decision-program/orchestrator/pointerInputRegistry.ts';
import { getByPointer } from '../../src/decision-program/runtime/pointers.ts';
import { applyPcivCommitToPlanningState } from '../../components/planning/planningUtils.ts';
import type { PcivCommittedContext, PcivField } from '../../src/decision-program/pciv/v0/types.ts';

const makeField = (pointer: string, value: PcivField['value']): PcivField => ({
  pointer,
  label: pointer,
  group: 'site',
  required: true,
  type: 'text',
  value,
  provenance: 'user-entered'
});

const makeCommit = (fields: Record<string, PcivField>): PcivCommittedContext => ({
  status: 'committed',
  committed_at: '2024-01-01T00:00:00.000Z',
  allow_partial: false,
  projectId: 'planning-workspace',
  runId: null,
  userId: null,
  sources: [],
  fields,
  constraints: [],
  metrics: {
    sources_count: 0,
    sources_ready_count: 0,
    fields_total: Object.keys(fields).length,
    fields_filled_count: Object.values(fields).filter((field) => field.value !== null && field.value !== undefined && field.value !== '').length,
    required_unresolved_count: 0,
    constraints_count: 0,
    confidence_overall: 100
  }
});

test('applyPcivCommitToPlanningState merges committed values into context', () => {
  const program = buildProgram();
  const baseContext = {
    site: {},
    regulatory: {},
    equity: {},
    species: {},
    supply: {},
    selectedDocs: [] as any[]
  };
  const state = planRun(program, baseContext);
  const initialMissing = listMissingPointersBySeverity(state, 'required');

  const commit = makeCommit({
    '/context/site/geo/locationHint': makeField('/context/site/geo/locationHint', 'Utrecht'),
    '/context/site/soil/type': makeField('/context/site/soil/type', 'loam')
  });
  const updated = applyPcivCommitToPlanningState(state, commit);
  const nextMissing = listMissingPointersBySeverity(updated, 'required');

  assert.equal(updated.pcivCommittedContext, commit);
  assert.equal(updated.context.contextVersionId, commit.committed_at);
  assert.equal(
    getByPointer(updated, '/context/site/geo/locationHint'),
    'Utrecht'
  );
  assert.equal(
    getByPointer(updated, '/context/site/soil/type'),
    'loam'
  );
  assert.ok(nextMissing.length < initialMissing.length);
});
