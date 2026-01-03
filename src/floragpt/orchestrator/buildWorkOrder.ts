import type { ContextItem, FloraGPTMode } from '../../../types';
import type { WorkOrder } from '../types';
import { detectUserLanguage } from '../utils/detectUserLanguage';

export const buildWorkOrder = (args: {
  mode: FloraGPTMode;
  userQuery: string;
  contextItems: ContextItem[];
  uiAction?: string | null;
  selectedDocs?: { sourceId: string; sourceType: string; scope: string; title?: string }[];
  recentUserMessages?: string[];
}): WorkOrder => {
  const { mode, userQuery, contextItems, uiAction, selectedDocs, recentUserMessages } = args;
  const projectId =
    contextItems.find((item) => item.projectId)?.projectId ||
    'global';

  return {
    mode,
    schemaVersion: mode === 'general_research' ? 'v0.2' : 'v0.1',
    projectId,
    privateEnvelopeId: null,
    userQuery,
    recentUserMessages,
    userLanguage: detectUserLanguage(userQuery),
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
