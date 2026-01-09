import type { ConfidenceBreakdown, EvidenceEdge, EvidenceGraph, EvidenceNode } from '../types.ts';
import { computeEffectiveImpact } from './impact.ts';

const DEFAULT_SOURCE_CONFIDENCE = 0.6;

const typeOrder: EvidenceNode['type'][] = ['source', 'evidence', 'claim', 'constraint', 'decision'];

export const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export const buildGraphIndex = (graph: EvidenceGraph) => {
  const nodesById = new Map<string, EvidenceNode>(graph.nodes.map((node) => [node.id, node]));
  const incomingEdges = new Map<string, EvidenceEdge[]>();
  const outgoingEdges = new Map<string, EvidenceEdge[]>();
  graph.edges.forEach((edge) => {
    const incoming = incomingEdges.get(edge.to) ?? [];
    incoming.push(edge);
    incomingEdges.set(edge.to, incoming);
    const outgoing = outgoingEdges.get(edge.from) ?? [];
    outgoing.push(edge);
    outgoingEdges.set(edge.from, outgoing);
  });
  return { nodesById, incomingEdges, outgoingEdges };
};

const getNodeConfidenceBase = (node: EvidenceNode) => {
  if (typeof node.confidenceBase === 'number') return node.confidenceBase;
  const metadataConfidence = node.metadata?.confidence;
  if (typeof metadataConfidence === 'number') return metadataConfidence;
  return undefined;
};

const getNodeConfidence = (node: EvidenceNode) =>
  node.confidence ?? getNodeConfidenceBase(node) ?? DEFAULT_SOURCE_CONFIDENCE;

const buildFallbackBreakdown = (formula: string, value: number, note: string): ConfidenceBreakdown => ({
  formula,
  inputs: [],
  penalties: [],
  notes: [note, `default ${value.toFixed(2)}`]
});

const computeSourceConfidence = (node: EvidenceNode): EvidenceNode => {
  const base = getNodeConfidenceBase(node) ?? DEFAULT_SOURCE_CONFIDENCE;
  const confidence = clamp01(node.confidence ?? base);
  return {
    ...node,
    confidenceBase: base,
    confidence,
    confidenceBreakdown: {
      formula: 'source baseline',
      inputs: [{ id: node.id, label: node.label, value: confidence }]
    }
  };
};

const computeClaimConfidence = (
  node: EvidenceNode,
  incoming: EvidenceEdge[],
  getNode: (id: string) => EvidenceNode | undefined
): EvidenceNode => {
  const supportEdges = incoming.filter((edge) => edge.type === 'supports');
  const conflictEdges = incoming.filter((edge) => edge.type === 'conflicts_with');
  if (supportEdges.length === 0) {
    const fallback = clamp01(getNodeConfidence(node));
    return {
      ...node,
      confidence: fallback,
      confidenceBreakdown: buildFallbackBreakdown('noisy-or supports', fallback, 'no supports')
    };
  }
  const inputs = supportEdges.map((edge) => {
    const source = getNode(edge.from);
    const sourceConfidence = source ? getNodeConfidence(source) : DEFAULT_SOURCE_CONFIDENCE;
    const edgeConfidence = edge.confidence ?? 0.8;
    const p = sourceConfidence * edgeConfidence;
    return {
      id: edge.from,
      label: source?.label ?? edge.from,
      value: p,
      weight: edgeConfidence
    };
  });
  const support = 1 - inputs.reduce((acc, input) => acc * (1 - input.value), 1);
  const conflictSum = conflictEdges.reduce((sum, edge) => sum + (edge.weight ?? 0.15), 0);
  const conflictPenalty = 1 - Math.min(0.35, conflictSum);
  const confidence = clamp01(support * conflictPenalty);
  return {
    ...node,
    confidence,
    confidenceBreakdown: {
      formula: '1 - Π(1 - p_i) × conflictPenalty',
      inputs,
      penalties: conflictEdges.length ? [{ label: 'conflictPenalty', value: conflictPenalty }] : []
    }
  };
};

