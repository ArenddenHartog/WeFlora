import type { EvidenceEdge, EvidenceGraph, EvidenceNode } from '../types.ts';

export const createEmptyEvidenceGraph = (): EvidenceGraph => ({
  nodes: [],
  edges: []
});

export const buildSkillNodeId = (skillId: string) => `skill:${skillId}`;
export const buildSourceNodeId = (sourceId: string) => `source:${sourceId}`;
export const buildClaimNodeId = (claimId: string) => `claim:${claimId}`;
export const buildConstraintNodeId = (pointer: string) => `constraint:${pointer}`;
export const buildArtifactNodeId = (artifactId: string) => `artifact:${artifactId}`;
export const buildDecisionNodeId = (decisionId: string) => `decision:${decisionId}`;

export const upsertEvidenceNode = (graph: EvidenceGraph, node: EvidenceNode) => {
  const existingIndex = graph.nodes.findIndex((entry) => entry.id === node.id);
  if (existingIndex === -1) {
    graph.nodes.push(node);
    return;
  }
  graph.nodes[existingIndex] = { ...graph.nodes[existingIndex], ...node };
};

export const upsertEvidenceEdge = (graph: EvidenceGraph, edge: EvidenceEdge) => {
  const exists = graph.edges.some(
    (entry) => entry.from === edge.from && entry.to === edge.to && entry.type === edge.type
  );
  if (!exists) {
    graph.edges.push(edge);
  }
};

export const mergeEvidenceGraph = (base: EvidenceGraph | undefined, next: EvidenceGraph): EvidenceGraph => {
  const graph: EvidenceGraph = {
    nodes: base?.nodes ? [...base.nodes] : [],
    edges: base?.edges ? [...base.edges] : []
  };
  next.nodes.forEach((node) => upsertEvidenceNode(graph, node));
  next.edges.forEach((edge) => upsertEvidenceEdge(graph, edge));
  return graph;
};
