import assert from 'node:assert/strict';
import type { FloraGPTResponseEnvelope, Matrix } from '../types';
import { buildWorksheetContextPack } from '../src/floragpt/worksheet/buildWorksheetContextPack.ts';
import type { WorksheetSelectionSnapshot } from '../src/floragpt/worksheet/types.ts';
import { buildEvidencePack } from '../src/floragpt/orchestrator/buildEvidencePack.ts';
import { applyModeResultToWorksheet, __test__ as worksheetTestUtils } from '../src/floragpt/worksheet/applyModeResultToWorksheet.ts';

const makeMatrix = (rowsCount: number, colsCount: number): Matrix => {
  const columns = Array.from({ length: colsCount }, (_, idx) => ({
    id: `col-${idx}`,
    title: `Column ${idx}`,
    type: 'text' as const,
    width: 120,
    visible: true
  }));

  const rows = Array.from({ length: rowsCount }, (_, idx) => ({
    id: `row-${idx}`,
    cells: Object.fromEntries(columns.map((col) => [col.id, { columnId: col.id, value: 'x'.repeat(600) }]))
  }));

  return {
    id: 'matrix-1',
    title: 'Worksheet A',
    columns,
    rows
  } as Matrix;
};

const selection: WorksheetSelectionSnapshot = {
  matrixId: 'matrix-1',
  selectedRowIds: ['row-0', 'row-1', 'row-2'],
  selectedColumnIds: ['col-0', 'col-1'],
  activeCell: { rowId: 'row-0', columnId: 'col-0' }
};

const matrix = makeMatrix(30, 40);
const pack = buildWorksheetContextPack({ matrix, selection, projectId: 'project-1' });
assert.equal(pack.sourceId, 'worksheet:matrix-1');
assert.equal(pack.scope, 'project:project-1');

const parsed = JSON.parse(pack.snippet);
assert.ok(parsed.columns.length <= 25);
assert.ok(parsed.sampledRows.length <= 20);
assert.ok(pack.snippet.length <= 40 * 1024);

const cellValue = parsed.sampledRows[0].cells['Column 0'];
assert.ok(String(cellValue).includes('truncated'));
assert.ok(String(cellValue).length <= 500 + 15);

const evidencePack = await buildEvidencePack({
  mode: 'suitability_scoring',
  projectId: 'project-1',
  query: 'worksheet context',
  contextItems: [],
  selectedDocs: [],
  evidencePolicy: { includeGlobalKB: false, includeProjectEnvelope: false, includePolicyDocs: 'only_if_selected' },
  worksheetContextHit: pack
});
assert.equal(evidencePack.projectHits[0].sourceId, 'worksheet:matrix-1');
assert.equal(evidencePack.projectHits[0].sourceType, 'worksheet');
assert.equal(evidencePack.projectHits[0].scope, 'project:project-1');

const makeSimpleMatrix = (): Matrix => ({
  id: 'matrix-2',
  title: 'Worksheet B',
  columns: [
    { id: 'c1', title: 'Suitability Score', type: 'text', width: 120, visible: true },
    { id: 'c2', title: 'Risk Flags', type: 'text', width: 120, visible: true },
    { id: 'c3', title: 'Rationale', type: 'text', width: 120, visible: true },
    { id: 'c4', title: 'Citations', type: 'text', width: 120, visible: true }
  ],
  rows: [
    { id: 'row-a', cells: { c1: { columnId: 'c1', value: '' }, c2: { columnId: 'c2', value: '' }, c3: { columnId: 'c3', value: '' }, c4: { columnId: 'c4', value: '' } } },
    { id: 'row-b', cells: { c1: { columnId: 'c1', value: '' }, c2: { columnId: 'c2', value: '' }, c3: { columnId: 'c3', value: '' }, c4: { columnId: 'c4', value: '' } } }
  ]
});

const suitabilityPayload: FloraGPTResponseEnvelope = {
  responseType: 'answer',
  mode: 'suitability_scoring',
  meta: { schema_version: 'v0.1' },
  data: {
    results: [
      { score: 80, riskFlags: ['flag-a'], rationale: 'good fit', citations: ['doc-a'] },
      { score: 55, riskFlags: ['flag-b'], rationale: 'needs work', citations: ['doc-b'] }
    ]
  }
};

const reuseMatrix = makeSimpleMatrix();
const reuseResult = applyModeResultToWorksheet({
  matrix: reuseMatrix,
  targetRowIds: ['row-a', 'row-b'],
  payload: suitabilityPayload
});
assert.equal(reuseResult.columns.length, reuseMatrix.columns.length);

