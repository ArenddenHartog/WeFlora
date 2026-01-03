import assert from 'node:assert/strict';
import { resolveMode } from '../src/floragpt/orchestrator/resolveMode.ts';
import { ensureContext } from '../src/floragpt/orchestrator/ensureContext.ts';
import { validateFloraGPTPayload } from '../src/floragpt/schemas/validate.ts';
import { buildCitationsFromEvidencePack } from '../src/floragpt/orchestrator/buildCitations.ts';
import { extractFirstJson } from '../src/floragpt/utils/extractJson.ts';
import { buildEvidencePack } from '../src/floragpt/orchestrator/buildEvidencePack.ts';
import { extractReferencedSourceIds } from '../src/floragpt/utils/extractReferencedSourceIds.ts';
import { mapSelectedDocs } from '../src/floragpt/utils/mapSelectedDocs.ts';
import { guardEvidencePack } from '../src/floragpt/orchestrator/guardEvidencePack.ts';
import { buildToneInstruction } from '../src/floragpt/orchestrator/tone.ts';
import type { WorkOrder } from '../src/floragpt/types.ts';

const workOrderBase: WorkOrder = {
  mode: 'general_research',
  schemaVersion: 'v0.2',
  projectId: 'proj-1',
  privateEnvelopeId: null,
  userQuery: 'Compare street trees',
  userLanguage: 'English',
  responseMode: 'short',
  viewContext: 'chat',
  selectedDocs: []
};

const toneGeneral = buildToneInstruction({ ...workOrderBase, mode: 'general_research', viewContext: 'chat' });
const toneSuitability = buildToneInstruction({ ...workOrderBase, mode: 'suitability_scoring', viewContext: 'chat' });
const toneWorksheet = buildToneInstruction({ ...workOrderBase, mode: 'general_research', viewContext: 'worksheet' });
assert.notEqual(toneGeneral, toneSuitability);
assert.notEqual(toneGeneral, toneWorksheet);
assert.notEqual(toneSuitability, toneWorksheet);

let evidencePackCalled = false;
const gateResult = await guardEvidencePack({
  workOrder: { ...workOrderBase, userQuery: 'Suggest trees' },
  buildEvidencePack: async () => {
    evidencePackCalled = true;
    return { globalHits: [], projectHits: [], policyHits: [] };
  }
});
assert.ok(gateResult.gate);
assert.equal(evidencePackCalled, false);

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
  schemaVersion: 'v0.2',
  meta: { schema_version: 'v0.2', sources_used: [] },
  mode: 'general_research',
  responseType: 'answer',
  data: {
    output_label: 'Draft planting shortlist (v1)',
    summary: 'Summary.',
    reasoning_summary: {
      approach: ['Step 1'],
      assumptions: [],
      risks: []
    },
    follow_ups: {
      deepen: 'Question',
      refine: 'Constraint',
      next_step: 'Direction'
    }
  }
};
const validation = validateFloraGPTPayload('general_research', validPayload);
assert.ok(validation.ok);

const suitabilityPayload = {
  schemaVersion: 'v0.1',
  meta: { schema_version: 'v0.1' },
  mode: 'suitability_scoring',
  responseType: 'answer',
  data: {
    results: [
      {
        name: 'Quercus robur',
        score: 85,
        rationale: 'Strong tolerance.',
        citations: ['doc-2']
      }
    ]
  }
};
assert.ok(validateFloraGPTPayload('suitability_scoring', suitabilityPayload).ok);

const specWriterPayload = {
  schemaVersion: 'v0.1',
  meta: { schema_version: 'v0.1' },
  mode: 'spec_writer',
  responseType: 'answer',
  data: {
    specTitle: 'Tree Planting Spec',
    specFields: [{ label: 'Soil', value: 'Loamy' }],
    citations: ['doc-1']
  }
};
assert.ok(validateFloraGPTPayload('spec_writer', specWriterPayload).ok);

