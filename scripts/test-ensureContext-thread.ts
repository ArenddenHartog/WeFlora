import assert from 'node:assert/strict';
import { ensureContext } from '../src/floragpt/orchestrator/ensureContext.ts';
import type { WorkOrder } from '../src/floragpt/types.ts';

const workOrder: WorkOrder = {
  mode: 'general_research',
  schemaVersion: 'v0.2',
  projectId: 'project-1',
  privateEnvelopeId: null,
  userQuery: 'Suggest trees',
  recentUserMessages: ['We are designing an open bike lane with loam soil.'],
  userLanguage: 'English',
  responseMode: 'short',
  viewContext: 'chat',
  selectedDocs: []
};

const gate = ensureContext(workOrder);
assert.equal(gate, null);

console.log('ensureContext respects recent user context.');
