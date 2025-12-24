import { MatrixRow } from '../types';

// -- Types --

export type SkillOutputType = 'text' | 'badge' | 'score' | 'currency' | 'quantity' | 'enum' | 'range';

export interface SkillParameter {
  id: string;
  type: 'string' | 'number' | 'boolean' | 'select';
  label: string;
  description?: string;
  defaultValue?: any;
  options?: string[]; // For 'select' type
  required?: boolean;
}

export interface SkillEvidencePolicy {
  evidenceRequired?: boolean;
  noGuessing?: boolean;
}

export interface SkillValidationResult {
  displayValue: string;
  reasoning: string;
  raw: string;
  status: 'success' | 'error';
  normalized?: any;
}

export type SkillPromptBuilder = (
  rowContext: Record<string, any>, // Key-value pairs of the row data (e.g. { "Species": "Oak" })
  params: Record<string, any>,     // User-configured parameters
  attachedFileNames: string[]      // Names of files attached to the column context
) => string;

export interface SkillTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  
  outputType: SkillOutputType;
  allowedEnums?: string[]; // For 'enum' outputType
  unitDefaults?: string;   // For 'quantity'/'currency'
  allowedUnits?: string[]; // For 'quantity'/'currency'
  
  evidencePolicy: SkillEvidencePolicy;
  
  parameters: SkillParameter[];
  
  promptBuilder: SkillPromptBuilder;
  validator: (output: string) => SkillValidationResult;
}

export type SkillTemplateId = 
  | 'compliance-check'
  | 'water-demand'
  | 'heat-resilience'
  | 'pest-susceptibility'
  | 'native-invasive-status'
  | 'maintenance-cost'
  | 'maintenance-schedule'
  | 'recommended-alternative';

// -- Helper for mocked validation (since we don't have a real LLM here) --
// In a real scenario, the LLM output would be parsed. 
// Here we define what we expect the LLM to output (usually a structured string or JSON).
// For this scaffold, we'll assume the LLM returns JSON or a specific format we can parse.
const jsonValidator = (output: string): SkillValidationResult => {
  try {
    // Attempt to parse standard JSON output format: { "value": "...", "reasoning": "..." }
    // Robustness: Handle code blocks if present
    const cleanOutput = output.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanOutput);
    return {
      displayValue: String(parsed.value || parsed.displayValue || ''),
      reasoning: parsed.reasoning || '',
      raw: output,
      status: 'success',
      normalized: parsed.value
    };
  } catch (e) {
    return {
      displayValue: 'Error',
      reasoning: 'Failed to parse model output',
      raw: output,
      status: 'error'
    };
  }
};

// -- Registry --

