import assert from 'node:assert/strict';
import test from 'node:test';
import type { PcivContextIntakeRun } from '../../src/decision-program/pciv/v0/types.ts';
import { savePcivRun } from '../../src/decision-program/pciv/v0/store.ts';

class LocalStorageMock {
  private store = new Map<string, string>();

  getItem(key: string) {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.store.set(key, value);
  }

  clear() {
    this.store.clear();
  }
}

test('pciv storage sanitization removes large source content', () => {
  const localStorage = new LocalStorageMock();
  (globalThis as typeof globalThis & { window?: { localStorage: LocalStorageMock } }).window = {
    localStorage
  };

  const run: PcivContextIntakeRun = {
    id: 'pciv-1',
    projectId: 'planning-workspace-1',
    userId: null,
    runId: null,
    status: 'draft',
    draft: {
      projectId: 'planning-workspace-1',
      runId: null,
      userId: null,
      locationHint: '',
      sources: [
        {
          id: 'source-1',
          type: 'file',
          name: 'big.pdf',
          mimeType: 'application/pdf',
          size: 1_500_000,
          status: 'parsed',
          content: 'x'.repeat(1_200_000),
          createdAt: '2024-01-01T00:00:00.000Z'
        }
      ],
      fields: {},
      constraints: [],
      errors: []
    },
    commit: null,
    metrics: {
      sources_count: 1,
      sources_ready_count: 1,
      fields_total: 0,
      fields_filled_count: 0,
      required_unresolved_count: 0,
      constraints_count: 0,
      confidence_overall: 0
    },
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z'
  };

  assert.doesNotThrow(() => savePcivRun(run));

  const raw = localStorage.getItem('pciv_v0_context:planning-workspace-1');
  assert.ok(raw);
  const parsed = JSON.parse(raw) as PcivContextIntakeRun;
  assert.equal(parsed.draft.sources[0].content, undefined);
});
