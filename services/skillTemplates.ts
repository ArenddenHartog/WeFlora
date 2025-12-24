// services/skillTemplates.ts
import type { SkillOutputType } from "../types";
import {
  validateBadge,
  validateScore,
  validateCurrency,
  validateQuantity,
  validateEnum,
  validateRange,
  validateText
} from "./skills/validators";

export type SkillTemplateId =
  | "compliance_policy"
  | "water_demand"
  | "heat_resilience"
  | "pest_susceptibility"
  | "native_invasive"
  | "maintenance_cost"
  | "maintenance_schedule"
  | "recommended_alternative"
  | "co2_calculator"
  | "pruning_urgency"
  | "zoning_check"
  | "planting_spec_snippet";

export type SkillParamType = "string" | "number" | "boolean" | "select" | "multiselect";

export interface SkillParamDef {
  key: string;
  type: SkillParamType;
  label: string;
  description?: string;
  required?: boolean;
  defaultValue?: any;
  options?: { label: string; value: string }[]; // select/multiselect
  min?: number;
  max?: number;
}

export type SkillValidationResult = {
  ok: boolean;
  displayValue?: string;
  reasoning?: string;
  normalized?: any;
  error?: string;
};

export type SkillRowContext = {
  speciesScientific?: string;  // "Quercus robur"
  cultivar?: string;          // "'Elsrijk'"
  commonName?: string;        // "oak"
  rowLabel?: string;          // fallback row.entityName
  // optional: columnId->value map for other references
  cellsByColumnId?: Record<string, string>;
};

export interface SkillTemplate {
  id: SkillTemplateId;
  name: string;
  description: string;
  category: "Compliance" | "Resilience" | "Maintenance" | "Carbon" | "Siting" | "Recommendations";
  outputType: SkillOutputType;

  // Policy/evidence controls:
  evidenceRequired?: boolean; // if true and missing evidence => Insufficient Data
  noGuessing?: boolean;       // if true, prohibit inference

  // For enums:
  allowedEnums?: string[];

  // For quantity/currency:
  allowedUnits?: string[];
  defaultUnit?: string;
  allowedPeriods?: ("day" | "week" | "month" | "year")[];

  params: SkillParamDef[];

  buildPrompt: (args: {
    row: SkillRowContext;
    params: Record<string, any>;
    attachedFileNames: string[];
    projectContext?: string;
  }) => string;

  validate: (raw: string, params: Record<string, any>) => SkillValidationResult;
}