const rerunResult = applyModeResultToWorksheet({
  matrix: reuseResult,
  targetRowIds: ['row-a', 'row-b'],
  payload: suitabilityPayload
});
assert.equal(rerunResult.columns.length, reuseResult.columns.length);
assert.equal(rerunResult.rows[0].cells.c1.value, '80');

const rowOrderMatrix = makeSimpleMatrix();
const rowOrderResult = applyModeResultToWorksheet({
  matrix: rowOrderMatrix,
  targetRowIds: ['row-b', 'row-a'],
  payload: suitabilityPayload
});
assert.equal(rowOrderResult.rows.find((row) => row.id === 'row-b')?.cells.c1.value, '80');
assert.equal(rowOrderResult.rows.find((row) => row.id === 'row-a')?.cells.c1.value, '55');

const newColumnMatrix: Matrix = {
  id: 'matrix-3',
  title: 'Worksheet C',
  columns: [{ id: 'base', title: 'Species', type: 'text', width: 120, visible: true }],
  rows: [{ id: 'row-1', cells: { base: { columnId: 'base', value: 'Acer rubrum' } } }]
};

const firstPatch = applyModeResultToWorksheet({
  matrix: newColumnMatrix,
  targetRowIds: ['row-1'],
  payload: suitabilityPayload
});
const secondPatch = applyModeResultToWorksheet({
  matrix: firstPatch,
  targetRowIds: ['row-1'],
  payload: suitabilityPayload
});
const scoreColumnFirst = firstPatch.columns.find((col) => col.title === 'Suitability Score');
const scoreColumnSecond = secondPatch.columns.find((col) => col.title === 'Suitability Score');
assert.ok(scoreColumnFirst?.id);
assert.equal(scoreColumnFirst?.id, scoreColumnSecond?.id);
assert.equal(firstPatch.columns.length, secondPatch.columns.length);

const collisionMatrix: Matrix = {
  id: 'matrix-4',
  title: 'Worksheet D',
  columns: [],
  rows: []
};
const collisionId1 = worksheetTestUtils.buildStableColumnId(collisionMatrix.columns, 'Risk Flags');
collisionMatrix.columns.push({ id: collisionId1, title: 'Risk Flags', type: 'text', width: 120, visible: true });
const collisionId2 = worksheetTestUtils.buildStableColumnId(collisionMatrix.columns, 'Risk-Flags');
assert.notEqual(collisionId1, collisionId2);
assert.equal(collisionId2, 'col-flora-risk-flags-2');
const collisionIdRepeat = worksheetTestUtils.buildStableColumnId(collisionMatrix.columns, 'Risk-Flags');
assert.equal(collisionId2, collisionIdRepeat);

const clarifyingPayload: FloraGPTResponseEnvelope = {
  responseType: 'clarifying_questions',
  mode: 'suitability_scoring',
  meta: { schema_version: 'v0.1' },
  data: { questions: ['Need more detail.'] }
};
const clarifyingMatrix = makeSimpleMatrix();
const clarifyingResult = applyModeResultToWorksheet({
  matrix: clarifyingMatrix,
  targetRowIds: ['row-a'],
  payload: clarifyingPayload
});
assert.equal(clarifyingResult, clarifyingMatrix);

const specPayload: FloraGPTResponseEnvelope = {
  responseType: 'answer',
  mode: 'spec_writer',
  meta: { schema_version: 'v0.1' },
  data: { specTitle: 'Spec A', specFields: [{ label: 'Height', value: '5m' }], assumptions: ['assume'], citations: ['doc-c'] }
};
const specResult = applyModeResultToWorksheet({
  matrix: makeSimpleMatrix(),
  targetRowIds: ['row-a'],
  payload: specPayload
});
assert.ok(specResult.columns.some((col) => col.title === 'Spec Title'));
assert.ok(specResult.columns.some((col) => col.title === 'Spec Fields'));
assert.ok(specResult.columns.some((col) => col.title === 'Assumptions'));
assert.ok(specResult.columns.some((col) => col.title === 'Citations'));

const policyPayload: FloraGPTResponseEnvelope = {
  responseType: 'answer',
  mode: 'policy_compliance',
  meta: { schema_version: 'v0.1' },
  data: { status: 'Compliant', issues: [{ issue: 'None', citations: ['doc-d'] }], message: 'ok', citations: ['doc-d'] }
};
const policyResult = applyModeResultToWorksheet({
  matrix: makeSimpleMatrix(),
  targetRowIds: ['row-a'],
  payload: policyPayload
});
assert.ok(policyResult.columns.some((col) => col.title === 'Compliance Status'));
assert.ok(policyResult.columns.some((col) => col.title === 'Issues'));
assert.ok(policyResult.columns.some((col) => col.title === 'Message'));
assert.ok(policyResult.columns.some((col) => col.title === 'Citations'));

console.log('FloraGPT worksheet execution tests passed.');
