import assert from 'node:assert/strict';
import test from 'node:test';
import { hasCommittedPciv } from './planningUtils.ts';
import { savePcivRun } from '../../src/decision-program/pciv/v0/store.ts';
import type { PcivCommittedContext, PcivContextIntakeRun } from '../../src/decision-program/pciv/v0/types.ts';

class LocalStorageMock {
  private store = new Map<string, string>();

  getItem(key: string) {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
}

const makeCommit = (projectId: string): PcivCommittedContext => ({
  status: 'committed',
  committed_at: '2024-01-01T00:00:00.000Z',
  allow_partial: false,
  projectId,
  runId: null,
  userId: null,
  sources: [],
  fields: {},
  constraints: [],
  metrics: {
    sources_count: 0,
    sources_ready_count: 0,
    fields_total: 0,
    fields_filled_count: 0,
    required_unresolved_count: 0,
    constraints_count: 0,
    confidence_overall: 0
  }
});

test('hasCommittedPciv returns true only when a commit exists', () => {
  const localStorage = new LocalStorageMock();
  (globalThis as typeof globalThis & { window?: { localStorage: LocalStorageMock } }).window = {
    localStorage
  };
  const scopeId = 'planning-workspace-1';

  assert.equal(hasCommittedPciv(scopeId), false);

  const commit = makeCommit(scopeId);
  const run: PcivContextIntakeRun = {
    id: 'pciv-1',
    projectId: scopeId,
    userId: null,
    runId: null,
    status: commit.status,
    draft: {
      projectId: scopeId,
      runId: null,
      userId: null,
      locationHint: '',
      sources: [],
      fields: {},
      constraints: [],
      errors: []
    },
    commit,
    metrics: commit.metrics,
    createdAt: commit.committed_at,
    updatedAt: commit.committed_at
  };
  savePcivRun(run);

  assert.equal(hasCommittedPciv(scopeId), true);
});
