import type { Agent } from '../types.ts';
import type { DraftMatrix } from '../../types.ts';

export const availabilityReconcile: Agent = {
  id: 'availability-reconcile',
  title: 'Reconcile supply availability',
  phase: 'supply',
  requiredPointers: ['/context/supply/availabilityRequired', '/draftMatrix'],
  producesPointers: ['/draftMatrix', '/context/supply/availabilityStatus'],
  run: async ({ state }) => {
    const matrix = state.draftMatrix as DraftMatrix | undefined;
    if (!matrix) {
      return { patches: [] };
    }
    const availabilityColumn = {
      id: 'availability',
      label: 'Supply Availability',
      kind: 'supply' as const,
      datatype: 'string' as const,
      why: 'Matches nursery availability for the target window.'
    };

    const columns = matrix.columns.some((col) => col.id === availabilityColumn.id)
      ? matrix.columns
      : [...matrix.columns, availabilityColumn];

    const rows = matrix.rows.map((row) => {
      const cells = [...row.cells];
      if (!cells.find((cell) => cell.columnId === availabilityColumn.id)) {
        cells.push({
          columnId: availabilityColumn.id,
          value: 'Unknown',
          rationale: 'Supply reconciliation not yet confirmed.'
        });
      }
      return { ...row, cells };
    });

    return {
      patches: [
        {
          pointer: '/draftMatrix',
          value: { ...matrix, columns, rows }
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