const computeConstraintConfidence = (
  node: EvidenceNode,
  incoming: EvidenceEdge[],
  getNode: (id: string) => EvidenceNode | undefined
): EvidenceNode => {
  const derivedEdges = incoming.filter((edge) => edge.type === 'derived_from');
  if (derivedEdges.length === 0) {
    const fallback = clamp01(getNodeConfidence(node));
    return {
      ...node,
      confidence: fallback,
      confidenceBreakdown: buildFallbackBreakdown('weighted mean', fallback, 'no derived claims')
    };
  }
  const inputs = derivedEdges.map((edge) => {
    const claim = getNode(edge.from);
    const claimConfidence = claim ? getNodeConfidence(claim) : DEFAULT_SOURCE_CONFIDENCE;
    const q =
      claimConfidence * (edge.confidence ?? 0.85) * (edge.attenuation ?? 0.92);
    return {
      id: edge.from,
      label: claim?.label ?? edge.from,
      value: q,
      weight: edge.weight ?? 1
    };
  });
  const totalWeight = inputs.reduce((sum, input) => sum + (input.weight ?? 1), 0) || 1;
  const weightedSum = inputs.reduce((sum, input) => sum + (input.weight ?? 1) * input.value, 0);
  const confidence = clamp01(weightedSum / totalWeight);
  return {
    ...node,
    confidence,
    confidenceBreakdown: {
      formula: 'Σ(w_i*q_i)/Σ(w_i)',
      inputs
    }
  };
};

const computeDecisionConfidence = (
  node: EvidenceNode,
  incoming: EvidenceEdge[],
  getNode: (id: string) => EvidenceNode | undefined
): EvidenceNode => {
  const relevantEdges = incoming.filter((edge) =>
    ['influences', 'filters', 'scores'].includes(edge.type)
  );
  if (relevantEdges.length === 0) {
    const fallback = clamp01(getNodeConfidence(node));
    return {
      ...node,
      confidence: fallback,
      confidenceBreakdown: buildFallbackBreakdown('noisy-or impacts', fallback, 'no incoming influences')
    };
  }
  const inputs = relevantEdges.map((edge) => {
    const constraint = getNode(edge.from);
    const constraintConfidence = constraint ? getNodeConfidence(constraint) : DEFAULT_SOURCE_CONFIDENCE;
    const impact = Math.max(0, computeEffectiveImpact(edge, constraintConfidence));
    return {
      id: edge.from,
      label: constraint?.label ?? edge.from,
      value: impact,
      weight: edge.weight ?? 0.5
    };
  });
  const impactValue = 1 - inputs.reduce((acc, input) => acc * (1 - input.value), 1);
  const required = Array.isArray(node.metadata?.requiredConstraintIds)
    ? node.metadata?.requiredConstraintIds
    : [];
  const totalRequired = required.length;
  const knownRequired = required.filter((id) => {
    const constraint = getNode(id);
    return Boolean(constraint && typeof constraint.confidence === 'number');
  }).length;
  const coverage = totalRequired === 0 ? 1 : knownRequired / totalRequired;
  const coveragePenalty = 0.6 + 0.4 * coverage;
  const confidence = clamp01(impactValue * coveragePenalty);
  const penalties =
    totalRequired > 0 ? [{ label: 'coverage', value: coveragePenalty }] : [];
  return {
    ...node,
    confidence,
    confidenceBreakdown: {
      formula: '1 - Π(1 - impact_i) × coverage',
      inputs,
      penalties
    }
  };
};

export const computeConfidenceForNode = (
  node: EvidenceNode,
  incoming: EvidenceEdge[],
  getNode: (id: string) => EvidenceNode | undefined
) => {
  switch (node.type) {
    case 'source':
      return computeSourceConfidence(node);
    case 'claim':
      return computeClaimConfidence(node, incoming, getNode);
    case 'constraint':
      return computeConstraintConfidence(node, incoming, getNode);
    case 'decision':
      return computeDecisionConfidence(node, incoming, getNode);
    default:
      return node;
  }
};

export const computeConfidenceGraph = (graph: EvidenceGraph): EvidenceGraph => {
  const { nodesById, incomingEdges } = buildGraphIndex(graph);
  const updatedNodes = new Map<string, EvidenceNode>();
  const getNode = (id: string) => updatedNodes.get(id) ?? nodesById.get(id);

  typeOrder.forEach((type) => {
    graph.nodes
      .filter((node) => node.type === type)
      .forEach((node) => {
        const updated = computeConfidenceForNode(node, incomingEdges.get(node.id) ?? [], getNode);
        updatedNodes.set(node.id, updated);
      });
  });

  const nextNodes = graph.nodes.map((node) => updatedNodes.get(node.id) ?? node);
  return {
    ...graph,
    nodes: nextNodes
  };
};
