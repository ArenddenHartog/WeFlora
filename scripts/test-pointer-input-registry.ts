import assert from 'node:assert/strict';
import {
  STREET_TREE_SHORTLIST_REQUIRED_POINTERS
} from '../src/decision-program/orchestrator/canonicalPointers.ts';
import {
  buildRefineInputsFromPointers,
  getInputSpec
} from '../src/decision-program/orchestrator/pointerInputRegistry.ts';

STREET_TREE_SHORTLIST_REQUIRED_POINTERS.forEach((pointer) => {
  const spec = getInputSpec(pointer);
  assert.ok(spec, `Missing spec for ${pointer}`);
  assert.ok(spec?.input.helpText);
  assert.ok(String(spec?.input.helpText).length > 0);
});

const orderedInputs = buildRefineInputsFromPointers([
  '/context/species/goals/primaryGoal',
  '/context/site/locationType',
  '/context/supply/availabilityRequired',
  '/context/regulatory/setting',
  '/context/equity/priority'
]);
assert.deepEqual(
  orderedInputs.map((input) => input.pointer),
  [
    '/context/site/locationType',
    '/context/regulatory/setting',
    '/context/equity/priority',
    '/context/species/goals/primaryGoal',
    '/context/supply/availabilityRequired'
  ]
);

const first = buildRefineInputsFromPointers(['/context/site/soil/compaction'])[0];
const second = buildRefineInputsFromPointers(['/context/site/soil/compaction'])[0];
assert.equal(first.id, second.id);
