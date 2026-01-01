import assert from 'node:assert/strict';
import type { Matrix } from '../types';
import { buildWorksheetContextPack } from '../src/floragpt/worksheet/buildWorksheetContextPack.ts';
import type { WorksheetSelectionSnapshot } from '../src/floragpt/worksheet/types.ts';
import { buildEvidencePack } from '../src/floragpt/orchestrator/buildEvidencePack.ts';

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

const cellValue = parsed.sampledRows[0].cells['Column 0'];
assert.ok(String(cellValue).includes('truncated'));

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

console.log('FloraGPT worksheet context pack tests passed.');
