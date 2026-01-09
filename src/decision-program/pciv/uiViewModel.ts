import type { Claim, EvidenceItem, Source } from './types.ts';

export const groupClaimsByDomain = (claims: Claim[]) =>
  claims.reduce<Record<string, Claim[]>>((acc, claim) => {
    acc[claim.domain] = acc[claim.domain] ?? [];
    acc[claim.domain].push(claim);
    return acc;
  }, {});

export const formatEvidenceLines = (
  evidenceRefs: Claim['evidenceRefs'],
  evidenceItems: EvidenceItem[],
  sources: Source[]
) => {
  const evidenceById = new Map(evidenceItems.map((item) => [item.evidenceId, item]));
  const sourceById = new Map(sources.map((source) => [source.sourceId, source]));
  return evidenceRefs.map((ref) => {
    const evidence = evidenceById.get(ref.evidenceId);
    const source = evidence ? sourceById.get(evidence.sourceId) : undefined;
    const page = evidence?.locator.page ? `p. ${evidence.locator.page}` : undefined;
    return [source?.title ?? 'Source', page, ref.quote].filter(Boolean).join(' · ');
  });
};
