import assert from 'node:assert/strict';
import test from 'node:test';
import type { ExecutionState } from '../../src/decision-program/types';
import type { PcivCommittedContext } from '../../src/decision-program/pciv/v0/types';
import { listMissingPointersBySeverity } from '../../src/decision-program/orchestrator/pointerInputRegistry.ts';
import {
  getContextIntakeUrl,
  getPlanningStartAction,
  getPlanningStartLabel
} from '../../components/planning/planningUtils.ts';
import { hydratePlanningStateFromPcivCommit } from '../../src/decision-program/pciv/v0/hydratePlanning.ts';
import { savePcivRun } from '../../src/decision-program/pciv/v0/store.ts';
import type { PcivContextIntakeRun } from '../../src/decision-program/pciv/v0/types';

class LocalStorageMock {
  private store = new Map<string, string>();

  getItem(key: string) {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
}

const committedContext: PcivCommittedContext = {
  status: 'committed',
  committed_at: '2024-01-01T00:00:00.000Z',
  allow_partial: false,
  projectId: 'project-123',
  runId: 'run-1',
  userId: null,
  sources: [],
  fields: {
    locationType: {
      pointer: '/context/site/locationType',
      label: 'Location type',
      group: 'site',
      required: true,
      type: 'select',
      options: ['street'],
      value: 'street',
      provenance: 'user-entered'
    }
  },
  constraints: [],
  metrics: {
    sources_count: 0,
    sources_ready_count: 0,
    fields_total: 1,
    fields_filled_count: 1,
    required_unresolved_count: 0,
    constraints_count: 0,
    confidence_overall: 1
  }
};

test('planning CTA resolves to context intake when no committed context is available', () => {
  assert.equal(getPlanningStartLabel(true, null), 'Start Context Intake');
  assert.equal(getPlanningStartAction(true, null), 'pciv-import');
  assert.equal(getContextIntakeUrl('import'), '/planning/context-intake?stage=import');
});

test('hydratePlanningStateFromPcivCommit recomputes missing inputs after commit', () => {
  const localStorage = new LocalStorageMock();
  (globalThis as typeof globalThis & { window?: { localStorage: LocalStorageMock } }).window = {
    localStorage
  };
  const baseState: ExecutionState = {
    runId: 'run-1',
    programId: 'program-1',
    status: 'running',
    steps: [],
    context: {
      site: {},
      regulatory: {},
      equity: {},
      species: {},
      supply: {},
      selectedDocs: []
    },
    actionCards: [],
    logs: []
  };

  const missingBefore = listMissingPointersBySeverity(baseState, 'required');
  assert.ok(missingBefore.includes('/context/site/locationType'));

  const run: PcivContextIntakeRun = {
    id: 'pciv-1',
    projectId: committedContext.projectId,
    userId: committedContext.userId ?? null,
    runId: null,
    status: committedContext.status,
    draft: {
      projectId: committedContext.projectId,
      runId: null,
      userId: committedContext.userId ?? null,
      locationHint: '',
      sources: [],
      fields: committedContext.fields,
      constraints: committedContext.constraints,
      errors: []
    },
    commit: committedContext,
    metrics: committedContext.metrics,
    createdAt: committedContext.committed_at,
    updatedAt: committedContext.committed_at
  };
  savePcivRun(run);
  const updatedState = hydratePlanningStateFromPcivCommit(baseState, { scopeId: committedContext.projectId, userId: null });
  const missingAfter = listMissingPointersBySeverity(updatedState, 'required');

  assert.ok(!missingAfter.includes('/context/site/locationType'));
  assert.ok(updatedState.actionCards.length > 0);
});
