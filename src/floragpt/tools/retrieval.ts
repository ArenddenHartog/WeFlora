import type { ContextItem } from '../../../types';
import type { EvidenceHit } from '../types';

const MAX_HITS = 8;
const MAX_CHARS = 600;

const chunkText = (text: string, maxChars: number): string[] => {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxChars) return [clean];
  const chunks: string[] = [];
  for (let i = 0; i < clean.length; i += maxChars) {
    chunks.push(clean.slice(i, i + maxChars));
  }
  return chunks;
};

const hitFromContext = (item: ContextItem, snippet: string, idx: number): EvidenceHit => ({
  sourceId: item.itemId || item.id,
  sourceType: item.source === 'upload' ? 'upload' : item.source === 'worksheet' ? 'worksheet' : item.source === 'report' ? 'report' : 'project',
  title: item.name,
  locationHint: `${item.source}#${idx + 1}`,
  snippet,
  scope: item.projectId ? `project:${item.projectId}` : 'global'
});

export const retrieveProject = async (args: {
  projectId: string;
  query: string;
  contextItems: ContextItem[];
}): Promise<EvidenceHit[]> => {
  const scopedItems = args.contextItems.filter((item) => item.projectId === args.projectId);
  const hits: EvidenceHit[] = [];
  scopedItems.forEach((item) => {
    const snippets = item.content ? chunkText(item.content, MAX_CHARS) : [`Source provided: ${item.name}`];
    snippets.forEach((snippet, idx) => hits.push(hitFromContext(item, snippet, idx)));
  });
  return hits.slice(0, MAX_HITS);
};

export const retrievePolicy = async (args: {
  projectId: string;
  query: string;
  contextItems: ContextItem[];
}): Promise<EvidenceHit[]> => {
  const policyItems = args.contextItems.filter((item) => item.projectId === args.projectId && /policy|manual|compliance/i.test(item.name));
  const hits: EvidenceHit[] = [];
  policyItems.forEach((item) => {
    const snippets = item.content ? chunkText(item.content, MAX_CHARS) : [`Source provided: ${item.name}`];
    snippets.forEach((snippet, idx) => hits.push(hitFromContext(item, snippet, idx)));
  });
  return hits.slice(0, MAX_HITS);
};

export const retrieveGlobal = async (_args: { query: string }): Promise<EvidenceHit[]> => {
  return [];
};
