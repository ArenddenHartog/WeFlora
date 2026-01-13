import type { ExecutionState } from '../../src/decision-program/types.ts';
import { buildActionCards } from '../../src/decision-program/orchestrator/buildActionCards.ts';
import { setByPointer } from '../../src/decision-program/runtime/pointers.ts';
import type { PcivConstraintV1, PcivContextViewV1, PcivInputV1 } from '../../src/decision-program/pciv/v1/schemas.ts';

export type PlanningStartAction = 'pciv-import' | 'start-planning';
export type ResolveInputsAction = 'pciv-map' | 'legacy';

export const getPlanningStartLabel = (
  pcivEnabled: boolean,
  _hasCommittedContext: boolean
) => {
  if (!pcivEnabled) return 'Start Planning';
  return 'Start Planning';
};

export const getPlanningStartAction = (
  pcivEnabled: boolean,
  hasCommittedContext: boolean
): PlanningStartAction => {
  if (pcivEnabled && !hasCommittedContext) return 'pciv-import';
  return 'start-planning';
};

export const getResolveInputsAction = (pcivEnabled: boolean): ResolveInputsAction => (
  pcivEnabled ? 'pciv-map' : 'legacy'
);

export const parseContextIntakeStage = (value: string | null) => {
  if (value === 'map' || value === 'validate' || value === 'import') {
    return value;
  }
  return 'import';
};

export const parseContextIntakeFocus = (value: string | null): 'missingRequired' | null =>
  value === 'missingRequired' ? 'missingRequired' : null;

export const getContextIntakeUrl = (stage: string, options?: { focus?: 'missingRequired' | null }) => {
  const params = new URLSearchParams();
  params.set('stage', stage);
  if (options?.focus) {
    params.set('focus', options.focus);
  }
  return `/planning/context-intake?${params.toString()}`;
};

export const getResolveInputsUrl = (stage = 'validate') =>
  getContextIntakeUrl(stage, { focus: 'missingRequired' });

export const getPlanningBackTarget = (args: {
  planningProjectId?: string | null;
  resolvedProjectId?: string | null;
  fallbackPath?: string | null;
}) => {
  const targetId = args.planningProjectId ?? args.resolvedProjectId;
  if (targetId) {
    return `/project/${targetId}`;
  }
  return args.fallbackPath ?? null;
};

const isEmptyValue = (value: unknown) => value === null || value === undefined || value === '';

const readInputValue = (input: PcivInputV1) => {
  switch (input.valueKind) {
    case 'number':
      return input.valueNumber;
    case 'boolean':
      return input.valueBoolean;
    case 'enum':
      return input.valueEnum;
    case 'json':
      return input.valueJson;
    default:
      return input.valueString;
  }
};

const readConstraintValue = (constraint: PcivConstraintV1) => {
  switch (constraint.valueKind) {
    case 'number':
      return constraint.valueNumber;
    case 'boolean':
      return constraint.valueBoolean;
    case 'enum':
      return constraint.valueEnum;
    case 'json':
      return constraint.valueJson;
    default:
      return constraint.valueString;
  }
};

const CONSTRAINT_POINTER_MAP: Record<string, string> = {
  'site.locationType': '/context/site/locationType',
  'site.locationHint': '/context/site/geo/locationHint',
  'site.soil.type': '/context/site/soil/type',
  'site.soil.moisture': '/context/site/soil/moisture',
  'site.soil.compaction': '/context/site/soil/compaction',
  'site.lightExposure': '/context/site/light',
  'site.rootingVolumeClass': '/context/site/space/rootingVolumeClass',
  'site.crownClearanceClass': '/context/site/space/crownClearanceClass',
  'stress.heat': '/context/site/stressors/heat',
  'stress.drought': '/context/site/stressors/drought',
  'regulatory.setting': '/context/regulatory/setting',
  'regulatory.utilitiesConflicts': '/context/regulatory/constraints/utilityConflicts',
  'regulatory.setbacksKnown': '/context/regulatory/constraints/setbacksKnown',
  'species.primaryGoal': '/context/species/goals/primaryGoal',
  'species.allergiesOrToxicityConcern': '/context/species/constraints/allergiesOrToxicityConcern',
  'supply.availabilityRequired': '/context/supply/availabilityRequired'
};

export const applyContextViewToPlanningState = (
  state: ExecutionState,
  view: PcivContextViewV1,
  opts?: { debug?: boolean }
) => {
  const patches: Array<{ pointer: string; value: unknown }> = [];

  Object.values(view.inputsByPointer).forEach((input) => {
    const value = readInputValue(input);
    if (isEmptyValue(value)) return;
    patches.push({ pointer: input.pointer, value });
  });

  view.constraints.forEach((constraint) => {
    const pointer = CONSTRAINT_POINTER_MAP[constraint.key];
    if (!pointer) return;
    const value = readConstraintValue(constraint);
    if (isEmptyValue(value)) return;
    patches.push({ pointer, value });
  });

  const contextVersionId = view.run.committedAt ?? view.run.updatedAt ?? view.run.id;
  patches.push({ pointer: '/context/contextVersionId', value: contextVersionId });

  const nextState = {
    ...state,
    context: { ...state.context }
  };

  const appliedPointers: string[] = [];
  patches
    .sort((a, b) => a.pointer.localeCompare(b.pointer))
    .forEach((patch) => {
      try {
        setByPointer(nextState, patch.pointer, patch.value);
        appliedPointers.push(patch.pointer);
      } catch (error) {
        if (opts?.debug) {
          console.warn('pciv_v1_planning_patch_failed', {
            pointer: patch.pointer,
            error: (error as Error).message
          });
        }
      }
    });

  const updated = {
    ...nextState,
    actionCards: buildActionCards(nextState)
  };

  if (opts?.debug) {
    console.info('pciv_v1_planning_hydrate', {
      runId: view.run.id,
      appliedPatchCount: appliedPointers.length,
      appliedPointers: appliedPointers.slice(0, 20)
    });
  }

  return updated;
};
