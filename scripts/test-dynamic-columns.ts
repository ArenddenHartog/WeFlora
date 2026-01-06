import assert from 'node:assert/strict';
import type { ExecutionContext } from '../src/decision-program/types.ts';
import { buildDraftMatrix } from '../src/decision-program/orchestrator/buildDraftMatrix.ts';
import { applyDynamicColumns } from '../src/decision-program/orchestrator/dynamicColumns.ts';

const context: ExecutionContext = {
  site: {
    stressors: { heat: 'high', drought: 'medium' },
    soil: { compaction: 'high' }
  },
  regulatory: {},
  equity: {},
  species: { diversity: { rule: '10-20-30' } },
  supply: { availabilityRequired: 'availableWithinSeason' },
  selectedDocs: []
};

const base = buildDraftMatrix([
  {
    id: 'row-1',
    cells: [
      { columnId: 'species', value: 'Quercus rubra' },
      { columnId: 'overallScore', value: 87 }
    ]
  }
]);

const updated = applyDynamicColumns(base, context);
const ids = updated.columns.map((column) => column.id);

const expectedOrder = [
  'species',
  'genus',
  'commonName',
  'keyReason',
  'notes',
  'heatTolerance',
  'droughtTolerance',
  'compactionTolerance',
  'diversityCompliance',
  'availabilityWindow',
  'stockStatus',
  'overallScore'
];
assert.deepEqual(ids, expectedOrder);

const uniqueIds = new Set(ids);
assert.equal(uniqueIds.size, ids.length);

const heatColumn = updated.columns.find((column) => column.id === 'heatTolerance');
assert.ok(heatColumn?.why);
const availabilityColumn = updated.columns.find((column) => column.id === 'availabilityWindow');
assert.ok(availabilityColumn?.why);
const overallColumn = updated.columns.find((column) => column.id === 'overallScore');
assert.ok(overallColumn?.why);

const ignoreSupplyContext: ExecutionContext = {
  ...context,
  supply: { availabilityRequired: 'ignoreStock' }
};
const noSupply = applyDynamicColumns(base, ignoreSupplyContext);
assert.ok(!noSupply.columns.some((column) => column.id === 'availabilityWindow'));
assert.ok(!noSupply.columns.some((column) => column.id === 'stockStatus'));
