import type { Agent } from '../types.ts';

export const deriveSiteConstraints: Agent = {
  id: 'derive-site-constraints',
  title: 'Derive site constraints',
  phase: 'site',
  requiredPointers: [],
  producesPointers: ['/context/site/constraints'],
  run: async ({ context, state }) => {
    const selectedDocs = context.selectedDocs ?? [];
    const derivedSummary = state.derivedConstraints?.meta?.derivedFrom?.length
      ? 'Derived from strategic site & regulatory analysis.'
      : undefined;
    if (selectedDocs.length === 0 && !derivedSummary) {
      return { patches: [] };
    }
    return {
      patches: [
        {
          pointer: '/context/site/constraints',
          value: {
            source: derivedSummary ? 'strategic_analysis' : 'selectedDocs',
            summary: derivedSummary ?? 'Derived constraints from selected docs metadata.'
          }
        }
      ]
    };
  }
};
