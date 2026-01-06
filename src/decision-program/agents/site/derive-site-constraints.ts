import type { Agent } from '../types.ts';

export const deriveSiteConstraints: Agent = {
  id: 'derive-site-constraints',
  title: 'Derive site constraints',
  phase: 'site',
  requiredPointers: [],
  producesPointers: ['/context/site/constraints'],
  run: async ({ context }) => {
    const selectedDocs = context.selectedDocs ?? [];
    if (selectedDocs.length === 0) {
      return { patches: [] };
    }
    return {
      patches: [
        {
          pointer: '/context/site/constraints',
          value: {
            source: 'selectedDocs',
            summary: 'Derived constraints from selected docs metadata.'
          }
        }
      ]
    };
  }
};
