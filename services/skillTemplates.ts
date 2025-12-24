import { validators, CanonicalResponse } from './skills/validators';

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

export type SkillValidationResult = CanonicalResponse;

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
      Format: "Compliant" | "Non-Compliant" | "Needs Review" — reason
    `,
    validator: (output) => validators.badge(output, ['Compliant', 'Non-Compliant', 'Needs Review'])
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
      Format: N gal/year — reason
    `,
    validator: (output) => validators.quantity(output, ['gal/year', 'L/year', 'gal/week'])
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
      Format: NN/100 — reason
    `,
    validator: (output) => validators.score(output)
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
      Format: High|Medium|Low — reason
    `,
    validator: (output) => validators.enum(output, ['High', 'Medium', 'Low'])
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
      Format: Native|Invasive|Introduced — reason
    `,
    validator: (output) => validators.badge(output, ['Native', 'Invasive', 'Introduced'])
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
      Format: €NNN — reason (Convert to EUR if needed)
    `,
    // Previous scaffold used USD, but new requirement says "support € only for now". 
    // I will switch this template to EUR as per the "currency" validator requirement.
    validator: (output) => validators.currency(output)
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
      Format: Weekly|Monthly|Quarterly|Annually — reason
    `,
    validator: (output) => validators.enum(output, ['Weekly', 'Monthly', 'Quarterly', 'Annually'])
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
      Format: Species Name — reason
    `,
    validator: (output) => validators.text(output)
  }
};

// -- Smoke Test --

export function runSmokeTest() {
  console.info('Starting Skill Templates Smoke Test (Strict Validators)...');
  
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
    
    // 3. Test Validator with Correctly Formatted Mock Output
    let mockOutput = "";
    if (template.outputType === 'badge') {
        mockOutput = "Compliant — This meets the zoning code.";
        if (template.id === 'native-invasive-status') mockOutput = "Native — It is native to NA.";
    } else if (template.outputType === 'quantity') {
        mockOutput = "1500 gal/year — Based on typical usage.";
    } else if (template.outputType === 'score') {
        mockOutput = "85/100 — High heat tolerance.";
    } else if (template.outputType === 'enum') {
        mockOutput = (template.allowedEnums?.[0] || 'Val') + " — Because of reasons.";
    } else if (template.outputType === 'currency') {
        mockOutput = "€120 — Annual trimming cost.";
    } else if (template.outputType === 'text') {
        mockOutput = "Quercus fusiformis — Better drought tolerance.";
    }

    const validationResult = template.validator(mockOutput);
    console.info('Validation Result:', validationResult.ok ? 'OK' : 'FAIL', validationResult.displayValue || validationResult.error);
    
    if (!validationResult.ok) {
        console.error('Validation Error Details:', validationResult);
    } else {
        console.info('Normalized:', JSON.stringify(validationResult.normalized));
    }

    console.groupEnd();
  });
  
  console.info('Smoke Test Complete.');
}
