import type { ContextItem } from '../../../types';

export type SelectedDoc = {
  sourceId: string;
  sourceType: 'policy_manual' | 'upload' | 'worksheet' | 'report' | 'global_kb' | 'project';
  scope: string;
  title?: string;
};

const inferSourceType = (item: ContextItem): SelectedDoc['sourceType'] => {
  if (item.source === 'upload') return 'upload';
  if (item.source === 'worksheet') return 'worksheet';
  if (item.source === 'report') return 'report';
  if (item.source === 'knowledge') return 'global_kb';
  return 'project';
};

const maybePolicyManual = (item: ContextItem, fallback: SelectedDoc['sourceType']): SelectedDoc['sourceType'] => {
  if (item.description?.toLowerCase().includes('policy')) return 'policy_manual';
  if (item.name?.toLowerCase().includes('policy')) return 'policy_manual';
  return fallback;
};

export const mapSelectedDocs = (contextItems: ContextItem[], projectId: string): SelectedDoc[] => {
  return contextItems
    .filter((item) => item.source !== 'web')
    .map((item) => {
      const baseType = inferSourceType(item);
      const sourceType = maybePolicyManual(item, baseType);
      const scope = item.source === 'knowledge'
        ? 'global'
        : item.projectId
            ? `project:${item.projectId}`
            : `project:${projectId}`;
      return {
        sourceId: item.itemId || item.id,
        sourceType,
        scope,
        title: item.name
      };
    });
};
