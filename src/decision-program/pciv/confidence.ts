import type { Claim, Constraint, GraphEdge, GraphNode } from './types';

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const strengthScore: Record<'direct' | 'supporting' | 'weak', number> = {
  direct: 1,
  supporting: 0.6,
  weak: 0.3
};

export const computeClaimConfidence = (claim: Claim): number => {
  const evidenceScores = claim.evidenceRefs.map((ref) => strengthScore[ref.strength]);
  const evidenceStrengthAggregate = evidenceScores.length
    ? evidenceScores.reduce((sum, score) => sum + score, 0) / evidenceScores.length
    : 0.3;
  if (claim.status === 'corrected') {
    return Math.max(0.75, Math.min(0.95, claim.confidence));
  }
  const base =
    claim.claimType === 'inference'
      ? Math.min(0.8, evidenceStrengthAggregate * 0.85)
      : Math.min(0.95, evidenceStrengthAggregate);
  return clamp01(base);
};

export const computeConstraintConfidence = (constraint: Constraint, claims: Claim[]): number => {
  const contributions = constraint.derivedFrom
    .map((entry) => {
      const claim = claims.find((candidate) => candidate.claimId === entry.claimId);
      return claim ? { weight: entry.weight, confidence: claim.confidence } : null;
    })
    .filter(Boolean) as Array<{ weight: number; confidence: number }>;
  if (!contributions.length) return 0;
  const totalWeight = contributions.reduce((sum, entry) => sum + entry.weight, 0);
  if (totalWeight === 0) return 0;
  const total = contributions.reduce((sum, entry) => sum + entry.weight * entry.confidence, 0);
  return clamp01(total / totalWeight);
};

export const computeDecisionConfidence = (
  decisionNode: GraphNode,
  incomingConstraintEdges: Array<{ edge: GraphEdge; constraintConfidence: number }>
): number => {
  const sum = incomingConstraintEdges.reduce((acc, entry) => {
    const sign = entry.edge.polarity === 'negative' ? -1 : 1;
    return acc + sign * entry.edge.weight * entry.constraintConfidence;
  }, 0);
  return clamp01(0.5 + sum * 0.5);
};
