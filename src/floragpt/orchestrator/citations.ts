import type { FloraGPTResponseEnvelope } from '../../../types';
import type { EvidencePack, WorkOrder } from '../types';

const isStringArray = (items: unknown): items is string[] =>
  Array.isArray(items) && items.every((item) => typeof item === 'string');

export const buildCitationErrors = (
  payload: FloraGPTResponseEnvelope,
  evidencePack: EvidencePack,
  workOrder: WorkOrder
): string[] => {
  const errors: string[] = [];
  const totalEvidence = evidencePack.globalHits.length + evidencePack.projectHits.length + evidencePack.policyHits.length;
  if (totalEvidence === 0) return errors;

  const sourceIds = new Set(
    [...evidencePack.globalHits, ...evidencePack.projectHits, ...evidencePack.policyHits].map((hit) => hit.sourceId)
  );

  if (payload.mode === 'general_research') {
    const selectedDocs = workOrder.selectedDocs || [];
    const hasEvidence = selectedDocs.length > 0 || totalEvidence > 0;
    if (payload.responseType === 'answer' && hasEvidence) {
      const sourcesUsed = payload.meta?.sources_used || [];
      if (!Array.isArray(sourcesUsed) || sourcesUsed.length === 0) {
        errors.push('meta.sources_used must include at least one source_id when evidence exists');
        return errors;
      }
      sourcesUsed.forEach((entry: any) => {
        if (!entry?.source_id || typeof entry.source_id !== 'string') {
          errors.push('meta.sources_used entries must include source_id');
          return;
        }
        if (!sourceIds.has(entry.source_id)) errors.push(`unknown source_id: ${entry.source_id}`);
      });
    }
    return errors;
  }

  if (payload.mode === 'suitability_scoring') {
    const results = payload.data?.results || [];
    results.forEach((result: any, idx: number) => {
      if (!isStringArray(result.citations) || result.citations.length === 0) {
        errors.push(`results[${idx}] requires citations`);
        return;
      }
      result.citations.forEach((id: string) => {
        if (!sourceIds.has(id)) errors.push(`unknown source_id: ${id}`);
      });
    });
  }

  if (payload.mode === 'spec_writer') {
    if (!isStringArray(payload.data?.citations) || payload.data.citations.length === 0) {
      errors.push('spec_writer requires citations when evidence exists');
      return errors;
    }
    payload.data.citations.forEach((id: string) => {
      if (!sourceIds.has(id)) errors.push(`unknown source_id: ${id}`);
    });
  }

  if (payload.mode === 'policy_compliance') {
    if (payload.data?.citations && !isStringArray(payload.data.citations)) {
      errors.push('policy_compliance data.citations must be string[]');
    }
    if (isStringArray(payload.data?.citations)) {
      payload.data.citations.forEach((id: string) => {
        if (!sourceIds.has(id)) errors.push(`unknown source_id: ${id}`);
      });
    }
    if (evidencePack.policyHits.length > 0) {
      const issues = payload.data?.issues || [];
      issues.forEach((issue: any, idx: number) => {
        if (!isStringArray(issue.citations) || issue.citations.length === 0) {
          errors.push(`issues[${idx}] requires citations`);
          return;
        }
        issue.citations.forEach((id: string) => {
          if (!sourceIds.has(id)) errors.push(`unknown source_id: ${id}`);
        });
      });
    }
  }

  return errors;
};

export const buildCitationFailurePayload = (workOrder: WorkOrder): FloraGPTResponseEnvelope => ({
  schemaVersion: workOrder.schemaVersion,
  meta: { schema_version: workOrder.schemaVersion, sources_used: [] },
  mode: workOrder.mode,
  responseType: 'error',
  data: {
    message: 'Citations are required when evidence is available. Please retry with valid sources.'
  }
});
