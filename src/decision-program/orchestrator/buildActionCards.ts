import type { ActionCard, ActionCardInput, ActionCardSuggestedAction, ExecutionState } from '../types.ts';
import {
  buildRefineInputsFromPointers,
  getInputSpec,
  listMissingPointersBySeverity,
  pointerGroupOrder
} from './pointerInputRegistry.ts';

export const buildActionCards = (state: ExecutionState): ActionCard[] => {
  const blockedStep = state.steps.find((step) => step.status === 'blocked');
  const missingRequired = blockedStep?.blockingMissingInputs ?? listMissingPointersBySeverity(state, 'required');
  const missingRecommended = listMissingPointersBySeverity(state, 'recommended');
  const refineInputs: ActionCardInput[] = buildRefineInputsFromPointers([...missingRequired, ...missingRecommended]);

  const groupLabels: Record<string, string> = {
    site: 'site conditions',
    regulatory: 'regulatory constraints',
    equity: 'equity priorities',
    species: 'species goals',
    supply: 'supply availability'
  };
  const missingGroups = pointerGroupOrder.filter((group) =>
    missingRequired.some((pointer) => getInputSpec(pointer)?.group === group)
  );
  const topGroups = missingGroups.slice(0, 3).map((group) => groupLabels[group]);
  const refineDescription =
    topGroups.length > 0
      ? `Missing ${topGroups.join(', ')}. These inputs drive scoring, compliance, and supply fit.`
      : 'Confirm the remaining site, regulatory, and supply constraints.';

  const inputsByPointer = new Map(refineInputs.map((input) => [input.pointer, input]));
  const refineSuggestedActions: ActionCardSuggestedAction[] = missingRequired.map((pointer) => ({
    label: `Provide ${inputsByPointer.get(pointer)?.label ?? pointer}`,
    action: `resolve:${pointer}`
  }));
  const hasDefaults = [...missingRequired, ...missingRecommended].some((pointer) => getInputSpec(pointer)?.defaultValue !== undefined);
  if (hasDefaults) {
    refineSuggestedActions.unshift({ label: 'Apply safe defaults', action: 'refine:apply-defaults' });
  }

  const deepenCard: ActionCard = {
    id: 'action-deepen',
    type: 'deepen',
    title: 'Review the evidence',
    description:
      'Inspect key findings, evidence highlights, and risks before final selection.',
    suggestedActions: [
      { label: 'Review top risks', action: 'open-risk-summary' },
      { label: 'Show evidence map', action: 'open-evidence-map' }
    ]
  };

  const refineCard: ActionCard = {
    id: 'action-refine',
    type: 'refine',
    title: 'Resolve missing inputs',
    description: refineDescription,
    inputs: refineInputs,
    suggestedActions: refineSuggestedActions
  };

  const nextStepCard: ActionCard = {
    id: 'action-next-step',
    type: 'next_step',
    title: 'Move to delivery',
    description:
      'Promote this shortlist to a Worksheet or draft a Report for stakeholder review.',
    suggestedActions: [
      { label: 'Promote to Worksheet', action: 'route:worksheet' },
      { label: 'Draft Report', action: 'route:report' }
    ]
  };

  if (missingRequired.length > 0) {
    return [refineCard];
  }

  if (state.status === 'done') {
    return [deepenCard, nextStepCard];
  }

  return [refineCard, deepenCard].slice(0, 2);
};
