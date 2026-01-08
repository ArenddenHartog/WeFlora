import assert from 'node:assert/strict';
import { buildProgram } from '../src/decision-program/orchestrator/buildProgram.ts';
import { validateDecisionProgram } from '../src/decision-program/runtime/validate.ts';
import { listMissingPointers, setByPointer } from '../src/decision-program/runtime/pointers.ts';
import { createExecutionState, stepExecution } from '../src/decision-program/runtime/engine.ts';
import { buildAgentRegistry } from '../src/decision-program/agents/registry.ts';
import { buildActionCards } from '../src/decision-program/orchestrator/buildActionCards.ts';
import { STREET_TREE_SHORTLIST_REQUIRED_POINTERS } from '../src/decision-program/orchestrator/canonicalPointers.ts';
import { buildDerivedInputs } from '../src/decision-program/orchestrator/derivedConstraints.ts';
import { getInputSpec } from '../src/decision-program/orchestrator/pointerInputRegistry.ts';
import { minimalDraftColumns } from '../src/decision-program/orchestrator/buildDraftMatrix.ts';
import { captureConsole } from './test-utils/captureConsole.ts';
import { buildReasoningTimelineItems, mergeTimelineEntries } from '../src/decision-program/ui/decision-accelerator/reasoningUtils.ts';
import { runSiteRegulatoryAnalysis } from '../src/decision-program/skills/siteRegulatoryAnalysis.ts';

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
  ['/a/b', '/a/c', '/context/site/soil/type']
);
assert.deepEqual(missing, ['/a/c', '/context/site/soil/type']);

const registry = buildAgentRegistry();

const runnableState = createExecutionState(program, {
  site: {},
  regulatory: {},
  equity: {},
  species: {},
  supply: {}
});
STREET_TREE_SHORTLIST_REQUIRED_POINTERS.forEach((pointer) => {
  const spec = getInputSpec(pointer);
  let value: unknown = spec?.defaultValue ?? 'Unknown';
  if (spec?.input.type === 'boolean') {
    value = false;
  } else if (spec?.input.type === 'number') {
    value = 1;
  } else if (spec?.input.type === 'select') {
    value = spec.input.options?.[0] ?? 'unknown';
  }
  setByPointer(runnableState, pointer, value);
});
const runnableResult = await stepExecution(runnableState, program, registry);
assert.ok(runnableResult.steps.every((step) => step.status === 'done'));
assert.ok(runnableResult.timelineEntries?.length ?? 0 >= 0);

const blockedMissingPointers = [
  '/context/site/soil/compaction',
  '/context/regulatory/setting',
  '/context/species/goals/primaryGoal'
];
const blockedState = createExecutionState(program, {
  site: {},
  regulatory: {},
  equity: {},
  species: {},
  supply: {}
});
STREET_TREE_SHORTLIST_REQUIRED_POINTERS.forEach((pointer) => {
  if (blockedMissingPointers.includes(pointer)) return;
  const spec = getInputSpec(pointer);
  let value: unknown = spec?.defaultValue ?? 'Unknown';
  if (spec?.input.type === 'boolean') {
    value = false;
  } else if (spec?.input.type === 'number') {
    value = 1;
  } else if (spec?.input.type === 'select') {
    value = spec.input.options?.[0] ?? 'unknown';
  }
  setByPointer(blockedState, pointer, value);
});
const blockedCapture = await captureConsole(() => stepExecution(blockedState, program, registry));
const blockedResult = blockedCapture.result;
const blockedStep = blockedResult.steps.find((step) => step.status === 'blocked');
assert.ok(blockedStep);
assert.deepEqual(blockedStep?.blockingMissingInputs, blockedMissingPointers);
const blockedWarns = blockedCapture.entries.filter((entry) => entry.level === 'warn');
assert.ok(blockedWarns.some((entry) => entry.args.some((arg) => String(arg).includes('decision_program_blocked'))));
const blockedErrors = blockedCapture.entries.filter((entry) => entry.level === 'error');
assert.equal(blockedErrors.length, 0);

const cards = buildActionCards(blockedResult);
const cardTypes = cards.map((card) => card.type).sort();
assert.ok(cardTypes.includes('refine'));
const refineCard = cards.find((card) => card.type === 'refine');
assert.ok(refineCard);
assert.ok(refineCard?.inputs);
assert.ok((refineCard?.inputs?.length ?? 0) >= (blockedStep?.blockingMissingInputs?.length ?? 0));
blockedMissingPointers.forEach((pointer) => {
  const spec = getInputSpec(pointer);
  const input = refineCard?.inputs?.find((candidate) => candidate.pointer === pointer);
  assert.ok(spec);
  assert.ok(input);
  assert.equal(input?.label, spec?.input.label);
  assert.equal(input?.type, spec?.input.type);
});

