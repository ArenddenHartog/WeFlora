import type { Agent } from '../types.ts';
import { buildDraftMatrix } from '../../orchestrator/buildDraftMatrix.ts';
import { STREET_TREE_SHORTLIST_REQUIRED_POINTERS } from '../../orchestrator/canonicalPointers.ts';

export const generateCandidates: Agent = {
  id: 'generate-candidates',
  title: 'Generate candidate species',
  phase: 'species',
  requiredPointers: STREET_TREE_SHORTLIST_REQUIRED_POINTERS,
  producesPointers: ['/draftMatrix'],
  run: async ({ context, state }) => {
    const evidenceFromDocs = (context.selectedDocs ?? []).map((doc, index) => ({
      sourceId: String((doc as any)?.sourceId ?? (doc as any)?.id ?? (doc as any)?.name ?? (doc as any)?.title ?? `doc-${index + 1}`),
      sourceType: 'project',
      locationHint: 'selected doc',
      note: 'Used as input'
    }));
    const evidenceItems = state.evidenceItems ?? [];
    const evidenceFromAnalysis = evidenceItems.slice(0, 3).map((item) => ({
      sourceId: item.citations[0]?.sourceId ?? item.id,
      claim: item.claim,
      citations: item.citations,
      evidenceItemId: item.id
    }));
    const evidence = evidenceFromAnalysis.length > 0 ? evidenceFromAnalysis : evidenceFromDocs;
    const rows = [
      {
        id: 'row-1',
        cells: [
          { columnId: 'species', value: 'Quercus rubra' },
          { columnId: 'genus', value: 'Quercus' },
          { columnId: 'commonName', value: 'Northern Red Oak' },
          {
            columnId: 'keyReason',
            value: 'Strong canopy shade and urban tolerance.',
            rationale: 'Best-in-class shade with a solid urban track record.',
            evidence: evidence.length ? evidence : undefined
          },
          {
            columnId: 'notes',
            value: 'Monitor for oak wilt risk.',
            rationale: 'Note disease monitoring needs early.',
            evidence: evidence.length ? evidence : undefined
          }
        ]
      },
      {
        id: 'row-2',
        cells: [
          { columnId: 'species', value: 'Gleditsia triacanthos' },
          { columnId: 'genus', value: 'Gleditsia' },
          { columnId: 'commonName', value: 'Honeylocust' },
          {
            columnId: 'keyReason',
            value: 'Filtered shade and adaptable to compacted soils.',
            rationale: 'Balances canopy coverage with tough urban fit.',
            evidence: evidence.length ? evidence : undefined
          },
          {
            columnId: 'notes',
            value: 'Select thornless cultivars.',
            rationale: 'Cultivar selection avoids maintenance risks.',
            evidence: evidence.length ? evidence : undefined
          }
        ]
      },
      {
        id: 'row-3',
        cells: [
          { columnId: 'species', value: 'Tilia cordata' },
          { columnId: 'genus', value: 'Tilia' },
          { columnId: 'commonName', value: 'Littleleaf Linden' },
          {
            columnId: 'keyReason',
            value: 'Good form and pollinator support.',
            rationale: 'Supports pollinator goals with tidy form.',
            evidence: evidence.length ? evidence : undefined
          },
          {
            columnId: 'notes',
            value: 'Watch for aphid honeydew.',
            rationale: 'Maintenance notes based on known issues.',
            evidence: evidence.length ? evidence : undefined
          }
        ]
      }
    ];

    return {
      patches: [
        {
          pointer: '/draftMatrix',
          value: buildDraftMatrix(rows)
        }
      ]
    };
  }
};
