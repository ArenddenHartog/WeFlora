import type { ContextItem, FloraGPTMode } from '../../../types';
import type { WorkOrder } from '../types';

export const buildWorkOrder = (args: {
  mode: FloraGPTMode;
  userQuery: string;
  contextItems: ContextItem[];
  uiAction?: string | null;
  schemaVersion?: WorkOrder['schemaVersion'];
  userLanguage?: WorkOrder['userLanguage'];
  selectedDocs?: { sourceId: string; sourceType: string; scope: string; title?: string }[];
}): WorkOrder => {
  const { mode, userQuery, contextItems, uiAction, selectedDocs, schemaVersion, userLanguage } = args;
  const projectId =
    contextItems.find((item) => item.projectId)?.projectId ||
    'global';

  return {
    mode,
    schemaVersion: schemaVersion ?? 'v0.1',
    projectId,
    privateEnvelopeId: null,
    userQuery,
    userLanguage: userLanguage ?? 'auto',
    responseMode: 'short',
    viewContext: 'chat',
    uiAction: uiAction ?? null,
    selectedDocs: selectedDocs?.map((doc) => ({
      sourceId: doc.sourceId,
      sourceType: doc.sourceType === 'policy_manual'
        ? 'policy_manual'
        : doc.sourceType === 'global_kb'
            ? 'global_kb'
            : doc.sourceType === 'upload'
                ? 'upload'
                : doc.sourceType === 'worksheet'
                    ? 'worksheet'
                    : doc.sourceType === 'report'
                        ? 'report'
                        : 'project',
      scope: doc.scope,
      title: doc.title
    })),
    evidencePolicy: {
      includeProjectEnvelope: true,
      includeGlobalKB: true,
      includePolicyDocs: 'only_if_selected'
    }
  };
};
