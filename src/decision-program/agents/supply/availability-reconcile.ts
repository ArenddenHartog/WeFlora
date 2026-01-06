import type { Agent } from '../types.ts';
import type { DraftMatrix } from '../../types.ts';

export const availabilityReconcile: Agent = {
  id: 'availability-reconcile',
  title: 'Reconcile supply availability',
  phase: 'supply',
  requiredPointers: ['/context/supply/availabilityRequired', '/draftMatrix'],
  producesPointers: ['/draftMatrix', '/context/supply/availabilityStatus'],
  run: async ({ state, context }) => {
    const matrix = state.draftMatrix as DraftMatrix | undefined;
    if (!matrix) {
      return { patches: [] };
    }
    const evidence = (context.selectedDocs ?? []).map((doc, index) => ({
      sourceId: String((doc as any)?.sourceId ?? (doc as any)?.id ?? (doc as any)?.name ?? (doc as any)?.title ?? `doc-${index + 1}`),
      sourceType: 'project',
      locationHint: 'selected doc',
      note: 'Used as input'
    }));

    const rows = matrix.rows.map((row) => {
      const cells = [...row.cells];
      if (!cells.find((cell) => cell.columnId === 'availabilityWindow')) {
        cells.push({
          columnId: 'availabilityWindow',
          value: 'Seasonal ordering',
          rationale: 'Procurement aligns with seasonal availability.',
          evidence: evidence.length ? evidence : undefined
        });
      }
      if (!cells.find((cell) => cell.columnId === 'stockStatus')) {
        cells.push({
          columnId: 'stockStatus',
          value: 'Pending confirmation',
          rationale: 'Awaiting nursery confirmation.',
          evidence: evidence.length ? evidence : undefined
        });
      }
      return { ...row, cells };
    });

    return {
      patches: [
        {
          pointer: '/draftMatrix',
          value: { ...matrix, rows }
        },
        {
          pointer: '/context/supply/availabilityStatus',
          value: {
            status: 'unknown',
            note: 'Awaiting nursery availability window.'
          }
        }
      ]
    };
  }
};
