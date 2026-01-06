import type { Agent } from '../types.ts';
import { buildDraftMatrix } from '../../orchestrator/buildDraftMatrix.ts';
import { STREET_TREE_SHORTLIST_REQUIRED_POINTERS } from '../../orchestrator/canonicalPointers.ts';

export const generateCandidates: Agent = {
  id: 'generate-candidates',
  title: 'Generate candidate species',
  phase: 'species',
  requiredPointers: STREET_TREE_SHORTLIST_REQUIRED_POINTERS,
  producesPointers: ['/draftMatrix'],
  run: async () => {
    const rows = [
      {
        id: 'row-1',
        cells: [
          { columnId: 'species', value: 'Quercus rubra' },
          { columnId: 'genus', value: 'Quercus' },
          { columnId: 'commonName', value: 'Northern Red Oak' },
          { columnId: 'keyReason', value: 'Strong canopy shade and urban tolerance.' },
          { columnId: 'notes', value: 'Monitor for oak wilt risk.' }
        ]
      },
      {
        id: 'row-2',
        cells: [
          { columnId: 'species', value: 'Gleditsia triacanthos' },
          { columnId: 'genus', value: 'Gleditsia' },
          { columnId: 'commonName', value: 'Honeylocust' },
          { columnId: 'keyReason', value: 'Filtered shade and adaptable to compacted soils.' },
          { columnId: 'notes', value: 'Select thornless cultivars.' }
        ]
      },
      {
        id: 'row-3',
        cells: [
          { columnId: 'species', value: 'Tilia cordata' },
          { columnId: 'genus', value: 'Tilia' },
          { columnId: 'commonName', value: 'Littleleaf Linden' },
          { columnId: 'keyReason', value: 'Good form and pollinator support.' },
          { columnId: 'notes', value: 'Watch for aphid honeydew.' }
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
