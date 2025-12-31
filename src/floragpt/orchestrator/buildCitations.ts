import type { Citation } from '../../../types';
import type { EvidencePack, EvidenceHit } from '../types';

const buildCitationText = (hit: EvidenceHit) =>
  hit.locationHint ? `${hit.title} (${hit.locationHint})` : hit.title;

const hitTypeToCitationType = (hit: EvidenceHit): Citation['type'] => {
  if (hit.sourceType === 'global_kb') return 'research';
  return 'project_file';
};

export const buildCitationsFromEvidencePack = (pack: EvidencePack, referencedSourceIds: string[]): Citation[] => {
  const hits = [...pack.globalHits, ...pack.projectHits, ...pack.policyHits];
  const hitById = new Map(hits.map((hit) => [hit.sourceId, hit]));
  return referencedSourceIds
    .map((id) => hitById.get(id))
    .filter((hit): hit is EvidenceHit => Boolean(hit))
    .map((hit) => ({
    source: hit.title,
    text: buildCitationText(hit),
    type: hitTypeToCitationType(hit),
    sourceId: hit.sourceId,
    locationHint: hit.locationHint ?? null
    }));
};
