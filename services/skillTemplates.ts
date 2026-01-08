// services/skillTemplates.ts
import type { SkillOutputType } from "../types.ts";
import type { SkillRowContext } from "./skills/types.ts";
import {
  validateBadge,
  validateScore,
  validateCurrency,
  validateQuantity,
  validateEnum,
  validateText
} from "./skills/validators.ts";
import { buildSkillContextBlock } from "./skills/prompting.ts";

export type SkillTemplateId =
  | "compliance_policy"
  | "water_demand"
  | "heat_resilience"
  | "drought_resilience"
  | "pest_susceptibility"
  | "native_invasive"
  | "maintenance_cost"
  | "maintenance_schedule"
  | "overall_fit"
  | "recommended_alternative"
  | "co2_calculator"
  | "pruning_urgency"
  | "zoning_check"
  | "planting_spec_snippet"
  | "site_regulatory_analysis";

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

export interface SkillTemplate {
  id: SkillTemplateId;
  name: string;
  description: string;
  category: "Compliance" | "Resilience" | "Maintenance" | "Carbon" | "Siting" | "Recommendations";
  outputType: SkillOutputType;
  allowedOutputTypes?: SkillOutputType[];

  // Policy/evidence controls:
  evidenceRequired?: boolean; // if true and missing evidence => Insufficient Data
  noGuessing?: boolean;       // if true, prohibit inference

  // For enums:
  allowedEnums?: string[];

  // For quantity/currency:
  allowedUnits?: string[];
  allowedCurrencies?: string[];
  defaultUnit?: string;
  defaultPeriod?: "day" | "week" | "month" | "year";
  allowedPeriods?: ("day" | "week" | "month" | "year")[];

  // Legacy prompt template for compatibility, or when no builder logic exists (less prioritized)
  promptTemplate?: string;

  params: SkillParamDef[];

  buildPrompt: (args: {
    row: SkillRowContext;
    params: Record<string, any>;
    attachedFileNames: string[];
    projectContext?: string;
  }) => string;

  validate: (raw: string, params: Record<string, any>) => SkillValidationResult;
}

