import assert from 'node:assert/strict';
import { formatEvidenceLines, groupClaimsByDomain } from '../src/decision-program/pciv/uiViewModel.ts';

const claims = [
  {
    claimId: 'claim-1',
    contextVersionId: 'ctx',
    domain: 'regulatory',
    claimType: 'fact',
    statement: 'Regulatory setting: provincial road',
    normalized: { key: 'regulatory.setting', value: 'provincialRoad', datatype: 'enum' },
    confidence: 0.9,
    confidenceRationale: 'direct quote',
    status: 'proposed',
    review: {},
    evidenceRefs: [{ evidenceId: 'e1', quote: 'provincial road', strength: 'direct' }],
    createdAt: new Date().toISOString()
  },
  {
    claimId: 'claim-2',
    contextVersionId: 'ctx',
    domain: 'biophysical',
    claimType: 'fact',
    statement: 'Soil type: loam',
    normalized: { key: 'site.soil.type', value: 'loam', datatype: 'enum' },
    confidence: 0.85,
    confidenceRationale: 'direct quote',
    status: 'proposed',
    review: {},
    evidenceRefs: [{ evidenceId: 'e2', quote: 'loam', strength: 'direct' }],
    createdAt: new Date().toISOString()
  }
];

const evidenceItems = [
  {
    evidenceId: 'e1',
    contextVersionId: 'ctx',
    sourceId: 's1',
    kind: 'text_span',
    locator: { page: 3 },
    text: 'Regulatory setting: Provincial road',
    createdAt: new Date().toISOString()
  },
  {
    evidenceId: 'e2',
    contextVersionId: 'ctx',
    sourceId: 's2',
    kind: 'text_span',
    locator: { page: 1 },
    text: 'Soil type: loam',
    createdAt: new Date().toISOString()
  }
];

const sources = [
  {
    sourceId: 's1',
    contextVersionId: 'ctx',
    type: 'file',
    title: 'Policy doc',
    metadata: {},
    createdAt: new Date().toISOString()
  },
  {
    sourceId: 's2',
    contextVersionId: 'ctx',
    type: 'file',
    title: 'Site summary',
    metadata: {},
    createdAt: new Date().toISOString()
  }
];

const grouped = groupClaimsByDomain(claims as any);
assert.equal(Object.keys(grouped).length, 2);
assert.equal(grouped.regulatory.length, 1);

const evidenceLines = formatEvidenceLines(claims[0].evidenceRefs as any, evidenceItems as any, sources as any);
assert.ok(evidenceLines[0].includes('Policy doc'));
assert.ok(evidenceLines[0].includes('p. 3'));
