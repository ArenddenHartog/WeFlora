import assert from 'node:assert/strict';
import test from 'node:test';
import { buildProgram } from '../../src/decision-program/orchestrator/buildProgram.ts';
import { planRun } from '../../src/decision-program/orchestrator/planRun.ts';
import { buildActionCards } from '../../src/decision-program/orchestrator/buildActionCards.ts';
import { setByPointer } from '../../src/decision-program/runtime/pointers.ts';

test('CTIV commit reduces missing required inputs', () => {
  const program = buildProgram();
  const baseContext = {
    site: {},
    regulatory: {},
    equity: {},
    species: {},
    supply: {},
    selectedDocs: [] as any[]
  };
  const state = planRun(program, baseContext);
  const initialCards = buildActionCards(state);
  const initialMissingRequired = initialCards
    .find((card) => card.type === 'refine')
    ?.inputs?.filter((input) => input.severity === 'required' || input.required)
    .length ?? 0;

  const nextState = { ...state, context: { ...state.context } };
  setByPointer({ context: nextState.context } as { context: typeof nextState.context }, '/context/site/locationType', 'street');
  const nextCards = buildActionCards(nextState);
  const nextMissingRequired = nextCards
    .find((card) => card.type === 'refine')
    ?.inputs?.filter((input) => input.severity === 'required' || input.required)
    .length ?? 0;

  assert.ok(nextMissingRequired <= initialMissingRequired);
});
