import assert from 'node:assert/strict';
import { resolveMode } from '../src/floragpt/orchestrator/resolveMode.ts';
import { ensureContext } from '../src/floragpt/orchestrator/ensureContext.ts';
import { validateFloraGPTPayload } from '../src/floragpt/schemas/validate.ts';
import { buildCitationsFromEvidencePack } from '../src/floragpt/orchestrator/buildCitations.ts';
import type { WorkOrder } from '../src/floragpt/types.ts';

const workOrderBase: WorkOrder = {
  mode: 'general_research',
  schemaVersion: 'v0.1',
  projectId: 'proj-1',
  privateEnvelopeId: null,
  userQuery: 'Compare street trees',
  userLanguage: 'auto',
  responseMode: 'short',
  viewContext: 'chat',
  selectedDocs: []
};

assert.equal(
  resolveMode({
    userQuery: 'Is this allowed by policy?',
    selectedDocs: [{ type: 'policy_manual' }]
  }),
  'policy_compliance'
);

const policyGate = ensureContext({
  ...workOrderBase,
  mode: 'policy_compliance',
  selectedDocs: []
});
assert.ok(policyGate);

const validPayload = {
  schemaVersion: 'v0.1',
  mode: 'general_research',
  responseType: 'answer',
  data: { summary: 'Summary.' }
};
const validation = validateFloraGPTPayload('general_research', validPayload);
assert.ok(validation.ok);

const citations = buildCitationsFromEvidencePack({
  globalHits: [],
  projectHits: [
    {
      sourceId: 'doc-1',
      sourceType: 'project',
      title: 'Project File',
      locationHint: 'page 2',
      snippet: 'Snippet'
    }
  ],
  policyHits: []
});
assert.equal(citations.length, 1);
assert.equal(citations[0].sourceId, 'doc-1');

console.log('FloraGPT tests passed.');