export const SKILL_TEMPLATES: Record<SkillTemplateId, SkillTemplate> = {
  'compliance-check': {
    id: 'compliance-check',
    name: 'Compliance Check',
    description: 'Verifies if the item meets specific regulatory or project standards.',
    category: 'Regulatory',
    outputType: 'badge',
    evidencePolicy: {
      evidenceRequired: true,
      noGuessing: true
    },
    parameters: [
      {
        id: 'standard',
        type: 'string',
        label: 'Standard / Policy',
        description: 'The name of the regulation or policy to check against.',
        defaultValue: 'City Zoning Code 2024',
        required: true
      }
    ],
    promptBuilder: (row, params, files) => `
      Check if "${row['Entity'] || 'this item'}" complies with ${params.standard}.
      Reference these documents if relevant: ${files.join(', ')}.
      Return JSON: { "value": "Compliant" | "Non-Compliant" | "Needs Review", "reasoning": "..." }
    `,
    validator: jsonValidator
  },

  'water-demand': {
    id: 'water-demand',
    name: 'Water Demand',
    description: 'Estimates the water usage requirements.',
    category: 'Environmental',
    outputType: 'quantity',
    unitDefaults: 'gal/year',
    allowedUnits: ['gal/year', 'L/year', 'gal/week'],
    evidencePolicy: { evidenceRequired: false },
    parameters: [],
    promptBuilder: (row, params, files) => `
      Estimate the annual water demand for "${row['Entity'] || 'this item'}".
      Return JSON: { "value": number, "unit": "gal/year", "reasoning": "..." }
    `,
    validator: (output) => {
        const res = jsonValidator(output);
        if (res.status === 'success') {
            // refined validation for quantity
            return {
                ...res,
                displayValue: `${res.normalized} gal/year` // Simplified for scaffold
            };
        }
        return res;
    }
  },

  'heat-resilience': {
    id: 'heat-resilience',
    name: 'Heat Resilience Score',
    description: 'Scores how well the species tolerates high temperatures.',
    category: 'Environmental',
    outputType: 'score',
    evidencePolicy: { evidenceRequired: false },
    parameters: [],
    promptBuilder: (row, params, files) => `
      Rate the heat resilience of "${row['Entity'] || 'this item'}" on a scale of 0-100.
      Return JSON: { "value": number, "reasoning": "..." }
    `,
    validator: jsonValidator
  },

  'pest-susceptibility': {
    id: 'pest-susceptibility',
    name: 'Pest Susceptibility',
    description: 'Assesses the risk of pest infestation.',
    category: 'Maintenance',
    outputType: 'enum',
    allowedEnums: ['High', 'Medium', 'Low'],
    evidencePolicy: { evidenceRequired: false },
    parameters: [],
    promptBuilder: (row, params, files) => `
      Determine the pest susceptibility (High, Medium, Low) for "${row['Entity'] || 'this item'}".
      Return JSON: { "value": "High" | "Medium" | "Low", "reasoning": "..." }
    `,
    validator: jsonValidator
  },

  'native-invasive-status': {
    id: 'native-invasive-status',
    name: 'Native / Invasive Status',
    description: 'Identifies if the species is native or invasive to the region.',
    category: 'Environmental',
    outputType: 'badge',
    evidencePolicy: { noGuessing: true },
    parameters: [
      {
        id: 'region',
        type: 'string',
        label: 'Region',
        defaultValue: 'North America',
        required: true
      }
    ],
    promptBuilder: (row, params, files) => `
      Is "${row['Entity'] || 'this item'}" Native or Invasive in ${params.region}?
      Return JSON: { "value": "Native" | "Invasive" | "Introduced", "reasoning": "..." }
    `,
    validator: jsonValidator
  },

  'maintenance-cost': {
    id: 'maintenance-cost',
    name: 'Annual Maintenance Cost',
    description: 'Estimates the yearly cost of maintenance.',
    category: 'Financial',
    outputType: 'currency',
    unitDefaults: 'USD',
    evidencePolicy: { evidenceRequired: false },
    parameters: [],
    promptBuilder: (row, params, files) => `
      Estimate the annual maintenance cost for "${row['Entity'] || 'this item'}".
      Return JSON: { "value": number, "currency": "USD", "reasoning": "..." }
    `,
    validator: (output) => {
         const res = jsonValidator(output);
         if (res.status === 'success') {
             return { ...res, displayValue: `$${res.normalized}` };
         }
         return res;
    }
  },

  'maintenance-schedule': {
    id: 'maintenance-schedule',
    name: 'Maintenance Frequency',
    description: 'Recommended frequency of maintenance visits.',
    category: 'Maintenance',
    outputType: 'enum',
    allowedEnums: ['Weekly', 'Monthly', 'Quarterly', 'Annually'],
    evidencePolicy: { evidenceRequired: false },
    parameters: [],
    promptBuilder: (row, params, files) => `
      Recommend a maintenance schedule for "${row['Entity'] || 'this item'}".
      Return JSON: { "value": "Weekly" | "Monthly" | "Quarterly" | "Annually", "reasoning": "..." }
    `,
    validator: jsonValidator
  },

  'recommended-alternative': {
    id: 'recommended-alternative',
    name: 'Recommended Alternative',
    description: 'Suggests a better alternative if the current item is suboptimal.',
    category: 'Advisory',
    outputType: 'text',
    evidencePolicy: { evidenceRequired: false },
    parameters: [
      {
        id: 'criteria',
        type: 'string',
        label: 'Optimization Criteria',
        defaultValue: 'Drought Tolerance',
        required: true
      }
    ],
    promptBuilder: (row, params, files) => `
      Suggest an alternative to "${row['Entity'] || 'this item'}" that is better for ${params.criteria}.
      Return JSON: { "value": "Species Name", "reasoning": "..." }
    `,
    validator: jsonValidator
  }
};

// -- Smoke Test --

export function runSmokeTest() {
  console.info('Starting Skill Templates Smoke Test...');
  
  const mockRow = { 'Entity': 'Quercus virginiana' };
  const mockFiles = ['specs.pdf'];

  Object.values(SKILL_TEMPLATES).forEach(template => {
    console.group(`Testing Template: ${template.name} (${template.id})`);
    
    // 1. Validate Parameters
    console.info('Parameters:', template.parameters.map(p => p.id).join(', '));
    
    // 2. Build Prompt
    const defaultParams: Record<string, any> = {};
    template.parameters.forEach(p => {
        defaultParams[p.id] = p.defaultValue;
    });
    
    const prompt = template.promptBuilder(mockRow, defaultParams, mockFiles);
    console.info('Generated Prompt Preview:', prompt.trim().substring(0, 100) + '...');
    
    // 3. Test Validator with Mock Output
    const mockOutput = JSON.stringify({ 
        value: template.allowedEnums ? template.allowedEnums[0] : (template.outputType === 'score' ? 85 : (template.outputType === 'currency' ? 100 : 'Sample Value')),
        reasoning: 'This is a test reasoning.'
    });
    
    const validationResult = template.validator(mockOutput);
    console.info('Validation Result:', validationResult.status, validationResult.displayValue);
    
    if (validationResult.status === 'error') {
        console.error('Validation Failed!', validationResult);
    }

    console.groupEnd();
  });
  
  console.info('Smoke Test Complete.');
}
