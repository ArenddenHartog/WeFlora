import type { FloraGPTMode } from '../../../types';

const SPEC_KEYWORDS = /\b(spec|specification|bestek|raw|uitvoeringsspecificatie)\b/i;
const SCORE_KEYWORDS = /\b(score|shortlist|recommend|suitable|alternatives|compare|versus)\b/i;
const COMPLIANCE_KEYWORDS = /\b(allowed|compliant|compliance|policy|afstand|richtlijn|permit)\b/i;

export const resolveMode = (args: {
  uiAction?: string | null;
  userQuery: string;
  selectedDocs?: { type: string }[];
}): FloraGPTMode => {
  const { uiAction, userQuery, selectedDocs } = args;

  if (uiAction) {
    switch (uiAction) {
      case 'spec_writer':
      case 'suitability_scoring':
      case 'policy_compliance':
      case 'general_research':
        return uiAction;
      default:
        break;
    }
  }

  const hasPolicyDocs = Boolean(selectedDocs?.some((doc) => doc.type === 'policy_manual'));
  if (hasPolicyDocs && COMPLIANCE_KEYWORDS.test(userQuery)) {
    return 'policy_compliance';
  }

  if (SPEC_KEYWORDS.test(userQuery)) return 'spec_writer';
  if (SCORE_KEYWORDS.test(userQuery)) return 'suitability_scoring';
  return 'general_research';
};
