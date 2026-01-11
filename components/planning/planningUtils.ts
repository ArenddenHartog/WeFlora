import type { ExecutionState } from '../../src/decision-program/types.ts';
import type { PcivCommittedContext, PcivStage } from '../../src/decision-program/pciv/v0/types.ts';
import { applyCommittedContext } from '../../src/decision-program/pciv/v0/context.ts';
import { buildActionCards } from '../../src/decision-program/orchestrator/buildActionCards.ts';

export type PlanningStartAction = 'pciv-import' | 'start-planning';
export type ResolveInputsAction = 'pciv-map' | 'legacy';

export const getPlanningStartLabel = (
  pcivEnabled: boolean,
  committedContext: PcivCommittedContext | null
) => {
  if (!pcivEnabled) return 'Start Planning';
  return committedContext ? 'Start Planning' : 'Start Context Intake';
};

export const getPlanningStartAction = (
  pcivEnabled: boolean,
  committedContext: PcivCommittedContext | null
): PlanningStartAction => {
  if (pcivEnabled && !committedContext) return 'pciv-import';
  return 'start-planning';
};

export const getResolveInputsAction = (pcivEnabled: boolean): ResolveInputsAction => (
  pcivEnabled ? 'pciv-map' : 'legacy'
);

export const parseContextIntakeStage = (value: string | null): PcivStage => {
  if (value === 'map' || value === 'validate' || value === 'import') {
    return value;
  }
  return 'import';
};

export const parseContextIntakeFocus = (value: string | null): 'missingRequired' | null =>
  value === 'missingRequired' ? 'missingRequired' : null;

export const getContextIntakeUrl = (
  stage: PcivStage,
  options?: { focus?: 'missingRequired' | null }
) => {
  const params = new URLSearchParams();
  params.set('stage', stage);
  if (options?.focus) {
    params.set('focus', options.focus);
  }
  return `/planning/context-intake?${params.toString()}`;
};

export const getResolveInputsUrl = (stage: PcivStage = 'validate') =>
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

export const applyPcivCommitToPlanningState = (
  state: ExecutionState,
  committedContext: PcivCommittedContext
): ExecutionState => {
  const nextContext = applyCommittedContext(state.context, committedContext);
  const contextWithVersion = {
    ...nextContext,
    contextVersionId: committedContext.committed_at
  };
  const updated = {
    ...state,
    context: contextWithVersion,
    pcivCommittedContext: committedContext
  };
  return {
    ...updated,
    actionCards: buildActionCards(updated)
  };
};
