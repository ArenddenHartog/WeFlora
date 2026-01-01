import type { FloraGPTMode, FloraGPTResponseEnvelope } from '../../../types';
import type { WorkOrder } from '../types';

const SITE_TYPE_RE = /\b(street|park|plaza|roof|courtyard|roadside|avenue|boulevard|square|campus)\b/i;
const SOIL_RE = /\b(sand|clay|loam|silt|gravel|soil)\b/i;
const MOISTURE_RE = /\b(wet|moist|dry|drainage)\b/i;
const PLANT_TYPE_RE = /\b(tree|shrub|perennial|grass|groundcover|hedge)\b/i;

export const ensureContext = (workOrder: WorkOrder): FloraGPTResponseEnvelope | null => {
  const { mode, userQuery, selectedDocs } = workOrder;

  if (mode === 'policy_compliance') {
    const hasPolicyDocs = Boolean(selectedDocs?.some((doc) => doc.type === 'policy_manual'));
    if (!hasPolicyDocs) {
      return {
        schemaVersion: 'v0.1',
        mode,
        responseType: 'answer',
        data: {
          status: 'Unknown',
          message: 'No policy documents selected. Please attach a policy manual to evaluate compliance.'
        }
      };
    }
  }

  if (mode === 'general_research') {
    if (userQuery.trim().length < 5) {
      return {
        schemaVersion: 'v0.1',
        mode,
        responseType: 'clarifying_questions',
        data: {
          questions: [
            'Which plant species or category should I focus on?',
            'What site context should I assume (e.g., street, park, courtyard)?'
          ]
        }
      };
    }
    return null;
  }

  if (mode === 'suitability_scoring') {
    const hasSite = SITE_TYPE_RE.test(userQuery);
    const hasSoil = SOIL_RE.test(userQuery) || MOISTURE_RE.test(userQuery);
    if (!hasSite || !hasSoil) {
      return {
        schemaVersion: 'v0.1',
        mode,
        responseType: 'clarifying_questions',
        data: {
          questions: [
            'What is the site type (e.g., street, park, courtyard)?',
            'What are the soil or moisture conditions?'
          ]
        }
      };
    }
  }

  if (mode === 'spec_writer') {
    const hasPlantType = PLANT_TYPE_RE.test(userQuery);
    const hasSite = SITE_TYPE_RE.test(userQuery);
    if (!hasPlantType || !hasSite) {
      return {
        schemaVersion: 'v0.1',
        mode,
        responseType: 'clarifying_questions',
        data: {
          questions: [
            'What plant type or species should the specification cover?',
            'What site context should the specification assume?'
          ]
        }
      };
    }
  }

  return null;
};
