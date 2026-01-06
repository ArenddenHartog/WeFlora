import type { ActionCard, ActionCardInput, ActionCardSuggestedAction, ExecutionState } from '../types.ts';
import {
  buildRefineInputsFromPointers,
  getInputSpec,
  pointerGroupOrder
} from './pointerInputRegistry.ts';

export const buildActionCards = (state: ExecutionState): ActionCard[] => {
  const blockedStep = state.steps.find((step) => step.status === 'blocked');
  const missing = blockedStep?.blockingMissingInputs ?? [];
  const refineInputs: ActionCardInput[] = buildRefineInputsFromPointers(missing);

  const groupLabels: Record<string, string> = {
    site: 'site conditions',
    regulatory: 'regulatory constraints',
    equity: 'equity priorities',
    species: 'species goals',
    supply: 'supply availability'
  };
  const missingGroups = pointerGroupOrder.filter((group) =>
    missing.some((pointer) => getInputSpec(pointer)?.group === group)
  );
  const topGroups = missingGroups.slice(0, 3).map((group) => groupLabels[group]);
  const refineDescription =
    topGroups.length > 0
      ? `Missing ${topGroups.join(', ')}. These inputs drive scoring, compliance, and supply fit.`
      : 'Confirm the remaining site, regulatory, and supply constraints.';

  const inputsByPointer = new Map(refineInputs.map((input) => [input.pointer, input]));
  const refineSuggestedActions: ActionCardSuggestedAction[] = missing.map((pointer) => ({
    label: `Provide ${inputsByPointer.get(pointer)?.label ?? pointer}`,
    action: `resolve:${pointer}`
  }));
  const hasDefaults = missing.some((pointer) => getInputSpec(pointer)?.defaultValue !== undefined);
  if (hasDefaults) {
    refineSuggestedActions.unshift({ label: 'Apply safe defaults', action: 'refine:apply-defaults' });
  }

  return [
    {
      id: 'action-deepen',
      type: 'deepen',
      title: 'Deepen the evidence',
      description:
        'Review the strongest candidates and drill into supporting evidence and risks before final selection.',
      suggestedActions: [
        { label: 'Review top risks', action: 'open-risk-summary' },
        { label: 'Show evidence map', action: 'open-evidence-map' }
      ]
    },
    {
      id: 'action-refine',
      type: 'refine',
      title: 'Refine the missing constraints',
      description: refineDescription,
      inputs: refineInputs,
      suggestedActions: refineSuggestedActions
    },
    {
      id: 'action-next-step',
      type: 'next_step',
      title: 'Route to the next step',
      description:
        'Would you like to promote this shortlist to a Worksheet or draft a Report for stakeholder review?',
      suggestedActions: [
        { label: 'Promote to Worksheet', action: 'route:worksheet' },
        { label: 'Draft Report', action: 'route:report' }
      ]
    }
  ];
};