export const SKILL_TEMPLATES: Record<SkillTemplateId, SkillTemplate> = {
  compliance_policy: {
    id: "compliance_policy",
    name: "Compliance (Policy-grounded)",
    description: "Check compliance strictly against attached policy documents. No guessing.",
    category: "Compliance",
    outputType: "badge",
    evidenceRequired: true,
    noGuessing: true,
    params: [
      { key: "policyScope", type: "string", label: "Policy scope", defaultValue: "Municipal planting policy" },
      { key: "strictMode", type: "boolean", label: "Strict evidence only", defaultValue: true }
    ],
    buildPrompt: ({ row, params, attachedFileNames, projectContext }) => {
      const species = row.speciesScientific
        ? `${row.speciesScientific}${row.cultivar ? ` ${row.cultivar}` : ""}`
        : (row.rowLabel ?? "");

      return [
        projectContext ? `Project context:\n${projectContext}\n---\n` : "",
        `You are a municipal planting compliance analyst.`,
        `Species to evaluate: ${species}`,
        `Policy scope: ${params.policyScope}`,
        `Attached evidence documents: ${attachedFileNames.join(", ") || "(none)"}`,
        `Rules:`,
        `- If the answer is not explicitly supported by attached documents, return: "Insufficient Data — <what is missing & next step>".`,
        `- Do not guess.`,
        `Output format (exact): "Compliant|Rejected|Insufficient Data — reason".`,
      ].filter(Boolean).join("\n");
    },
    validate: (raw) => validateBadge(raw, ["Compliant", "Rejected", "Insufficient Data"])
  },

  water_demand: {
    id: "water_demand",
    name: "Water Demand",
    description: "Estimate water demand; output as quantity with unit and optional period.",
    category: "Resilience",
    outputType: "quantity",
    allowedUnits: ["L", "m³"],
    allowedPeriods: ["day", "week", "month", "year"],
    defaultUnit: "L",
    params: [
      { key: "season", type: "select", label: "Season", defaultValue: "summer", options: [
        { label: "Spring", value: "spring" },
        { label: "Summer", value: "summer" },
        { label: "Autumn", value: "autumn" },
        { label: "Winter", value: "winter" }
      ]},
      { key: "period", type: "select", label: "Period", defaultValue: "day", options: [
        { label: "Per day", value: "day" },
        { label: "Per week", value: "week" },
        { label: "Per month", value: "month" }
      ]},
    ],
    buildPrompt: ({ row, params }) => {
      const species = row.speciesScientific
        ? `${row.speciesScientific}${row.cultivar ? ` ${row.cultivar}` : ""}`
        : (row.rowLabel ?? "");
      return [
        `Estimate irrigation water demand for: ${species}`,
        `Season: ${params.season}`,
        `Return a single quantity in the format: "N ${"L"}/${params.period} — reason".`,
        `Reason must be pragmatic and mention key drivers (e.g., drought tolerance, size class assumptions).`,
      ].join("\n");
    },
    validate: (raw, params) => validateQuantity(raw, { allowedUnits: ["L", "m³"], allowedPeriods: ["day","week","month","year"], defaultPeriod: params.period })
  },

  heat_resilience: {
    id: "heat_resilience",
    name: "Heat Resilience Score",
    description: "Score 0–100 with reason.",
    category: "Resilience",
    outputType: "score",
    params: [],
    buildPrompt: ({ row }) => {
      const species = row.speciesScientific ? row.speciesScientific : (row.rowLabel ?? "");
      return [
        `Assess heat resilience for species: ${species}`,
        `Output format: "NN/100 — reason" (NN integer 0-100).`,
        `Reason must cite key traits (leaf/soil tolerance, urban heat suitability).`
      ].join("\n");
    },
    validate: (raw) => validateScore(raw)
  },

  pest_susceptibility: {
    id: "pest_susceptibility",
    name: "Pest Susceptibility",
    description: "High/Medium/Low with reason.",
    category: "Resilience",
    outputType: "enum",
    allowedEnums: ["High", "Medium", "Low"],
    params: [
      { key: "localPests", type: "string", label: "Local pests (optional)", defaultValue: "" },
    ],
    buildPrompt: ({ row, params }) => {
      const species = row.speciesScientific ? row.speciesScientific : (row.rowLabel ?? "");
      return [
        `Assess pest susceptibility for: ${species}`,
        params.localPests ? `Consider local pests: ${params.localPests}` : "",
        `Output format: "High|Medium|Low — reason".`,
        `Reason must be 1-2 sentences, pragmatic.`
      ].filter(Boolean).join("\n");
    },
    validate: (raw) => validateEnum(raw, ["High","Medium","Low"])
  },

  native_invasive: {
    id: "native_invasive",
    name: "Native/Invasive Flag",
    description: "Flag if native, non-native, or invasive.",
    category: "Compliance",
    outputType: "enum",
    allowedEnums: ["Native", "Non-native", "Invasive", "Unknown"],
    params: [
      { key: "region", type: "string", label: "Region", defaultValue: "Netherlands" },
    ],
    buildPrompt: ({ row, params }) => {
      const species = row.speciesScientific ? row.speciesScientific : (row.rowLabel ?? "");
      return [
        `Determine status for ${species} in region: ${params.region}`,
        `Output format: "Native|Non-native|Invasive|Unknown — reason".`,
        `If uncertain, use Unknown.`
      ].join("\n");
    },
    validate: (raw) => validateEnum(raw, ["Native","Non-native","Invasive","Unknown"])
  },

  maintenance_cost: {
    id: "maintenance_cost",
    name: "Maintenance Cost",
    description: "Estimate annual maintenance cost.",
    category: "Maintenance",
    outputType: "currency",
    params: [
      { key: "period", type: "select", label: "Period", defaultValue: "year", options: [
        { label: "Per year", value: "year" },
        { label: "Per month", value: "month" }
      ]},
    ],
    buildPrompt: ({ row, params }) => {
      const species = row.speciesScientific ? row.speciesScientific : (row.rowLabel ?? "");
      return [
        `Estimate maintenance cost for: ${species}`,
        `Output format: "€NNN/${params.period} — reason".`,
        `Reason must mention typical pruning, watering, pest control assumptions.`
      ].join("\n");
    },
    validate: (raw, params) => validateCurrency(raw, { allowedCurrencies: ["€"], allowedPeriods: ["day","week","month","year"], defaultPeriod: params.period })
  },

  maintenance_schedule: {
    id: "maintenance_schedule",
    name: "Maintenance Schedule",
    description: "Recommended schedule label.",
    category: "Maintenance",
    outputType: "enum",
    allowedEnums: ["Monthly", "Quarterly", "Seasonal", "Annual", "As-needed"],
    params: [],
    buildPrompt: ({ row }) => {
      const species = row.speciesScientific ? row.speciesScientific : (row.rowLabel ?? "");
      return [
        `Recommend a maintenance schedule frequency for: ${species}`,
        `Output format: "Monthly|Quarterly|Seasonal|Annual|As-needed — reason".`
      ].join("\n");
    },
    validate: (raw) => validateEnum(raw, ["Monthly","Quarterly","Seasonal","Annual","As-needed"])
  },

  recommended_alternative: {
    id: "recommended_alternative",
    name: "Recommended Alternative",
    description: "Suggest alternatives with pragmatic reason.",
    category: "Recommendations",
    outputType: "text",
    params: [
      { key: "constraint", type: "string", label: "Constraint", defaultValue: "Urban street tree, limited soil volume" }
    ],
    buildPrompt: ({ row, params }) => {
      const species = row.speciesScientific ? row.speciesScientific : (row.rowLabel ?? "");
      return [
        `Suggest 1-2 alternative species for: ${species}`,
        `Constraint: ${params.constraint}`,
        `Output format: "<short statement> — reason".`,
        `Statement should include the recommended alternative(s).`
      ].join("\n");
    },
    validate: (raw) => validateText(raw)
  },

  // Add the rest as needed (co2_calculator, pruning_urgency, zoning_check, planting_spec_snippet)
  // We must implement all IDs declared in the type or Typescript will complain about missing keys in SKILL_TEMPLATES
  // Since the user didn't provide implementations for co2_calculator, pruning_urgency, zoning_check, planting_spec_snippet
  // I will add placeholders for them to avoid build errors.

  co2_calculator: {
    id: "co2_calculator",
    name: "CO2 Calculator",
    description: "Calculate CO2 sequestration.",
    category: "Carbon",
    outputType: "quantity",
    params: [],
    buildPrompt: ({ row }) => `Calculate CO2 for ${row.speciesScientific || row.rowLabel}. Format: N kg/year — reason`,
    validate: (raw) => validateQuantity(raw, { allowedUnits: ["kg"] })
  },

  pruning_urgency: {
    id: "pruning_urgency",
    name: "Pruning Urgency",
    description: "Urgency level for pruning.",
    category: "Maintenance",
    outputType: "enum",
    allowedEnums: ["High", "Medium", "Low"],
    params: [],
    buildPrompt: ({ row }) => `Determine pruning urgency for ${row.speciesScientific || row.rowLabel}. Format: High|Medium|Low — reason`,
    validate: (raw) => validateEnum(raw, ["High", "Medium", "Low"])
  },

  zoning_check: {
    id: "zoning_check",
    name: "Zoning Check",
    description: "Check zoning compliance.",
    category: "Siting",
    outputType: "badge",
    evidenceRequired: true,
    params: [],
    buildPrompt: ({ row }) => `Check zoning for ${row.speciesScientific || row.rowLabel}. Format: Compliant|Rejected|Insufficient Data — reason`,
    validate: (raw) => validateBadge(raw, ["Compliant", "Rejected", "Insufficient Data"])
  },

  planting_spec_snippet: {
    id: "planting_spec_snippet",
    name: "Planting Spec Snippet",
    description: "Generate a planting specification.",
    category: "Recommendations",
    outputType: "text",
    params: [],
    buildPrompt: ({ row }) => `Write planting spec for ${row.speciesScientific || row.rowLabel}. Format: <text> — reason`,
    validate: (raw) => validateText(raw)
  }
};
