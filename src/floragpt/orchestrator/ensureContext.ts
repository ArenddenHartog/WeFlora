import type { FloraGPTMode, FloraGPTResponseEnvelope } from '../../../types';
import type { WorkOrder } from '../types';

const SITE_TYPE_RE = /\b(street|park|plaza|roof|courtyard|roadside|avenue|boulevard|square|campus|rural|lane)\b/i;
const GOAL_RE = /\b(biodiversity|shade|canopy|drought|heat|cooling|low maintenance|pollinator|stormwater)\b/i;
const CONSTRAINT_RE = /\b(space|soil|moisture|compaction|rooting|root zone|overhead|utility|clearance|planter)\b/i;
const SOIL_RE = /\b(sand|clay|loam|silt|gravel|soil)\b/i;
const MOISTURE_RE = /\b(wet|moist|dry|drainage)\b/i;
const PLANT_TYPE_RE = /\b(tree|shrub|perennial|grass|groundcover|hedge)\b/i;
const ALTERNATIVE_RE = /\b(alternative|alternatives|instead of|substitute|replacement)\b/i;

export const ensureContext = (workOrder: WorkOrder): FloraGPTResponseEnvelope | null => {
  const { mode, userQuery, selectedDocs, recentUserMessages } = workOrder;
  const recentContext = recentUserMessages?.join(' ') ?? '';
  const contextText = [userQuery, recentContext].filter(Boolean).join(' ');

  if (mode === 'policy_compliance') {
    const hasPolicyDocs = Boolean(selectedDocs?.some((doc) => doc.sourceType === 'policy_manual'));
    if (!hasPolicyDocs) {
      return {
        schemaVersion: 'v0.1',
        meta: { schema_version: 'v0.1' },
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
    if (ALTERNATIVE_RE.test(contextText)) {
      return {
        schemaVersion: 'v0.2',
        meta: { schema_version: 'v0.2', sources_used: [] },
        mode,
        responseType: 'clarifying_questions',
        data: {
          questions: [
            'Which dimension defines “alternative” for you (e.g., crown size/form, drought tolerance, biodiversity value, maintenance profile, seasonal interest)?'
          ]
        }
      };
    }
    const hasContext = SITE_TYPE_RE.test(contextText);
    const hasGoal = GOAL_RE.test(contextText);
    const hasConstraint = CONSTRAINT_RE.test(contextText) || SOIL_RE.test(contextText) || MOISTURE_RE.test(contextText);
    if (!hasContext && !hasGoal && !hasConstraint) {
      return {
        schemaVersion: 'v0.2',
        meta: { schema_version: 'v0.2', sources_used: [] },
        mode,
        responseType: 'clarifying_questions',
        data: {
          questions: [
            'Is this planting intended for a street profile or a park/green area?',
            'Which goal should lead: biodiversity, shade, drought resilience, or low maintenance?',
            'Are there known constraints on rooting space or soil compaction?'
          ]
        }
      };
    }
    return null;
  }

  if (mode === 'suitability_scoring') {
    const hasSite = SITE_TYPE_RE.test(contextText);
    const hasSoil = SOIL_RE.test(contextText) || MOISTURE_RE.test(contextText);
    if (!hasSite || !hasSoil) {
      return {
        schemaVersion: 'v0.1',
        meta: { schema_version: 'v0.1' },
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
    const hasPlantType = PLANT_TYPE_RE.test(contextText);
    const hasSite = SITE_TYPE_RE.test(contextText);
    if (!hasPlantType || !hasSite) {
      return {
        schemaVersion: 'v0.1',
        meta: { schema_version: 'v0.1' },
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
