import assert from 'node:assert/strict';
import { resolveMode } from '../src/floragpt/orchestrator/resolveMode.ts';
import { ensureContext } from '../src/floragpt/orchestrator/ensureContext.ts';
import { validateFloraGPTPayload } from '../src/floragpt/schemas/validate.ts';
import { buildCitationsFromEvidencePack } from '../src/floragpt/orchestrator/buildCitations.ts';
import { extractFirstJson } from '../src/floragpt/utils/extractJson.ts';
import { buildEvidencePack } from '../src/floragpt/orchestrator/buildEvidencePack.ts';
import { extractReferencedSourceIds } from '../src/floragpt/utils/extractReferencedSourceIds.ts';
import { mapSelectedDocs } from '../src/floragpt/utils/mapSelectedDocs.ts';
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
    selectedDocs: [{ sourceType: 'policy_manual' }]
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
  meta: { schema_version: 'v0.1' },
  mode: 'general_research',
  responseType: 'answer',
  data: { summary: 'Summary.' }
};
const validation = validateFloraGPTPayload('general_research', validPayload);
assert.ok(validation.ok);

const missingMeta = validateFloraGPTPayload('general_research', {
  schemaVersion: 'v0.1',
  mode: 'general_research',
  responseType: 'answer',
  data: { summary: 'Summary.' }
});
assert.equal(missingMeta.ok, false);

const extracted = extractFirstJson('Sure! ```json {"ok": true} ```');
assert.equal(extracted.jsonText, '{"ok": true}');

const failedExtract = extractFirstJson('no json here');
assert.equal(failedExtract.jsonText, null);

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
}, ['doc-1']);
assert.equal(citations.length, 1);
assert.equal(citations[0].sourceId, 'doc-1');

const citedNone = buildCitationsFromEvidencePack({
  globalHits: [],
  projectHits: [
    {
      sourceId: 'doc-2',
      sourceType: 'project',
      title: 'Other File',
      locationHint: 'page 1',
      snippet: 'Snippet'
    }
  ],
  policyHits: []
}, ['doc-1']);
assert.equal(citedNone.length, 0);

const referenced = extractReferencedSourceIds({
  schemaVersion: 'v0.1',
  meta: { schema_version: 'v0.1', sources_used: [{ source_id: 'doc-meta' }] },
  mode: 'suitability_scoring',
  responseType: 'answer',
  data: {
    results: [{ citations: [{ source_id: 'doc-3' }] }]
  }
} as any);
assert.deepEqual(referenced.sort(), ['doc-3', 'doc-meta']);

const selectedDocs = mapSelectedDocs([
  { id: 'ctx-1', itemId: 'file-1', name: 'Policy Manual', source: 'project', projectId: 'project-1' },
  { id: 'ctx-2', itemId: 'file-2', name: 'Worksheet', source: 'worksheet', projectId: 'project-1' },
  { id: 'ctx-3', itemId: 'kb-1', name: 'Global KB', source: 'knowledge' }
], 'project-1');
assert.equal(selectedDocs[0].sourceId, 'file-1');
assert.equal(selectedDocs[0].scope, 'project:project-1');
assert.equal(selectedDocs[0].sourceType, 'policy_manual');
assert.equal(selectedDocs[2].scope, 'global');

const evidencePack = await buildEvidencePack({
  mode: 'general_research',
  projectId: 'project-1',
  query: 'trees',
  contextItems: [
    { id: 'ctx-1', name: 'Project File', source: 'project', projectId: 'project-1' },
    { id: 'ctx-2', name: 'Other Project File', source: 'project', projectId: 'project-2' }
  ],
  evidencePolicy: {
    includeProjectEnvelope: true,
    includeGlobalKB: true,
    includePolicyDocs: 'only_if_selected'
  }
});
assert.ok(evidencePack.globalHits.length > 0);
assert.equal(evidencePack.projectHits.every((hit) => hit.scope === 'project:project-1'), true);

console.log('FloraGPT tests passed.');
