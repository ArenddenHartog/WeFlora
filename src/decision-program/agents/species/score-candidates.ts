import type { Agent } from '../types.ts';
import type { DraftMatrix } from '../../types.ts';

export const scoreCandidates: Agent = {
  id: 'score-candidates',
  title: 'Score candidate species',
  phase: 'species',
  requiredPointers: ['/draftMatrix'],
  producesPointers: ['/draftMatrix'],
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

    const rows = matrix.rows.map((row, index) => {
      const cells = [...row.cells];
      if (!cells.find((cell) => cell.columnId === 'overallScore')) {
        cells.push({
          columnId: 'overallScore',
          value: 80 - index * 5,
          rationale: 'Weighted score based on constraints.',
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
        }
      ]
    };
  }
};
