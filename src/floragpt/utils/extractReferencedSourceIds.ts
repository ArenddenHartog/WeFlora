import type { FloraGPTResponseEnvelope } from '../types';

// NOTE: This extractor strictly follows v0.1 schema citation locations.
const collectIds = (items: unknown, context: string): string[] => {
  if (!Array.isArray(items)) {
    if (items !== undefined) {
      console.info('[floragpt:citation]', `Unexpected citations format for ${context}; schema v0.1 expects string[]`);
    }
    return [];
  }
  const invalid = items.some((item) => typeof item !== 'string');
  if (invalid) {
    console.info('[floragpt:citation]', `Unexpected citations entries for ${context}; schema v0.1 expects string[]`);
    return [];
  }
  return items as string[];
};

export const extractReferencedSourceIds = (payload: FloraGPTResponseEnvelope): string[] => {
  if (payload.responseType !== 'answer') return [];
  const ids = new Set<string>();

  if (payload.mode === 'general_research') {
    // v0.1 has no citations for general_research.
    return [];
  }

  if (payload.mode === 'suitability_scoring') {
    const results = (payload.data as any)?.results || [];
    results.forEach((result: any) => {
      collectIds(result.citations, 'suitability_scoring.results[].citations').forEach((id) => ids.add(id));
    });
  }

  if (payload.mode === 'spec_writer') {
    collectIds((payload.data as any)?.citations, 'spec_writer.data.citations').forEach((id) => ids.add(id));
  }

  if (payload.mode === 'policy_compliance') {
    const issues = (payload.data as any)?.issues || [];
    collectIds((payload.data as any)?.citations, 'policy_compliance.data.citations').forEach((id) => ids.add(id));
    issues.forEach((issue: any) => {
      collectIds(issue.citations, 'policy_compliance.data.issues[].citations').forEach((id) => ids.add(id));
    });
  }

  return Array.from(ids);
};
