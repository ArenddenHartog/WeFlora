import assert from 'node:assert/strict';
import type { DraftMatrix } from '../src/decision-program/types.ts';
import { buildWorksheetTableFromDraftMatrix, toCitationsPayload } from '../src/decision-program/orchestrator/evidenceToCitations.ts';
import { promoteDraftMatrixToWorksheet } from '../utils/draftMatrixPromotion.ts';

const evidence = [
  { sourceId: 'src-1', sourceType: 'project' },
  { sourceId: 'src-2', sourceType: 'project' },
  { sourceId: 'src-1', sourceType: 'project' }
];
const payload = toCitationsPayload(evidence, { selectedDocs: [{ id: 'doc-1' }] });
assert.deepEqual(payload.sourceIds, ['src-1', 'src-2']);
assert.ok(payload.items);

const matrix: DraftMatrix = {
  id: 'matrix-1',
  title: 'Draft',
  columns: [
    { id: 'a', label: 'A', kind: 'trait', datatype: 'string', visible: true, skillId: 'heat_resilience' },
    { id: 'b', label: 'B', kind: 'trait', datatype: 'string', visible: true, pinned: true },
    { id: 'c', label: 'C', kind: 'trait', datatype: 'string', visible: false }
  ],
  rows: [
    {
      id: 'row-1',
      cells: [
        { columnId: 'a', value: 'alpha' },
        { columnId: 'b', value: 'bravo', evidence },
        { columnId: 'c', value: 'charlie' }
      ]
    }
  ]
};

const table = buildWorksheetTableFromDraftMatrix(matrix, { includeCitations: true });
assert.deepEqual(table.columns, ['B', 'A', 'Citations']);
assert.deepEqual(table.rows[0], ['bravo', 'alpha', 'src-1; src-2']);

const promoted = promoteDraftMatrixToWorksheet(matrix, { includeCitations: true });
const promotedSkillColumn = promoted.columns.find((column) => column.title === 'A');
assert.ok(promotedSkillColumn?.skillConfig?.templateId);
assert.equal(promotedSkillColumn?.skillConfig?.templateId, 'heat_resilience');
