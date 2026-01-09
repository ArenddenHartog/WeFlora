import type { EvidenceEdge } from '../types.ts';

const DEFAULT_ATTENUATION_BY_TYPE: Partial<Record<EvidenceEdge['type'], number>> = {
  influences: 0.9,
  filters: 0.88,
  scores: 0.92
};

export const getDefaultAttenuation = (edgeType: EvidenceEdge['type']) =>
  DEFAULT_ATTENUATION_BY_TYPE[edgeType] ?? 0.92;

export const computeEffectiveImpact = (edge: EvidenceEdge, constraintConfidence: number) => {
  const edgeImpact = edge.weight ?? 0.5;
  const edgeCred = (edge.confidence ?? 0.85) * (edge.attenuation ?? getDefaultAttenuation(edge.type));
  const baseImpact = edgeImpact * constraintConfidence * edgeCred;
  if (edge.polarity === 'negative') {
    return -Math.abs(baseImpact);
  }
  return baseImpact;
};
