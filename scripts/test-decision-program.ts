import assert from 'node:assert/strict';
import { buildProgram } from '../src/decision-program/orchestrator/buildProgram.ts';
import { validateDecisionProgram } from '../src/decision-program/runtime/validate.ts';
import { listMissingPointers, setByPointer } from '../src/decision-program/runtime/pointers.ts';
import { createExecutionState, stepExecution } from '../src/decision-program/runtime/engine.ts';
import { buildAgentRegistry } from '../src/decision-program/agents/registry.ts';
import { buildActionCards } from '../src/decision-program/orchestrator/buildActionCards.ts';
import { minimalDraftColumns } from '../src/decision-program/orchestrator/buildDraftMatrix.ts';
import { captureConsole } from './test-utils/captureConsole.ts';

const program = buildProgram();
const validation = validateDecisionProgram(program);
assert.ok(validation.ok);

const programWithInputs = {
  ...program,
  actionCardTemplates: [
    {
      id: 'action-refine',
      type: 'refine',
      title: 'Refine',
      description: 'Provide missing inputs',
      inputs: [
        {
          id: 'site_context',
          pointer: '/context/site/context',
          label: 'Site context',
          type: 'text',
          required: true
        }
      ]
    }
  ]
};
const programWithInputsValidation = validateDecisionProgram(programWithInputs as any);
assert.ok(programWithInputsValidation.ok);

const invalidCapture = await captureConsole(() => validateDecisionProgram({ id: 'bad' } as any));
const invalidValidation = invalidCapture.result;
assert.equal(invalidValidation.ok, false);
assert.ok(invalidValidation.errors.length > 0);
assert.ok(invalidValidation.errors.every((error) => typeof error === 'string' && error.length > 0));
const validationErrors = invalidCapture.entries.filter((entry) => entry.level === 'error');
assert.ok(validationErrors.some((entry) => entry.args.some((arg) => String(arg).includes('decision_program_validation_failed'))));
const unexpectedValidationErrors = validationErrors.filter(
  (entry) => !entry.args.some((arg) => String(arg).includes('decision_program_validation_failed'))
);
assert.equal(unexpectedValidationErrors.length, 0);

const missing = listMissingPointers(
  { context: { site: { stripWidthM: 2 } }, a: { b: 1 } },
  ['/a/b', '/a/c', '/context/site/soilType']
);
assert.deepEqual(missing, ['/a/c', '/context/site/soilType']);

const registry = buildAgentRegistry();

const runnableState = createExecutionState(program, {
  site: { stripWidthM: 2.4, soilType: 'Loam' },
  regulatory: {},
  equity: {},
  species: {},
  supply: { availabilityWindow: 'Fall 2025' }
});
const runnableResult = await stepExecution(runnableState, program, registry);
assert.ok(runnableResult.steps.every((step) => step.status === 'done'));

const blockedState = createExecutionState(program, {
  site: { stripWidthM: 2.4, soilType: 'Loam' },
  regulatory: {},
  equity: {},
  species: {},
  supply: {}
});
const blockedCapture = await captureConsole(() => stepExecution(blockedState, program, registry));
const blockedResult = blockedCapture.result;
const blockedStep = blockedResult.steps.find((step) => step.status === 'blocked');
assert.ok(blockedStep);
assert.ok(blockedStep?.blockingMissingInputs?.includes('/context/supply/availabilityWindow'));
const blockedWarns = blockedCapture.entries.filter((entry) => entry.level === 'warn');
assert.ok(blockedWarns.some((entry) => entry.args.some((arg) => String(arg).includes('decision_program_blocked'))));
const blockedErrors = blockedCapture.entries.filter((entry) => entry.level === 'error');
assert.equal(blockedErrors.length, 0);

const cards = buildActionCards(blockedResult);
const cardTypes = cards.map((card) => card.type).sort();
assert.deepEqual(cardTypes, ['deepen', 'next_step', 'refine']);
const refineCard = cards.find((card) => card.type === 'refine');
assert.ok(refineCard);
assert.ok(refineCard?.inputs);
assert.equal(refineCard?.inputs?.length, blockedStep?.blockingMissingInputs?.length);
refineCard?.inputs?.forEach((input) => {
  assert.ok(input.pointer);
  assert.ok(blockedStep?.blockingMissingInputs?.includes(input.pointer));
});

const matrix = runnableResult.draftMatrix;
assert.ok(matrix);
const columnIds = matrix?.columns.map((col) => col.id) ?? [];
const minimalIds = minimalDraftColumns.map((col) => col.id);
minimalIds.forEach((id) => assert.ok(columnIds.includes(id)));
assert.ok(columnIds.includes('climateTolerance'));
assert.ok(columnIds.includes('overallScore'));

const nextStepCard = cards.find((card) => card.type === 'next_step');
const nextActions = nextStepCard?.suggestedActions?.map((action) => action.action) ?? [];
assert.ok(nextActions.includes('route:worksheet'));
assert.ok(nextActions.includes('route:report'));

const patchedState = { ...blockedResult } as any;
setByPointer(patchedState, blockedStep?.blockingMissingInputs?.[0] as string, 'Fall 2025');
const resumedResult = await stepExecution(patchedState, program, registry);
assert.ok(resumedResult.steps.every((step) => step.status === 'done'));
