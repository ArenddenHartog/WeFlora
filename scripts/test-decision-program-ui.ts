import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ActionCardInput, DraftMatrix } from '../src/decision-program/types.ts';
import {
  hasMissingRecommendedInputs,
  hasMissingRequiredInputs
} from '../src/decision-program/ui/decision-accelerator/validationUtils.ts';
import {
  buildCellCitationsArgs,
  toggleMatrixColumnPinned,
  toggleMatrixColumnVisible
} from '../src/decision-program/ui/decision-accelerator/draftMatrixUtils.ts';
import { getScoreBand } from '../src/decision-program/ui/decision-accelerator/severity.ts';
import RightSidebarStepper from '../src/decision-program/ui/decision-accelerator/RightSidebarStepper.tsx';

const inputs: ActionCardInput[] = [
  { id: 'a', pointer: '/context/site/soil/type', label: 'Soil', type: 'text', severity: 'required' },
  { id: 'b', pointer: '/context/site/width', label: 'Width', type: 'number', severity: 'recommended' }
];

assert.equal(hasMissingRequiredInputs(inputs, { a: '', b: 2 }), true);
assert.equal(hasMissingRecommendedInputs(inputs, { a: 'Loam', b: '' }), true);
assert.equal(hasMissingRequiredInputs(inputs, { a: 'Loam', b: '' }), false);

const matrix: DraftMatrix = {
  id: 'matrix-1',
  columns: [
    { id: 'score', label: 'Score', kind: 'score', datatype: 'number', visible: true, pinned: false },
    { id: 'name', label: 'Name', kind: 'trait', datatype: 'string', visible: true, pinned: true }
  ],
  rows: []
};
const pinnedMatrix = toggleMatrixColumnPinned(matrix, 'score');
assert.equal(pinnedMatrix.columns.find((column) => column.id === 'score')?.pinned, true);
const hiddenMatrix = toggleMatrixColumnVisible(matrix, 'name');
assert.equal(hiddenMatrix.columns.find((column) => column.id === 'name')?.visible, false);

assert.equal(getScoreBand(0.2), 'low');
assert.equal(getScoreBand(0.6), 'medium');
assert.equal(getScoreBand(0.9), 'high');

const evidenceArgs = buildCellCitationsArgs('row-1', 'score', [{ sourceId: 'src-1' }]);
assert.deepEqual(evidenceArgs, { rowId: 'row-1', columnId: 'score', evidence: [{ sourceId: 'src-1' }] });

const stepperMarkup = renderToStaticMarkup(
  React.createElement(RightSidebarStepper, {
    runId: 'run-1',
    status: 'running',
    steps: [{ stepId: 'site:step', title: 'Site', kind: 'agent', status: 'running' }]
  })
);
assert.ok(stepperMarkup.includes('planning-stepper-scroll'));
