import assert from 'node:assert/strict';
import type { ActionCardInput, ActionCardSuggestedAction } from '../src/decision-program/types.ts';
import {
  buildPatchesForInputs,
  normalizeNumberInputValue,
  shouldDisableRefine,
  buildSuggestedActionSubmitArgs
} from '../src/decision-program/ui/decision-accelerator/actionCardUtils.ts';

const inputs: ActionCardInput[] = [
  { id: 'a', pointer: '/context/site/soilType', label: 'Soil', type: 'text', required: true },
  { id: 'b', pointer: '/context/site/stripWidthM', label: 'Width', type: 'number', required: false }
];

const emptyValues = { a: '', b: undefined };
assert.equal(shouldDisableRefine(inputs, emptyValues), true);

const filledValues = { a: 'Loam', b: 2.4 };
assert.equal(shouldDisableRefine(inputs, filledValues), false);

const patches = buildPatchesForInputs(inputs, { a: 'Loam', b: undefined });
assert.deepEqual(patches, [{ pointer: '/context/site/soilType', value: 'Loam' }]);

const numberEmpty = normalizeNumberInputValue('');
assert.equal(numberEmpty, undefined);

const numberValue = normalizeNumberInputValue('3.5');
assert.equal(numberValue, 3.5);

const action: ActionCardSuggestedAction = { label: 'Go', action: 'route:worksheet' };
const submitArgs = buildSuggestedActionSubmitArgs({ id: 'card-1', type: 'next_step', title: 'Next', description: 'Next' }, action);
assert.deepEqual(submitArgs, { cardId: 'card-1', cardType: 'next_step', input: { action: 'route:worksheet' } });
