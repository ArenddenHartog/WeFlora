import type { FloraGPTMode, FloraGPTResponseEnvelope } from '../../../types';
import type { WorkOrder } from '../types';

const SITE_TYPE_RE = /\b(street|park|plaza|roof|courtyard|roadside|avenue|boulevard|square|campus)\b/i;
const SOIL_RE = /\b(sand|clay|loam|silt|gravel|soil)\b/i;
const MOISTURE_RE = /\b(wet|moist|dry|drainage)\b/i;
const PLANT_TYPE_RE = /\b(tree|shrub|perennial|grass|groundcover|hedge)\b/i;

export const ensureContext = (workOrder: WorkOrder): FloraGPTResponseEnvelope | null => {
  const { mode, userQuery, selectedDocs, userLanguage, schemaVersion } = workOrder;
  const meta = { schema_version: schemaVersion };
  const language = userLanguage === 'nl' ? 'nl' : 'en';

  if (mode === 'policy_compliance') {
    const hasPolicyDocs = Boolean(selectedDocs?.some((doc) => doc.type === 'policy_manual'));
    if (!hasPolicyDocs) {
      return {
        schemaVersion,
        meta,
        mode,
        responseType: 'answer',
        data: {
          status: 'Unknown',
          message: language === 'nl'
            ? 'Geen beleidsdocumenten geselecteerd. Voeg een beleidsdocument toe om naleving te beoordelen.'
            : 'No policy documents selected. Please attach a policy manual to evaluate compliance.'
        }
      };
    }
  }

  if (mode === 'general_research') {
    const needsSite = !SITE_TYPE_RE.test(userQuery);
    const needsGoal = !/\b(biodiversity|biodiversiteit|drought|droogte|shade|schaduw|storm|street|straat|cooling|koeling|habitat|pollinator|water)\b/i.test(userQuery);
    const needsConstraints = !/\b(soil|ground|bodem|sun|zon|shade|schaduw|space|ruimte|moisture|vocht|drainage|root)\b/i.test(userQuery);
    const questions: string[] = [];

    if (needsSite) {
      questions.push(language === 'nl'
        ? 'Welke locatiecontext geldt (bijv. straat, park, plein, binnenhof)?'
        : 'Which site context applies (e.g., street, park, square, courtyard)?');
    }
    if (needsGoal) {
      questions.push(language === 'nl'
        ? 'Wat is het doel (bijv. biodiversiteit, droogtetolerantie, schaduw, stadskoeling)?'
        : 'What is the primary goal (e.g., biodiversity, drought tolerance, shade, cooling)?');
    }
    if (needsConstraints) {
      questions.push(language === 'nl'
        ? 'Zijn er beperkingen zoals bodemtype, licht, ruimte of vocht?'
        : 'Any constraints like soil type, light, space, or moisture?');
    }

    if (questions.length > 0) {
      return {
        schemaVersion,
        meta,
        mode,
        responseType: 'clarifying_questions',
        data: {
          questions: questions.slice(0, 3)
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
        schemaVersion,
        meta,
        mode,
        responseType: 'clarifying_questions',
        data: {
          questions: language === 'nl'
            ? [
                'Wat is het type locatie (bijv. straat, park, binnenhof)?',
                'Wat zijn de bodem- of vochtcondities?'
              ]
            : [
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
        schemaVersion,
        meta,
        mode,
        responseType: 'clarifying_questions',
        data: {
          questions: language === 'nl'
            ? [
                'Welke plantsoort of soort moet de specificatie omvatten?',
                'Welke locatiecontext geldt voor de specificatie?'
              ]
            : [
                'What plant type or species should the specification cover?',
                'What site context should the specification assume?'
              ]
        }
      };
    }
  }

  return null;
};
