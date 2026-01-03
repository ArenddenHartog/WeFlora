import assert from 'node:assert/strict';
import { buildEvidencePack } from '../src/floragpt/orchestrator/buildEvidencePack.ts';
import { repairSourcesUsed } from '../src/floragpt/utils/repairSourcesUsed.ts';
import type { WorkOrder } from '../src/floragpt/types.ts';

const contextItems = [
  {
    id: 'ctx-1',
    itemId: 'doc-1',
    name: 'Selected Project Doc',
    source: 'project',
    projectId: 'project-1',
    content: 'Tree guidance content.'
  }
];

const selectedDocs = [
  {
    sourceId: 'doc-1',
    sourceType: 'project',
    scope: 'project:project-1',
    title: 'Selected Project Doc'
  }
];

const evidencePack = await buildEvidencePack({
  mode: 'general_research',
  projectId: 'project-1',
  query: 'tree guidance',
  contextItems,
  selectedDocs,
  evidencePolicy: {
    includeProjectEnvelope: true,
    includeGlobalKB: true,
    includePolicyDocs: 'only_if_selected'
  }
});

assert.ok(evidencePack.projectHits.length > 0);

const workOrder: WorkOrder = {
  mode: 'general_research',
  schemaVersion: 'v0.2',
  projectId: 'project-1',
  privateEnvelopeId: null,
  userQuery: 'tree guidance',
  userLanguage: 'English',
  responseMode: 'short',
  viewContext: 'chat',
  selectedDocs
};

const payload = {
  schemaVersion: 'v0.2',
  meta: { schema_version: 'v0.2', sources_used: [] },
  mode: 'general_research',
  responseType: 'answer',
  data: { summary: 'Summary.' }
};

const repaired = repairSourcesUsed(payload, workOrder, evidencePack);
assert.ok(repaired.meta?.sources_used && repaired.meta.sources_used.length > 0);
const sourceIds = repaired.meta?.sources_used?.map((entry) => entry.source_id) || [];
selectedDocs.forEach((doc) => {
  assert.ok(sourceIds.includes(doc.sourceId));
});

console.log('Selected docs produce evidence and sources_used after repair.');
