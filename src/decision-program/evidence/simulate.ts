import type { EvidenceEdge, EvidenceGraph, EvidenceNode } from '../types.ts';
import { buildGraphIndex, computeConfidenceForNode } from './confidence.ts';
import { computeEffectiveImpact } from './impact.ts';

export type ScenarioPatch = {
  nodeId: string;
  patch: Partial<{ value: unknown; confidence: number; confidenceSource: 'user' | 'model' }>;
  mode: 'overrideEvidence' | 'adjust';
};

export type Scenario = {
  id: string;
  name?: string;
  patches: ScenarioPatch[];
};

export type SimulationDiff = {
  changedNodes: Array<{ id: string; prevConfidence: number; nextConfidence: number }>;
  changedDecisions: Array<{
    id: string;
    prevScore?: number;
    nextScore?: number;
    prevRank?: number;
    nextRank?: number;
    prevConfidence: number;
    nextConfidence: number;
    drivers: string[];
  }>;
  evidenceTensions: Array<{ nodeId: string; conflictingSourceIds: string[] }>;
  topMovers: Array<{
    id: string;
    label: string;
    rankDelta: number;
    confidenceDelta: number;
    scoreDelta: number;
    drivers: string[];
  }>;
};

const decisionEdgeTypes = new Set<EvidenceEdge['type']>(['influences', 'filters', 'scores']);

const cloneNode = (node: EvidenceNode): EvidenceNode => ({
  ...node,
  metadata: node.metadata ? { ...node.metadata } : node.metadata
});

const computeDecisionScores = (graph: EvidenceGraph) => {
  const { nodesById, incomingEdges } = buildGraphIndex(graph);
  const scores = new Map<string, number>();
  const drivers = new Map<string, string[]>();
  graph.nodes
    .filter((node) => node.type === 'decision')
    .forEach((decision) => {
      const edges = (incomingEdges.get(decision.id) ?? []).filter((edge) => decisionEdgeTypes.has(edge.type));
      const impacts = edges.map((edge) => {
        const constraint = nodesById.get(edge.from);
        const confidence = constraint?.confidence ?? 0.6;
        const impact = computeEffectiveImpact(edge, confidence);
        return {
          id: edge.from,
          label: constraint?.label ?? edge.from,
          impact,
          weight: edge.weight ?? 0.5
        };
      });
      const totalWeight = impacts.reduce((sum, entry) => sum + Math.abs(entry.weight), 0);
      const normalized = totalWeight
        ? impacts.reduce((sum, entry) => sum + entry.impact, 0) / totalWeight
        : 0;
      const fallbackScore = typeof decision.metadata?.score === 'number' ? decision.metadata.score : 0;
      const score = impacts.length > 0 ? normalized * 100 : fallbackScore;
      const rankedDrivers = [...impacts]
        .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))
        .slice(0, 2)
        .map((entry) => entry.label);
      scores.set(decision.id, score);
      drivers.set(decision.id, rankedDrivers);
    });
  return { scores, drivers };
};

const buildRanking = (scores: Map<string, number>) => {
  const entries = [...scores.entries()];
  entries.sort((a, b) => {
    const scoreDiff = b[1] - a[1];
    if (Math.abs(scoreDiff) > 1e-6) return scoreDiff;
    return a[0].localeCompare(b[0]);
  });
  const rankMap = new Map<string, number>();
  entries.forEach(([id], index) => {
    rankMap.set(id, index + 1);
  });
  return rankMap;
};

const computeImpactedNodeIds = (graph: EvidenceGraph, patches: ScenarioPatch[]) => {
  const { outgoingEdges } = buildGraphIndex(graph);
  const impacted = new Set<string>();
  const queue: string[] = patches.map((patch) => patch.nodeId);
  queue.forEach((id) => impacted.add(id));
  while (queue.length) {
    const current = queue.shift();
    if (!current) continue;
    const edges = outgoingEdges.get(current) ?? [];
    edges.forEach((edge) => {
      if (impacted.has(edge.to)) return;
      impacted.add(edge.to);
      queue.push(edge.to);
    });
  }
  return impacted;
};

