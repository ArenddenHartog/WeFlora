import assert from 'node:assert/strict';
import type { ActionCardInput, ActionCardSuggestedAction } from '../src/decision-program/types.ts';
import { buildProgram } from '../src/decision-program/orchestrator/buildProgram.ts';
import {
  buildDefaultPatchesForPointers,
  buildDefaultsLogEntry
} from '../src/decision-program/orchestrator/pointerInputRegistry.ts';
import { createExecutionState, stepExecution } from '../src/decision-program/runtime/engine.ts';
import { buildAgentRegistry } from '../src/decision-program/agents/registry.ts';
import { setByPointer } from '../src/decision-program/runtime/pointers.ts';
import {
  buildPatchesForInputs,
  normalizeNumberInputValue,
  shouldDisableRefine,
  buildSuggestedActionSubmitArgs
} from '../src/decision-program/ui/decision-accelerator/actionCardUtils.ts';

const inputs: ActionCardInput[] = [
  { id: 'a', pointer: '/context/site/soil/type', label: 'Soil', type: 'text', required: true },
  { id: 'b', pointer: '/context/site/stripWidthM', label: 'Width', type: 'number', required: false }
];

const emptyValues = { a: '', b: undefined };
assert.equal(shouldDisableRefine(inputs, emptyValues), true);

const filledValues = { a: 'Loam', b: 2.4 };
assert.equal(shouldDisableRefine(inputs, filledValues), false);

const patches = buildPatchesForInputs(inputs, { a: 'Loam', b: undefined });
assert.deepEqual(patches, [{ pointer: '/context/site/soil/type', value: 'Loam' }]);

const numberEmpty = normalizeNumberInputValue('');
assert.equal(numberEmpty, undefined);

const numberValue = normalizeNumberInputValue('3.5');
assert.equal(numberValue, 3.5);

const action: ActionCardSuggestedAction = { label: 'Go', action: 'route:worksheet' };
const submitArgs = buildSuggestedActionSubmitArgs({ id: 'card-1', type: 'next_step', title: 'Next', description: 'Next' }, action);
assert.deepEqual(submitArgs, { cardId: 'card-1', cardType: 'next_step', input: { action: 'route:worksheet' } });

const program = buildProgram();
const registry = buildAgentRegistry();
const defaultState = createExecutionState(program, {
  site: {},
  regulatory: {},
  equity: {},
  species: {},
  supply: {}
});
const requiredPointers = program.steps.find((step) => step.id === 'species:generate-candidates')?.requiredPointers ?? [];
requiredPointers.forEach((pointer) => {
  if (pointer === '/context/equity/priority' || pointer === '/context/species/diversity/rule') return;
  if (pointer === '/draftMatrix') return;
  setByPointer(defaultState, pointer, 'seed');
});
const { patches: defaultPatches, appliedPointers } = buildDefaultPatchesForPointers(defaultState, [
  '/context/equity/priority',
  '/context/species/diversity/rule'
]);
assert.deepEqual(
  defaultPatches,
  [
    { pointer: '/context/equity/priority', value: 'neutral' },
    { pointer: '/context/species/diversity/rule', value: '10-20-30' }
  ]
);
assert.deepEqual(appliedPointers, ['/context/equity/priority', '/context/species/diversity/rule']);
const logEntry = buildDefaultsLogEntry({ runId: defaultState.runId, pointers: appliedPointers });
assert.equal(logEntry.message, 'Applied safe defaults');
assert.deepEqual(logEntry.data?.pointers, appliedPointers);

const patchedState = { ...defaultState } as any;
defaultPatches.forEach((patch) => setByPointer(patchedState, patch.pointer, patch.value));
const resumedResult = await stepExecution(patchedState, program, registry);
assert.ok(resumedResult.steps.every((step) => step.status === 'done'));
