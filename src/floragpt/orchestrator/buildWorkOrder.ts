import type { ContextItem, FloraGPTMode } from '../../../types';
import type { WorkOrder } from '../types';

const POLICY_HINTS = /\b(policy|manual|compliance|richtlijn|regeling)\b/i;

const inferPolicyDoc = (item: ContextItem) => POLICY_HINTS.test(item.name);

export const buildWorkOrder = (args: {
  mode: FloraGPTMode;
  userQuery: string;
  contextItems: ContextItem[];
  uiAction?: string | null;
}): WorkOrder => {
  const { mode, userQuery, contextItems, uiAction } = args;
  const projectId =
    contextItems.find((item) => item.projectId)?.projectId ||
    'global';

  const selectedDocs = contextItems
    .filter((item) => item.source !== 'web')
    .map((item) => ({
      sourceId: item.itemId || item.id,
      type: inferPolicyDoc(item) ? 'policy_manual' : item.source === 'upload' ? 'upload' : 'project',
    }));

  return {
    mode,
    schemaVersion: 'v0.1',
    projectId,
    privateEnvelopeId: null,
    userQuery,
    userLanguage: 'auto',
    responseMode: 'short',
    viewContext: 'chat',
    uiAction: uiAction ?? null,
    selectedDocs,
  };
};
