import assert from 'node:assert/strict';
import test from 'node:test';
import { buildProgram } from '../../orchestrator/buildProgram.ts';
import { planRun } from '../../orchestrator/planRun.ts';
import { listMissingPointersBySeverity } from '../../orchestrator/pointerInputRegistry.ts';
import { getByPointer } from '../../runtime/pointers.ts';
import { buildPcivPlanningPatches, hydratePlanningStateFromPcivCommit } from './hydratePlanning.ts';
import { savePcivRun } from './store.ts';
import type { PcivCommittedContext, PcivContextIntakeRun, PcivField } from './types.ts';

class LocalStorageMock {
  private store = new Map<string, string>();

  getItem(key: string) {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
}

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
  constraints: [
    {
      id: 'constraint-1',
      key: 'regulatory.setbacksKnown',
      domain: 'regulatory',
      label: 'Setbacks known',
      value: true,
      provenance: 'user-entered'
    }
  ],
  metrics: {
    sources_count: 0,
    sources_ready_count: 0,
    fields_total: Object.keys(fields).length,
    fields_filled_count: Object.values(fields).filter((field) => field.value !== null && field.value !== undefined && field.value !== '').length,
    required_unresolved_count: 0,
    constraints_count: 1,
    confidence_overall: 100
  }
});

test('hydratePlanningStateFromPcivCommit applies committed fields into planning context', () => {
  const localStorage = new LocalStorageMock();
  (globalThis as typeof globalThis & { window?: { localStorage: LocalStorageMock } }).window = {
    localStorage
  };

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
    '/context/site/soil/type': makeField('/context/site/soil/type', 'loam'),
    '/context/site/geo/locationHint': makeField('/context/site/geo/locationHint', 'Utrecht')
  });
  const run: PcivContextIntakeRun = {
    id: 'pciv-1',
    projectId: commit.projectId,
    userId: commit.userId ?? null,
    runId: null,
    status: commit.status,
    draft: {
      projectId: commit.projectId,
      runId: null,
      userId: commit.userId ?? null,
      locationHint: '',
      sources: [],
      fields: commit.fields,
      constraints: commit.constraints,
      errors: []
    },
    commit,
    metrics: commit.metrics,
    createdAt: commit.committed_at,
    updatedAt: commit.committed_at
  };
  savePcivRun(run);

  const hydrated = hydratePlanningStateFromPcivCommit(state, { scopeId: commit.projectId, userId: null });
  const nextMissing = listMissingPointersBySeverity(hydrated, 'required');

  assert.equal(getByPointer(hydrated, '/context/site/geo/locationHint'), 'Utrecht');
  assert.equal(getByPointer(hydrated, '/context/site/soil/type'), 'loam');
  assert.equal(hydrated.context.contextVersionId, commit.committed_at);
  assert.ok(nextMissing.length < initialMissing.length);
});

test('buildPcivPlanningPatches returns deterministic pointer ordering', () => {
  const commit = makeCommit({
    '/context/site/soil/type': makeField('/context/site/soil/type', 'loam'),
    '/context/site/geo/locationHint': makeField('/context/site/geo/locationHint', 'Utrecht')
  });
  const patches = buildPcivPlanningPatches(commit);
  const pointers = patches.map((patch) => patch.pointer);
  const sorted = [...pointers].sort((a, b) => a.localeCompare(b));

  assert.deepEqual(pointers, sorted);
  assert.ok(pointers.includes('/context/contextVersionId'));
});
