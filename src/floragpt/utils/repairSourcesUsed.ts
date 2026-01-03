import type { FloraGPTResponseEnvelope } from '../../../types';
import type { EvidencePack, WorkOrder } from '../types';

export const repairSourcesUsed = (
  payload: FloraGPTResponseEnvelope,
  workOrder: WorkOrder,
  evidencePack: EvidencePack
): FloraGPTResponseEnvelope => {
  if (payload.mode !== 'general_research' || payload.responseType !== 'answer') return payload;
  const totalEvidence = evidencePack.globalHits.length + evidencePack.projectHits.length + evidencePack.policyHits.length;
  const hasEvidence = (workOrder.selectedDocs?.length || 0) > 0 || totalEvidence > 0;
  const sourcesUsed = payload.meta?.sources_used || [];
  if (!hasEvidence || sourcesUsed.length > 0) return payload;

  const selectedIds = (workOrder.selectedDocs || []).map((doc) => doc.sourceId);
  const sourceIds = [
    ...selectedIds,
    ...evidencePack.projectHits.map((hit) => hit.sourceId),
    ...evidencePack.policyHits.map((hit) => hit.sourceId),
    ...evidencePack.globalHits.map((hit) => hit.sourceId)
  ];
  const uniqueIds = [...new Set(sourceIds)];
  const cappedIds = uniqueIds.length > 6 ? uniqueIds.slice(0, 6) : uniqueIds;
  if (uniqueIds.length === 0) return payload;

  return {
    ...payload,
    meta: {
      schema_version: payload.meta?.schema_version ?? workOrder.schemaVersion,
      sources_used: cappedIds.map((sourceId) => ({ source_id: sourceId }))
    }
  };
};
