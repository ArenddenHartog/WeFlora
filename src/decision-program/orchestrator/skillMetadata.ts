import type { DraftMatrixColumn } from '../types.ts';
import { getSkillTemplate } from '../../../services/skillTemplates';

export const buildSkillMetadata = (skillId?: string): DraftMatrixColumn['skillMetadata'] => {
  if (!skillId) return undefined;
  const template = getSkillTemplate(skillId);
  return {
    kind: 'skill',
    skillId,
    inputContract: template ? { params: template.params ?? [] } : undefined
  };
};
