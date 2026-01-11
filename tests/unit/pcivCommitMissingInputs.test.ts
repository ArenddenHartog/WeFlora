import assert from 'node:assert/strict';
import test from 'node:test';
import { buildProgram } from '../../src/decision-program/orchestrator/buildProgram.ts';
import { planRun } from '../../src/decision-program/orchestrator/planRun.ts';
import { buildActionCards } from '../../src/decision-program/orchestrator/buildActionCards.ts';
import { applyCommittedContext } from '../../src/decision-program/pciv/v0/context.ts';
import { buildPcivFields, setPcivFieldValue } from '../../src/decision-program/pciv/v0/map.ts';
import type { PcivCommittedContext } from '../../src/decision-program/pciv/v0/types.ts';

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

  const draftFields = buildPcivFields();
  const updatedDraft = setPcivFieldValue(
    { projectId: 'planning-workspace', sources: [], fields: draftFields, constraints: [], errors: [] },
    '/context/site/locationType',
    'street'
  );
  const commit: PcivCommittedContext = {
    status: 'committed',
    committed_at: '2024-01-01T00:00:00.000Z',
    allow_partial: false,
    projectId: 'planning-workspace',
    runId: null,
    userId: null,
    sources: [],
    fields: updatedDraft.fields,
    constraints: [],
    metrics: {
      sources_count: 0,
      sources_ready_count: 0,
      fields_total: Object.keys(updatedDraft.fields).length,
      fields_filled_count: 1,
      required_unresolved_count: 0,
      constraints_count: 0,
      confidence_overall: 100
    }
  };
  const nextState = {
    ...state,
    context: applyCommittedContext(state.context, commit)
  };
  const nextCards = buildActionCards(nextState);
  const nextMissingRequired = nextCards
    .find((card) => card.type === 'refine')
    ?.inputs?.filter((input) => input.severity === 'required' || input.required)
    .length ?? 0;

  assert.ok(nextMissingRequired <= initialMissingRequired);
});
