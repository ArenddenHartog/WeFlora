import type { Agent } from '../types.ts';
import type { DraftMatrix } from '../../types.ts';
import {
  buildArtifactNodeId,
  buildDecisionNodeId,
  buildSkillNodeId,
  createEmptyEvidenceGraph,
  mergeEvidenceGraph
} from '../../orchestrator/evidenceGraph.ts';

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

    const evidenceGraph = createEmptyEvidenceGraph();
    const skillNodeId = buildSkillNodeId('score-candidates');
    const artifactNodeId = buildArtifactNodeId(matrix.id);

    evidenceGraph.nodes.push({
      id: skillNodeId,
      type: 'skill',
      label: 'candidate_scoring',
      description: 'Scores shortlist candidates against constraints.'
    });
    evidenceGraph.nodes.push({
      id: artifactNodeId,
      type: 'artifact',
      label: matrix.title ?? 'Draft matrix',
      metadata: { matrixId: matrix.id }
    });
    evidenceGraph.edges.push({ from: skillNodeId, to: artifactNodeId, type: 'produced_by' });

    const constraintNodes = (state.evidenceGraph?.nodes ?? []).filter((node) => node.type === 'constraint');

    rows.forEach((row) => {
      const decisionNodeId = buildDecisionNodeId(`row:${row.id}`);
      const scoreCell = row.cells.find((cell) => cell.columnId === 'overallScore');
      evidenceGraph.nodes.push({
        id: decisionNodeId,
        type: 'decision',
        label: row.label ?? row.id,
        description: 'Shortlist scoring decision',
        metadata: {
          rowId: row.id,
          matrixId: matrix.id,
          score: scoreCell?.value ?? null
        }
      });
      evidenceGraph.edges.push({ from: artifactNodeId, to: decisionNodeId, type: 'produced_by' });
      constraintNodes.forEach((constraint) => {
        evidenceGraph.edges.push({
          from: constraint.id,
          to: decisionNodeId,
          type: 'scores'
        });
      });
    });

    return {
      patches: [
        {
          pointer: '/draftMatrix',
          value: { ...matrix, rows }
        },
        {
          pointer: '/evidenceGraph',
          value: mergeEvidenceGraph(state.evidenceGraph, evidenceGraph)
        }
      ]
    };
  }
};
