import type { PcivCommittedContext } from '../../src/decision-program/pciv/v0/types';

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
