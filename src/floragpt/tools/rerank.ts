import type { EvidenceHit } from '../types';

export const rerank = async (args: {
  hits: EvidenceHit[];
  topK: number;
}): Promise<EvidenceHit[]> => {
  return args.hits.slice(0, args.topK);
};
