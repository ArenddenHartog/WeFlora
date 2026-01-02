import assert from 'node:assert/strict';
import { buildCitationErrors, buildCitationFailurePayload } from '../src/floragpt/orchestrator/citations.ts';
import type { WorkOrder } from '../src/floragpt/types.ts';
import type { FloraGPTResponseEnvelope } from '../types.ts';

const workOrder: WorkOrder = {
  mode: 'general_research',
  schemaVersion: 'v0.2',
  projectId: 'project-1',
  privateEnvelopeId: null,
  userQuery: 'Compare street trees',
  userLanguage: 'English',
  responseMode: 'short',
  viewContext: 'chat',
  selectedDocs: [{ sourceId: 'doc-1', sourceType: 'project', scope: 'project:project-1' }],
  evidencePolicy: {
    includeProjectEnvelope: true,
    includeGlobalKB: true,
    includePolicyDocs: 'only_if_selected'
  }
};

const evidencePack = {
  globalHits: [],
  projectHits: [{ sourceId: 'doc-1', sourceType: 'upload', title: 'Doc 1', snippet: 'Snippet' }],
  policyHits: []
};

const missingSourcesPayload: FloraGPTResponseEnvelope = {
  schemaVersion: 'v0.2',
  meta: { schema_version: 'v0.2', sources_used: [] },
  mode: 'general_research',
  responseType: 'answer',
  data: {
    output_label: 'Draft planting shortlist (v1)',
    summary: 'Summary',
    reasoning_summary: { approach: ['Step'], assumptions: [], risks: [] },
    follow_ups: ['Q1', 'Q2', 'Q3']
  }
};

const errors = buildCitationErrors(missingSourcesPayload, evidencePack, workOrder);
assert.ok(errors.length > 0);

const failurePayload = buildCitationFailurePayload(workOrder);
assert.equal(failurePayload.responseType, 'error');
assert.ok(Array.isArray(failurePayload.meta?.sources_used));

const okPayload: FloraGPTResponseEnvelope = {
  ...missingSourcesPayload,
  meta: { schema_version: 'v0.2', sources_used: [{ source_id: 'doc-1' }] }
};
const okErrors = buildCitationErrors(okPayload, evidencePack, workOrder);
assert.equal(okErrors.length, 0);

console.info('Citations enforcement test passed.');
