import type { Agent } from '../types.ts';
import type { DraftMatrix } from '../../types.ts';

export const scoreCandidates: Agent = {
  id: 'score-candidates',
  title: 'Score candidate species',
  phase: 'species',
  requiredPointers: ['/draftMatrix'],
  producesPointers: ['/draftMatrix'],
  run: async ({ state }) => {
    const matrix = state.draftMatrix as DraftMatrix | undefined;
    if (!matrix) {
      return { patches: [] };
    }

    const dynamicColumn = {
      id: 'climateTolerance',
      label: 'Climate Tolerance',
      kind: 'trait' as const,
      datatype: 'string' as const,
      why: 'Aligns with projected climate conditions for the corridor.'
    };

    const scoreColumn = {
      id: 'overallScore',
      label: 'Overall Fit Score',
      kind: 'score' as const,
      datatype: 'number' as const,
      why: 'Composite score based on site fit and maintenance.'
    };

    const columns = matrix.columns.some((col) => col.id === dynamicColumn.id)
      ? matrix.columns
      : [...matrix.columns, dynamicColumn, scoreColumn];

    const rows = matrix.rows.map((row, index) => {
      const cells = [...row.cells];
      if (!cells.find((cell) => cell.columnId === dynamicColumn.id)) {
        cells.push({
          columnId: dynamicColumn.id,
          value: index === 1 ? 'High' : 'Medium',
          rationale: 'Matches local hardiness and heat tolerance.'
        });
      }
      if (!cells.find((cell) => cell.columnId === scoreColumn.id)) {
        cells.push({
          columnId: scoreColumn.id,
          value: 80 - index * 5,
          rationale: 'Weighted score based on constraints.'
        });
      }
      return { ...row, cells };
    });

    return {
      patches: [
        {
          pointer: '/draftMatrix',
          value: { ...matrix, columns, rows }
        }
      ]
    };
  }
};