export function getSkillTemplate(id: string): SkillTemplate | undefined {
  return SKILL_TEMPLATES[id as SkillTemplateId];
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
        buildSkillContextBlock({ row, attachedFileNames, projectContext }),
        "",
        `Species to evaluate: ${species}`,
        `Policy scope: ${params.policyScope}`,
        `Output format: "Compliant|Rejected|Insufficient Data — reason".`,
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
    buildPrompt: ({ row, params, attachedFileNames, projectContext }) => {
      const species = row.speciesScientific
        ? `${row.speciesScientific}${row.cultivar ? ` ${row.cultivar}` : ""}`
        : (row.rowLabel ?? "");
      return [
        buildSkillContextBlock({ row, attachedFileNames, projectContext }),
        "",
        `Estimate irrigation water demand for: ${species}`,
        `Season: ${params.season}`,
        `Output format: "N ${"L"}/${params.period} — reason".`,
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
    buildPrompt: ({ row, attachedFileNames, projectContext }) => {
      const species = row.speciesScientific ? row.speciesScientific : (row.rowLabel ?? "");
      return [
        buildSkillContextBlock({ row, attachedFileNames, projectContext }),
        "",
        `Assess heat resilience for species: ${species}`,
        `Output format: "NN/100 — reason" (NN integer 0-100).`,
        `Reason must cite key traits (leaf/soil tolerance, urban heat suitability).`
      ].join("\n");
    },
    validate: (raw) => validateScore(raw)
  },
  drought_resilience: {
    id: "drought_resilience",
    name: "Drought Resilience Score",
    description: "Score 0–100 with reason.",
    category: "Resilience",
    outputType: "score",
    params: [],
    buildPrompt: ({ row, attachedFileNames, projectContext }) => {
      const species = row.speciesScientific ? row.speciesScientific : (row.rowLabel ?? "");
      return [
        buildSkillContextBlock({ row, attachedFileNames, projectContext }),
        "",
        `Assess drought resilience for species: ${species}`,
        `Output format: "NN/100 — reason" (NN integer 0-100).`,
        `Reason must cite key traits (water demand, rooting depth, drought hardiness).`
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
    buildPrompt: ({ row, params, attachedFileNames, projectContext }) => {
      const species = row.speciesScientific ? row.speciesScientific : (row.rowLabel ?? "");
      return [
        buildSkillContextBlock({ row, attachedFileNames, projectContext }),
        "",
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
    buildPrompt: ({ row, params, attachedFileNames, projectContext }) => {
      const species = row.speciesScientific ? row.speciesScientific : (row.rowLabel ?? "");
      return [
        buildSkillContextBlock({ row, attachedFileNames, projectContext }),
        "",
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
    allowedCurrencies: ["€"],
    params: [
      { key: "period", type: "select", label: "Period", defaultValue: "year", options: [
        { label: "Per year", value: "year" },
        { label: "Per month", value: "month" }
      ]},
    ],
    buildPrompt: ({ row, params, attachedFileNames, projectContext }) => {
      const species = row.speciesScientific ? row.speciesScientific : (row.rowLabel ?? "");
      return [
        buildSkillContextBlock({ row, attachedFileNames, projectContext }),
        "",
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
    buildPrompt: ({ row, attachedFileNames, projectContext }) => {
      const species = row.speciesScientific ? row.speciesScientific : (row.rowLabel ?? "");
      return [
        buildSkillContextBlock({ row, attachedFileNames, projectContext }),
        "",
        `Recommend a maintenance schedule frequency for: ${species}`,
        `Output format: "Monthly|Quarterly|Seasonal|Annual|As-needed — reason".`
      ].join("\n");
    },
    validate: (raw) => validateEnum(raw, ["Monthly","Quarterly","Seasonal","Annual","As-needed"])
  },
  overall_fit: {
    id: "overall_fit",
    name: "Overall Fit Score",
    description: "Score overall species fit to site constraints and program goals.",
    category: "Recommendations",
    outputType: "score",
    params: [],
    buildPrompt: ({ row, attachedFileNames, projectContext }) => {
      const species = row.speciesScientific ? row.speciesScientific : (row.rowLabel ?? "");
      return [
        buildSkillContextBlock({ row, attachedFileNames, projectContext }),
        "",
        `Score overall fit for: ${species}`,
        `Output format: "NN/100 — reason" (NN integer 0-100).`,
        `Reason must weigh site constraints, resilience, and program goals.`
      ].join("\n");
    },
    validate: (raw) => validateScore(raw)
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
    buildPrompt: ({ row, params, attachedFileNames, projectContext }) => {
      const species = row.speciesScientific ? row.speciesScientific : (row.rowLabel ?? "");
      return [
        buildSkillContextBlock({ row, attachedFileNames, projectContext }),
        "",
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
    defaultUnit: "kg",
    defaultPeriod: "year",
    params: [],
    buildPrompt: ({ row, attachedFileNames, projectContext }) => [
      buildSkillContextBlock({ row, attachedFileNames, projectContext }),
      "",
      `Calculate CO2 for ${row.speciesScientific || row.rowLabel}.`,
      `Output format: "N kg/year — reason".`
    ].join("\n"),
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
    buildPrompt: ({ row, attachedFileNames, projectContext }) => [
      buildSkillContextBlock({ row, attachedFileNames, projectContext }),
      "",
      `Determine pruning urgency for ${row.speciesScientific || row.rowLabel}.`,
      `Output format: "High|Medium|Low — reason".`
    ].join("\n"),
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
    buildPrompt: ({ row, attachedFileNames, projectContext }) => [
      buildSkillContextBlock({ row, attachedFileNames, projectContext }),
      "",
      `Check zoning for ${row.speciesScientific || row.rowLabel}.`,
      `Output format: "Compliant|Rejected|Insufficient Data — reason".`
    ].join("\n"),
    validate: (raw) => validateBadge(raw, ["Compliant", "Rejected", "Insufficient Data"])
  },

  planting_spec_snippet: {
    id: "planting_spec_snippet",
    name: "Planting Spec Snippet",
    description: "Generate a planting specification.",
    category: "Recommendations",
    outputType: "text",
    params: [],
    buildPrompt: ({ row, attachedFileNames, projectContext }) => [
      buildSkillContextBlock({ row, attachedFileNames, projectContext }),
      "",
      `Write planting spec for ${row.speciesScientific || row.rowLabel}.`,
      `Output format: "<text> — reason".`
    ].join("\n"),
    validate: (raw) => validateText(raw)
  },

  site_regulatory_analysis: {
    id: "site_regulatory_analysis",
    name: "Strategic Site & Regulatory Analysis",
    description: "Extract site, regulatory, equity, and biophysical constraints with citations.",
    category: "Siting",
    outputType: "text",
    params: [{ key: "locationHint", type: "string", label: "Location hint", defaultValue: "" }],
    buildPrompt: ({ params, attachedFileNames, projectContext }) => {
      const location = params.locationHint || projectContext || "Unspecified location";
      return [
        `You are analyzing project documents for: ${location}.`,
        `Files available: ${attachedFileNames.length ? attachedFileNames.join(", ") : "(none)"}.`,
        "Extract grounded constraints using only evidence in the documents.",
        "Return JSON with keys: summary, keyFindings (array), derivedConstraints, evidenceItems (array).",
        "Each evidenceItem must include claim and citations with sourceId + locator.page if available.",
        "If information is missing, set null and note uncertainty in keyFindings."
      ].join("\n");
    },
    validate: (raw) => validateText(raw)
  }
};

export const SKILL_TEMPLATE_MAP = new Map(Object.values(SKILL_TEMPLATES).map(t => [t.id, t]));
