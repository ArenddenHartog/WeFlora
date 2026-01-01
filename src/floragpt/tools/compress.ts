import type { EvidenceHit } from '../types';

const trimSnippet = (snippet: string, maxChars: number) =>
  snippet.length > maxChars ? `${snippet.slice(0, maxChars - 1)}…` : snippet;

export const compress = async (args: {
  hits: EvidenceHit[];
  maxChars: number;
}): Promise<EvidenceHit[]> => {
  return args.hits.map((hit) => ({
    ...hit,
    snippet: trimSnippet(hit.snippet, args.maxChars)
  }));
};