const matrix = runnableResult.draftMatrix;
assert.ok(matrix);
const columnIds = matrix?.columns.map((col) => col.id) ?? [];
const minimalIds = minimalDraftColumns.map((col) => col.id);
minimalIds.forEach((id) => assert.ok(columnIds.includes(id)));
assert.ok(columnIds.includes('heatTolerance'));
assert.ok(columnIds.includes('droughtTolerance'));
assert.ok(columnIds.includes('compactionTolerance'));
assert.ok(columnIds.includes('overallScore'));
assert.ok(!columnIds.includes('availabilityWindow'));
assert.ok(!columnIds.includes('stockStatus'));
const heatColumn = matrix?.columns.find((column) => column.id === 'heatTolerance');
const droughtColumn = matrix?.columns.find((column) => column.id === 'droughtTolerance');
const overallColumn = matrix?.columns.find((column) => column.id === 'overallScore');
assert.equal(heatColumn?.skillId, 'heat_resilience');
assert.equal(droughtColumn?.skillId, 'drought_resilience');
assert.equal(overallColumn?.skillId, 'overall_fit');

const nextStepCard = cards.find((card) => card.type === 'next_step');
if (nextStepCard) {
  const nextActions = nextStepCard.suggestedActions?.map((action) => action.action) ?? [];
  assert.ok(nextActions.includes('route:worksheet'));
  assert.ok(nextActions.includes('route:report'));
}

const patchedState = { ...blockedResult } as any;
blockedMissingPointers.forEach((pointer) => {
  const spec = getInputSpec(pointer);
  let value: unknown = spec?.defaultValue ?? 'Unknown';
  if (spec?.input.type === 'boolean') {
    value = false;
  } else if (spec?.input.type === 'number') {
    value = 1;
  } else if (spec?.input.type === 'select') {
    value = spec.input.options?.[0] ?? 'unknown';
  }
  setByPointer(patchedState, pointer, value);
});
const resumedResult = await stepExecution(patchedState, program, registry);
assert.ok(resumedResult.steps.every((step) => step.status === 'done'));

const stepsVM = program.steps.map((step) => ({
  stepId: step.id,
  title: step.title,
  kind: step.kind,
  status: 'done' as const
}));
const timelineItems = buildReasoningTimelineItems(stepsVM, []);
assert.ok(timelineItems.length > 0);
assert.ok(timelineItems.every((item) => item.keyFindings.length >= 0));

const analysisResult = await runSiteRegulatoryAnalysis({
  fileRefs: [
    {
      id: 'file-1',
      title: 'Regulatory Summary',
      content: 'Page 3\nRegulatory setting: Provincial road\nSoil compaction risk: high\nLight exposure: partial shade'
    }
  ],
  locationHint: 'Main St'
});
assert.equal(analysisResult.derivedConstraints.regulatory.setting, 'Provincial road');
assert.equal(analysisResult.derivedConstraints.site.compactionRisk, 'high');
assert.ok(analysisResult.evidenceItems.length >= 2);
assert.equal(analysisResult.evidenceItems[0].citations[0]?.sourceId, 'file-1');

const derivedInputs = buildDerivedInputs(
  analysisResult.derivedConstraints,
  analysisResult.evidenceByPointer,
  analysisResult.timelineEntry.id
);
assert.ok(Object.keys(derivedInputs).length > 0);
const firstDerived = Object.values(derivedInputs)[0];
assert.ok(firstDerived.timelineEntryId);

const pipelineState = createExecutionState(program, {
  site: { geo: { locationHint: 'Maple Ave' } },
  regulatory: {},
  equity: {},
  species: {},
  supply: {},
  selectedDocs: [
    {
      id: 'file-2',
      title: 'Site Brief',
      content: 'Light exposure: full sun\nSoil type: loam\nCompaction risk: medium'
    }
  ]
});
const pipelineResult = await stepExecution(pipelineState, program, registry);
assert.ok(pipelineResult.derivedConstraints?.site.lightExposure);
assert.ok(pipelineResult.timelineEntries?.some((entry) => entry.stepId === 'site:strategic-site-regulatory-analysis'));

const mergedTimeline = mergeTimelineEntries([analysisResult.timelineEntry], timelineItems);
assert.ok(mergedTimeline.some((item) => item.title.includes('Strategic site')));
