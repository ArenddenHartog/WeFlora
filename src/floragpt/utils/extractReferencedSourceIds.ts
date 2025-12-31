import type { FloraGPTResponseEnvelope } from '../../../types';

const collectIds = (items: Array<{ source_id?: string } | string> | undefined): string[] => {
  if (!items) return [];
  return items
    .map((item) => (typeof item === 'string' ? item : item.source_id))
    .filter((id): id is string => Boolean(id));
};

export const extractReferencedSourceIds = (payload: FloraGPTResponseEnvelope): string[] => {
  if (payload.responseType === 'clarifying_questions') return [];
  const ids = new Set<string>();

  if (payload.meta && Array.isArray((payload.meta as any).sources_used)) {
    collectIds((payload.meta as any).sources_used).forEach((id) => ids.add(id));
  }

  if (payload.mode === 'general_research') {
    collectIds((payload.data as any)?.citations).forEach((id) => ids.add(id));
  }

  if (payload.mode === 'suitability_scoring') {
    const results = (payload.data as any)?.results || [];
    results.forEach((result: any) => {
      collectIds(result.citations).forEach((id) => ids.add(id));
    });
  }

  if (payload.mode === 'spec_writer') {
    collectIds((payload.data as any)?.citations).forEach((id) => ids.add(id));
  }

  if (payload.mode === 'policy_compliance') {
    const issues = (payload.data as any)?.issues || [];
    issues.forEach((issue: any) => {
      collectIds(issue.citations).forEach((id) => ids.add(id));
    });
  }

  return Array.from(ids);
};
