import type { ActionCard, ActionCardInput, ActionCardSuggestedAction, ActionInputType, ExecutionState } from '../types.ts';

const labelFromPointer = (pointer: string) => {
  const cleaned = pointer.replace(/^\/+/, '').replace(/^context\//, '');
  const parts = cleaned.split('/');
  return parts
    .map((part) => part.replace(/([A-Z])/g, ' $1'))
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' → ');
};

const inputTypeForPointer = (pointer: string): ActionInputType => {
  const lowered = pointer.toLowerCase();
  if (/(zone|hardiness|location|context|goal|soil|constraints|utilities|width)/.test(lowered)) {
    return 'text';
  }
  return 'text';
};

const optionsForPointer = (pointer: string): string[] | undefined => {
  if (pointer.toLowerCase().includes('goal')) {
    return ['shade', 'biodiversity', 'drought', 'heat', 'low-maintenance', 'compliance'];
  }
  return undefined;
};

export const buildActionCards = (state: ExecutionState): ActionCard[] => {
  const blockedStep = state.steps.find((step) => step.status === 'blocked');
  const missing = blockedStep?.blockingMissingInputs ?? [];
  const refineInputs: ActionCardInput[] = missing.map((pointer) => {
    const baseType = inputTypeForPointer(pointer);
    const options = optionsForPointer(pointer);
    const type = options ? 'select' : baseType;
    return {
      id: pointer.replace(/\//g, '_').replace(/^_+/, '') || 'input',
      pointer,
      label: labelFromPointer(pointer),
      type,
      required: true,
      placeholder: 'Provide value',
      options
    };
  });

  const refineDescription =
    refineInputs.length > 0
      ? `We need: ${refineInputs.map((input) => input.label).join(', ')}.`
      : 'Confirm the remaining site, regulatory, and supply constraints.';

  const refineSuggestedActions: ActionCardSuggestedAction[] = missing.map((pointer) => ({
    label: `Provide ${labelFromPointer(pointer)}`,
    action: `resolve:${pointer}`
  }));

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