export const simulateScenario = (graph: EvidenceGraph, scenario: Scenario) => {
  const baseGraph: EvidenceGraph = {
    ...graph,
    nodes: graph.nodes.map(cloneNode)
  };
  const overlayGraph: EvidenceGraph = {
    ...graph,
    nodes: graph.nodes.map(cloneNode)
  };
  const baseIndex = buildGraphIndex(baseGraph);
  const overlayIndex = buildGraphIndex(overlayGraph);

  const lockedNodes = new Set<string>();
  scenario.patches.forEach((patch) => {
    const node = overlayIndex.nodesById.get(patch.nodeId);
    if (!node) return;
    if (patch.patch.value !== undefined) {
      node.value = patch.patch.value;
      if (node.metadata) {
        node.metadata.value = patch.patch.value;
      }
    }
    if (patch.mode === 'overrideEvidence') {
      node.confidenceSource = 'user';
      node.confidence = 0.98;
      node.confidenceBreakdown = {
        formula: 'user override',
        inputs: [{ id: node.id, label: node.label, value: node.confidence }],
        notes: ['user asserted']
      };
      lockedNodes.add(node.id);
      return;
    }
    if (typeof patch.patch.confidence === 'number') {
      node.confidence = patch.patch.confidence;
      node.confidenceSource = patch.patch.confidenceSource ?? 'user';
      node.confidenceBreakdown = {
        formula: 'scenario adjustment',
        inputs: [{ id: node.id, label: node.label, value: node.confidence }]
      };
      lockedNodes.add(node.id);
    }
  });

  const impacted = computeImpactedNodeIds(overlayGraph, scenario.patches);
  const getOverlayNode = (id: string) => overlayIndex.nodesById.get(id);
  const iterations = 5;
  for (let pass = 0; pass < iterations; pass += 1) {
    let maxDelta = 0;
    ['source', 'claim', 'constraint', 'decision'].forEach((type) => {
      overlayGraph.nodes
        .filter((node) => node.type === type && impacted.has(node.id) && !lockedNodes.has(node.id))
        .forEach((node) => {
          const prevConfidence = node.confidence ?? 0;
          const updated = computeConfidenceForNode(
            node,
            overlayIndex.incomingEdges.get(node.id) ?? [],
            getOverlayNode
          );
          overlayIndex.nodesById.set(node.id, updated);
          const nextConfidence = updated.confidence ?? 0;
          maxDelta = Math.max(maxDelta, Math.abs(nextConfidence - prevConfidence));
        });
    });
    if (maxDelta < 0.01) break;
  }

  overlayGraph.nodes = overlayGraph.nodes.map((node) => overlayIndex.nodesById.get(node.id) ?? node);

  const baseScores = computeDecisionScores(baseGraph);
  const overlayScores = computeDecisionScores(overlayGraph);
  const baseRanks = buildRanking(baseScores.scores);
  const overlayRanks = buildRanking(overlayScores.scores);

  const changedNodes = overlayGraph.nodes
    .map((node) => {
      const baseNode = baseIndex.nodesById.get(node.id);
      const prevConfidence = baseNode?.confidence ?? 0;
      const nextConfidence = node.confidence ?? 0;
      return { id: node.id, prevConfidence, nextConfidence };
    })
    .filter((entry) => Math.abs(entry.prevConfidence - entry.nextConfidence) > 0.001);

  const changedDecisions = overlayGraph.nodes
    .filter((node) => node.type === 'decision')
    .map((node) => {
      const prevScore = baseScores.scores.get(node.id);
      const nextScore = overlayScores.scores.get(node.id);
      const prevRank = baseRanks.get(node.id);
      const nextRank = overlayRanks.get(node.id);
      const prevConfidence = baseIndex.nodesById.get(node.id)?.confidence ?? 0;
      const nextConfidence = node.confidence ?? 0;
      return {
        id: node.id,
        prevScore,
        nextScore,
        prevRank,
        nextRank,
        prevConfidence,
        nextConfidence,
        drivers: overlayScores.drivers.get(node.id) ?? []
      };
    })
    .filter((entry) => {
      if (entry.prevRank !== entry.nextRank) return true;
      if (typeof entry.prevScore === 'number' && typeof entry.nextScore === 'number') {
        if (Math.abs(entry.prevScore - entry.nextScore) > 0.001) return true;
      }
      return Math.abs(entry.prevConfidence - entry.nextConfidence) > 0.001;
    });

  const topMovers = [...changedDecisions]
    .map((entry) => {
      const prevRank = entry.prevRank ?? 0;
      const nextRank = entry.nextRank ?? prevRank;
      const prevScore = entry.prevScore ?? 0;
      const nextScore = entry.nextScore ?? prevScore;
      const prevConfidence = entry.prevConfidence ?? 0;
      const nextConfidence = entry.nextConfidence ?? prevConfidence;
      const node = overlayIndex.nodesById.get(entry.id);
      return {
        id: entry.id,
        label: node?.label ?? entry.id,
        rankDelta: prevRank && nextRank ? prevRank - nextRank : 0,
        confidenceDelta: nextConfidence - prevConfidence,
        scoreDelta: nextScore - prevScore,
        drivers: entry.drivers
      };
    })
    .sort((a, b) => Math.abs(b.rankDelta) - Math.abs(a.rankDelta))
    .slice(0, 5);

  const evidenceTensions = scenario.patches
    .map((patch) => {
      const conflictEdges = (overlayIndex.incomingEdges.get(patch.nodeId) ?? []).filter(
        (edge) => edge.type === 'conflicts_with'
      );
      const conflicts = conflictEdges
        .map((edge) => overlayIndex.nodesById.get(edge.from))
        .filter((node) => node?.type === 'source')
        .map((node) => node?.label ?? node?.id)
        .filter((label): label is string => Boolean(label));
      return { nodeId: patch.nodeId, conflictingSourceIds: conflicts };
    })
    .filter((entry) => entry.conflictingSourceIds.length > 0);

  return {
    graphOverlay: overlayGraph,
    diff: {
      changedNodes,
      changedDecisions,
      evidenceTensions,
      topMovers
    } as SimulationDiff
  };
};