const policyPayload = {
  schemaVersion: 'v0.1',
  meta: { schema_version: 'v0.1' },
  mode: 'policy_compliance',
  responseType: 'answer',
  data: {
    status: 'Compliant',
    citations: ['doc-3'],
    issues: [{ issue: 'Spacing ok', citations: ['doc-3'] }]
  }
};
assert.ok(validateFloraGPTPayload('policy_compliance', policyPayload).ok);

const clarifyPayload = {
  schemaVersion: 'v0.1',
  meta: { schema_version: 'v0.1' },
  mode: 'suitability_scoring',
  responseType: 'clarifying_questions',
  data: {
    questions: ['What is the soil type?']
  }
};
assert.ok(validateFloraGPTPayload('suitability_scoring', clarifyPayload).ok);

const missingMeta = validateFloraGPTPayload('general_research', {
  schemaVersion: 'v0.2',
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
      sourceType: 'upload',
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
      sourceType: 'upload',
      title: 'Other File',
      locationHint: 'page 1',
      snippet: 'Snippet'
    }
  ],
  policyHits: []
}, ['doc-1']);
assert.equal(citedNone.length, 0);

const evidencePack = {
  globalHits: [],
  projectHits: [
    { sourceId: 'doc-1', sourceType: 'upload', title: 'Doc 1', snippet: 'Snippet', scope: 'project:project-1' },
    { sourceId: 'doc-2', sourceType: 'upload', title: 'Doc 2', snippet: 'Snippet', scope: 'project:project-1' }
  ],
  policyHits: []
};
const referencedIds = extractReferencedSourceIds(suitabilityPayload as any);
const derivedCitations = buildCitationsFromEvidencePack(evidencePack, referencedIds);
assert.equal(derivedCitations.length, 1);
assert.equal(derivedCitations[0].sourceId, 'doc-2');

const unknownCitations = buildCitationsFromEvidencePack(evidencePack, ['doc-missing']);
assert.equal(unknownCitations.length, 0);

const referenced = extractReferencedSourceIds({
  schemaVersion: 'v0.1',
  meta: { schema_version: 'v0.1' },
  mode: 'suitability_scoring',
  responseType: 'answer',
  data: {
    results: [{ citations: ['doc-3'] }]
  }
} as any);
assert.deepEqual(referenced.sort(), ['doc-3']);

const generalRefs = extractReferencedSourceIds({
  schemaVersion: 'v0.2',
  meta: { schema_version: 'v0.2', sources_used: [{ source_id: 'doc-9' }] },
  mode: 'general_research',
  responseType: 'answer',
  data: { summary: 'Summary.' }
} as any);
assert.deepEqual(generalRefs, ['doc-9']);

const invalidRefs = extractReferencedSourceIds({
  schemaVersion: 'v0.1',
  meta: { schema_version: 'v0.1' },
  mode: 'suitability_scoring',
  responseType: 'answer',
  data: {
    results: [{ citations: [{ source_id: 'doc-4' }] }]
  }
} as any);
assert.deepEqual(invalidRefs, []);

const selectedDocs = mapSelectedDocs([
  { id: 'ctx-1', itemId: 'file-1', name: 'Policy Manual', source: 'project', projectId: 'project-1' },
  { id: 'ctx-2', itemId: 'file-2', name: 'Worksheet', source: 'worksheet', projectId: 'project-1' },
  { id: 'ctx-3', itemId: 'kb-1', name: 'Global KB', source: 'knowledge' }
], 'project-1');
assert.equal(selectedDocs[0].sourceId, 'file-1');
assert.equal(selectedDocs[0].scope, 'project:project-1');
assert.equal(selectedDocs[0].sourceType, 'policy_manual');
assert.equal(selectedDocs[2].scope, 'global');

const scopedEvidencePack = await buildEvidencePack({
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
assert.ok(scopedEvidencePack.globalHits.length > 0);
assert.equal(scopedEvidencePack.projectHits.every((hit) => hit.scope === 'project:project-1'), true);

console.log('Covers: schema validation (all modes), json extraction, citation whitelist, project boundary.');
console.log('FloraGPT tests passed.');
