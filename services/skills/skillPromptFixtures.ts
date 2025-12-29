import type { SkillTemplateId } from "../skillTemplates";
import type { SkillRowContext } from "./types.ts";

export type SkillPromptFixture = {
  id: SkillTemplateId;
  row: SkillRowContext;
  params: Record<string, any>;
  attachedFileNames: string[];
  projectContext?: string;
  expectedPrompt: string;
};

const baseRow: SkillRowContext = {
  rowLabel: "Sample Row",
  speciesScientific: "Quercus robur",
  cultivar: "'Fastigiata'",
  commonName: "English oak",
  cellsByColumnTitle: {
    Notes: "Urban site"
  }
};

const baseContext = [
  "Row context:",
  "- Row label: Sample Row",
  "- Species (scientific): Quercus robur",
  "- Cultivar: 'Fastigiata'",
  "- Common name: English oak",
  "- Notes: Urban site",
  "",
  "File context: policy.pdf",
  "",
  "Project context:",
  "City of Exampleville",
  "",
  "Instruction: Use species first; then consider other row fields for context."
].join("\n");

export const SKILL_PROMPT_FIXTURES: SkillPromptFixture[] = [
  {
    id: "compliance_policy",
    row: baseRow,
    params: { policyScope: "Municipal planting policy", strictMode: true },
    attachedFileNames: ["policy.pdf"],
    projectContext: "City of Exampleville",
    expectedPrompt: [
      baseContext,
      "Species to evaluate: Quercus robur 'Fastigiata'",
      "Policy scope: Municipal planting policy",
      "Output format: \"Compliant|Rejected|Insufficient Data — reason\"."
    ].join("\n")
  },
  {
    id: "water_demand",
    row: baseRow,
    params: { season: "summer", period: "day" },
    attachedFileNames: ["policy.pdf"],
    projectContext: "City of Exampleville",
    expectedPrompt: [
      baseContext,
      "",
      "Estimate irrigation water demand for: Quercus robur 'Fastigiata'",
      "Season: summer",
      "Output format: \"N L/day — reason\".",
      "Reason must be pragmatic and mention key drivers (e.g., drought tolerance, size class assumptions)."
    ].join("\n")
  },
  {
    id: "heat_resilience",
    row: baseRow,
    params: {},
    attachedFileNames: ["policy.pdf"],
    projectContext: "City of Exampleville",
    expectedPrompt: [
      baseContext,
      "",
      "Assess heat resilience for species: Quercus robur",
      "Output format: \"NN/100 — reason\" (NN integer 0-100).",
      "Reason must cite key traits (leaf/soil tolerance, urban heat suitability)."
    ].join("\n")
  },
  {
    id: "pest_susceptibility",
    row: baseRow,
    params: { localPests: "Aphids" },
    attachedFileNames: ["policy.pdf"],
    projectContext: "City of Exampleville",
    expectedPrompt: [
      baseContext,
      "Assess pest susceptibility for: Quercus robur",
      "Consider local pests: Aphids",
      "Output format: \"High|Medium|Low — reason\".",
      "Reason must be 1-2 sentences, pragmatic."
    ].join("\n")
  },
  {
    id: "native_invasive",
    row: baseRow,
    params: { region: "Netherlands" },
    attachedFileNames: ["policy.pdf"],
    projectContext: "City of Exampleville",
    expectedPrompt: [
      baseContext,
      "",
      "Determine status for Quercus robur in region: Netherlands",
      "Output format: \"Native|Non-native|Invasive|Unknown — reason\".",
      "If uncertain, use Unknown."
    ].join("\n")
  },
  {
    id: "maintenance_cost",
    row: baseRow,
    params: { period: "year" },
    attachedFileNames: ["policy.pdf"],
    projectContext: "City of Exampleville",
    expectedPrompt: [
      baseContext,
      "",
      "Estimate maintenance cost for: Quercus robur",
      "Output format: \"€NNN/year — reason\".",
      "Reason must mention typical pruning, watering, pest control assumptions."
    ].join("\n")
  },
  {
    id: "maintenance_schedule",
    row: baseRow,
    params: {},
    attachedFileNames: ["policy.pdf"],
    projectContext: "City of Exampleville",
    expectedPrompt: [
      baseContext,
      "",
      "Recommend a maintenance schedule frequency for: Quercus robur",
      "Output format: \"Monthly|Quarterly|Seasonal|Annual|As-needed — reason\"."
    ].join("\n")
  },
  {
    id: "recommended_alternative",
    row: baseRow,
    params: { constraint: "Urban street tree, limited soil volume" },
    attachedFileNames: ["policy.pdf"],
    projectContext: "City of Exampleville",
    expectedPrompt: [
      baseContext,
      "",
      "Suggest 1-2 alternative species for: Quercus robur",
      "Constraint: Urban street tree, limited soil volume",
      "Output format: \"<short statement> — reason\".",
      "Statement should include the recommended alternative(s)."
    ].join("\n")
  },
  {
    id: "co2_calculator",
    row: baseRow,
    params: {},
    attachedFileNames: ["policy.pdf"],
    projectContext: "City of Exampleville",
    expectedPrompt: [
      baseContext,
      "",
      "Calculate CO2 for Quercus robur.",
      "Output format: \"N kg/year — reason\"."
    ].join("\n")
  },
  {
    id: "pruning_urgency",
    row: baseRow,
    params: {},
    attachedFileNames: ["policy.pdf"],
    projectContext: "City of Exampleville",
    expectedPrompt: [
      baseContext,
      "",
      "Determine pruning urgency for Quercus robur.",
      "Output format: \"High|Medium|Low — reason\"."
    ].join("\n")
  },
  {
    id: "zoning_check",
    row: baseRow,
    params: {},
    attachedFileNames: ["policy.pdf"],
    projectContext: "City of Exampleville",
    expectedPrompt: [
      baseContext,
      "",
      "Check zoning for Quercus robur.",
      "Output format: \"Compliant|Rejected|Insufficient Data — reason\"."
    ].join("\n")
  },
  {
    id: "planting_spec_snippet",
    row: baseRow,
    params: {},
    attachedFileNames: ["policy.pdf"],
    projectContext: "City of Exampleville",
    expectedPrompt: [
      baseContext,
      "",
      "Write planting spec for Quercus robur.",
      "Output format: \"<text> — reason\"."
    ].join("\n")
  }
];
