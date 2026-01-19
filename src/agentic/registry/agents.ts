// src/agentic/registry/agents.ts
//
// Seeded AgentProfile objects for IDs 1–15 (v1).
// These are copy/paste ready and intentionally "agent-first":
// - strict output_schema patterns (JSON Schema draft-07 style)
// - supports ok / insufficient_data / rejected modes via output envelope
//
// NOTE: This file assumes you have AgentProfile type defined in:
//   src/agentic/runtime/types.ts  (or src/agentic/contracts/zod.ts exports)
//
// If your type name/path differs, adjust the import accordingly.

import type { AgentProfile } from '../contracts/zod.ts';

// ---------------------------
// Shared JSON Schema fragments
// ---------------------------
const JsonSchemaBase = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  additionalProperties: false
} as const;

const EvidenceItemSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['kind', 'ref', 'quote'],
  properties: {
    kind: { type: 'string', enum: ['file', 'url', 'dataset', 'manual', 'policy'] },
    ref: { type: 'string', minLength: 1 },
    quote: { type: 'string', minLength: 1 },
    locator: { type: 'string' },
    confidence: { type: 'number', minimum: 0, maximum: 1 }
  }
} as const;

const AssumptionItemSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'statement'],
  properties: {
    id: { type: 'string', minLength: 1 },
    statement: { type: 'string', minLength: 1 },
    impact: { type: 'string', enum: ['low', 'medium', 'high'] },
    reversible: { type: 'boolean' }
  }
} as const;

const InsufficientDataItemSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['field', 'reason'],
  properties: {
    field: { type: 'string', minLength: 1 },
    reason: { type: 'string', minLength: 1 },
    suggested_next: { type: 'string' }
  }
} as const;

// Output envelope (mode + payload + evidence/assumptions).
// Each agent specializes the payload schema.
function outputEnvelope(payloadSchema: any) {
  return {
    ...JsonSchemaBase,
    required: ['mode'],
    properties: {
      mode: { type: 'string', enum: ['ok', 'insufficient_data', 'rejected', 'error'] },

      // present when mode=ok (or sometimes rejected with rationale)
      payload: payloadSchema,

      confidence: { type: 'number', minimum: 0, maximum: 1 },
      evidence: { type: 'array', items: EvidenceItemSchema, default: [] },
      assumptions: { type: 'array', items: AssumptionItemSchema, default: [] },

      // present when mode=insufficient_data
      insufficient_data: { type: 'array', items: InsufficientDataItemSchema },

      // present when mode=error
      error: {
        type: 'object',
        additionalProperties: false,
        required: ['code', 'message'],
        properties: {
          code: { type: 'string' },
          message: { type: 'string' },
          retriable: { type: 'boolean' }
        }
      }
    }
  };
}

// ---------------------------
// Payload pattern primitives
// ---------------------------
const BadgePayload = (badgeEnum: readonly string[], extra?: Record<string, any>) => ({
  ...JsonSchemaBase,
  required: ['badge'],
  properties: {
    badge: { type: 'string', enum: badgeEnum as any },
    rationale: { type: 'string' },
    ...(extra ?? {})
  }
});

const EnumPayload = (enumValues: readonly string[], extra?: Record<string, any>) => ({
  ...JsonSchemaBase,
  required: ['value'],
  properties: {
    value: { type: 'string', enum: enumValues as any },
    rationale: { type: 'string' },
    ...(extra ?? {})
  }
});

const ScorePayload = (min = 0, max = 100, extra?: Record<string, any>) => ({
  ...JsonSchemaBase,
  required: ['score'],
  properties: {
    score: { type: 'number', minimum: min, maximum: max },
    rationale: { type: 'string' },
    ...(extra ?? {})
  }
});

const QuantityPayload = (unitEnum: readonly string[], extra?: Record<string, any>) => ({
  ...JsonSchemaBase,
  required: ['quantity', 'unit'],
  properties: {
    quantity: { type: 'number', minimum: 0 },
    unit: { type: 'string', enum: unitEnum as any },
    rationale: { type: 'string' },
    ...(extra ?? {})
  }
});

const CurrencyPayload = (currencyEnum: readonly string[] = ['EUR'] as const, extra?: Record<string, any>) => ({
  ...JsonSchemaBase,
  required: ['amount', 'currency'],
  properties: {
    amount: { type: 'number', minimum: 0 },
    currency: { type: 'string', enum: currencyEnum as any },
    period: { type: 'string', enum: ['month', 'year', 'one_off'] },
    rationale: { type: 'string' },
    ...(extra ?? {})
  }
});

const TextPayload = (extra?: Record<string, any>) => ({
  ...JsonSchemaBase,
  required: ['text'],
  properties: {
    text: { type: 'string', minLength: 1 },
    rationale: { type: 'string' },
    ...(extra ?? {})
  }
});

const JsonConstraintsPayload = () => ({
  ...JsonSchemaBase,
  required: ['constraints'],
  properties: {
    constraints: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'type', 'statement'],
        properties: {
          id: { type: 'string', minLength: 1 },
          type: { type: 'string', enum: ['site', 'regulatory', 'biophysical', 'operational', 'budget'] },
          statement: { type: 'string', minLength: 1 },
          severity: { type: 'string', enum: ['must', 'should', 'nice_to_have'] },
          rationale: { type: 'string' },
          evidence_refs: { type: 'array', items: { type: 'string' }, default: [] }
        }
      }
    },
    summary: { type: 'string' }
  }
});

// ---------------------------
// Agent Profiles 1–15
// ---------------------------
export const AGENTS_V1: AgentProfile[] = [
  // 1) Compliance (Policy-grounded)
  {
    agent_id: 'compliance.policy_grounded',
    spec_version: '1.0.0',
    schema_version: '1.0.0',
    name: 'Compliance (Policy-grounded)',
    category: 'compliance',
    description:
      'Checks species compliance against policy documents (e.g., municipal tree list) and returns Compliant/Rejected/Insufficient Data with evidence.',
    inputs: [
      { key: 'species', type: 'string', required: true, description: 'Scientific or common name.' },
      {
        key: 'policyScope',
        type: 'string',
        required: true,
        description: "Policy scope identifier (e.g., 'NL-Amsterdam-StreetTrees')."
      },
      {
        key: 'strictMode',
        type: 'boolean',
        required: false,
        default: false,
        description: 'If true, reject when uncertain; else allow insufficient_data.'
      },
      { key: 'region', type: 'string', required: false, description: 'Optional region hint (NL province/municipality).' }
    ],
    output_modes: ['ok', 'insufficient_data', 'rejected'],
    output_schema: outputEnvelope(
      BadgePayload(['Compliant', 'Rejected', 'Insufficient Data'] as const, {
        policy_scope: { type: 'string' },
        checks: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['rule', 'result'],
            properties: {
              rule: { type: 'string' },
              result: { type: 'string', enum: ['pass', 'fail', 'unknown'] },
              note: { type: 'string' }
            }
          },
          default: []
        }
      })
    ),
    tags: ['policy', 'evidence-first', 'nl'],
    tooling: { external_tools: ['policy_docs', 'municipal_tree_list'] },
    governance: { risk: 'high', requires_evidence: true }
  },

  // 2) Water Demand
  {
    agent_id: 'water_demand.estimate',
    spec_version: '1.0.0',
    schema_version: '1.0.0',
    name: 'Water Demand',
    category: 'water',
    description: 'Estimates irrigation water demand for a species for a given season and period.',
    inputs: [
      { key: 'species', type: 'string', required: true, description: 'Scientific or common name.' },
      {
        key: 'season',
        type: 'select',
        required: true,
        options: ['spring', 'summer', 'autumn', 'winter'],
        description: 'Season context.'
      },
      { key: 'period', type: 'select', required: true, options: ['day', 'week', 'month', 'year'], description: 'Reporting period.' },
      { key: 'site', type: 'object', required: false, description: 'Optional site factors (soil, exposure, planting method).' }
    ],
    output_modes: ['ok', 'insufficient_data'],
    output_schema: outputEnvelope(
      QuantityPayload(['L/day', 'L/week', 'L/month', 'L/year'] as const, {
        season: { type: 'string', enum: ['spring', 'summer', 'autumn', 'winter'] },
        period: { type: 'string', enum: ['day', 'week', 'month', 'year'] },
        range: {
          type: 'object',
          additionalProperties: false,
          properties: {
            min: { type: 'number', minimum: 0 },
            max: { type: 'number', minimum: 0 }
          }
        }
      })
    ),
    tags: ['water', 'irrigation'],
    tooling: { external_tools: ['species_db', 'climate_normals'] },
    governance: { risk: 'medium', requires_evidence: true }
  },

  // 3) Heat Resilience Score
  {
    agent_id: 'resilience.heat_score',
    spec_version: '1.0.0',
    schema_version: '1.0.0',
    name: 'Heat Resilience Score',
    category: 'climate_resilience',
    description: 'Scores heat resilience 0–100 with rationale.',
    inputs: [{ key: 'species', type: 'string', required: true, description: 'Scientific or common name.' }],
    output_modes: ['ok', 'insufficient_data'],
    output_schema: outputEnvelope(
      ScorePayload(0, 100, {
        rubric: { type: 'string', default: '0–100 heuristic heat tolerance rubric' }
      })
    ),
    tags: ['climate', 'heat'],
    tooling: { external_tools: ['species_db'] },
    governance: { risk: 'medium', requires_evidence: false }
  },

  // 4) Drought Resilience Score
  {
    agent_id: 'resilience.drought_score',
    spec_version: '1.0.0',
    schema_version: '1.0.0',
    name: 'Drought Resilience Score',
    category: 'climate_resilience',
    description: 'Scores drought resilience 0–100 with rationale.',
    inputs: [{ key: 'species', type: 'string', required: true, description: 'Scientific or common name.' }],
    output_modes: ['ok', 'insufficient_data'],
    output_schema: outputEnvelope(
      ScorePayload(0, 100, {
        rubric: { type: 'string', default: '0–100 heuristic drought tolerance rubric' }
      })
    ),
    tags: ['climate', 'drought'],
    tooling: { external_tools: ['species_db'] },
    governance: { risk: 'medium', requires_evidence: false }
  },

  // 5) Pest Susceptibility
  {
    agent_id: 'risk.pest_susceptibility',
    spec_version: '1.0.0',
    schema_version: '1.0.0',
    name: 'Pest Susceptibility',
    category: 'risk',
    description: 'Rates pest susceptibility (High/Medium/Low) with rationale; optionally conditioned on local pests.',
    inputs: [
      { key: 'species', type: 'string', required: true, description: 'Scientific or common name.' },
      { key: 'localPests', type: 'string', required: false, description: 'Comma-separated local pest/disease list.' },
      { key: 'region', type: 'string', required: false, description: 'Region hint.' }
    ],
    output_modes: ['ok', 'insufficient_data'],
    output_schema: outputEnvelope(
      EnumPayload(['High', 'Medium', 'Low'] as const, {
        key_risks: { type: 'array', items: { type: 'string' }, default: [] }
      })
    ),
    tags: ['pests', 'disease'],
    tooling: { external_tools: ['plant_health_db'] },
    governance: { risk: 'medium', requires_evidence: true }
  },

  // 6) Native/Invasive Flag
  {
    agent_id: 'biogeography.native_invasive_flag',
    spec_version: '1.0.0',
    schema_version: '1.0.0',
    name: 'Native/Invasive Flag',
    category: 'biodiversity',
    description: 'Classifies species as Native / Non-native / Invasive / Unknown for a region.',
    inputs: [
      { key: 'species', type: 'string', required: true, description: 'Scientific or common name.' },
      { key: 'region', type: 'string', required: true, description: 'Region identifier (e.g., NL, EU, province, municipality).' }
    ],
    output_modes: ['ok', 'insufficient_data'],
    output_schema: outputEnvelope(
      EnumPayload(['Native', 'Non-native', 'Invasive', 'Unknown'] as const, {
        region: { type: 'string' }
      })
    ),
    tags: ['native', 'invasive'],
    tooling: { external_tools: ['invasive_species_registry'] },
    governance: { risk: 'high', requires_evidence: true }
  },

  // 7) Maintenance Cost
  {
    agent_id: 'maintenance.cost_estimate',
    spec_version: '1.0.0',
    schema_version: '1.0.0',
    name: 'Maintenance Cost',
    category: 'maintenance',
    description: 'Estimates maintenance cost per period for typical operations (pruning, inspection, watering, replacement).',
    inputs: [
      { key: 'species', type: 'string', required: true, description: 'Species.' },
      { key: 'period', type: 'select', required: true, options: ['month', 'year'], description: 'Cost period.' },
      { key: 'dbh_cm', type: 'number', required: false, description: 'Optional diameter for size-based costing.' },
      {
        key: 'actionType',
        type: 'select',
        required: false,
        options: ['routine', 'pruning', 'inspection', 'replacement'],
        description: 'Optional focus.'
      },
      { key: 'region', type: 'string', required: false, description: 'Region/market pricing hint.' }
    ],
    output_modes: ['ok', 'insufficient_data'],
    output_schema: outputEnvelope(
      CurrencyPayload(['EUR'] as const, {
        breakdown: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['item', 'amount'],
            properties: { item: { type: 'string' }, amount: { type: 'number', minimum: 0 } }
          },
          default: []
        }
      })
    ),
    tags: ['cost', 'maintenance'],
    tooling: { external_tools: ['cost_catalog', 'municipal_rates'] },
    governance: { risk: 'medium', requires_evidence: true }
  },

  // 8) Maintenance Schedule
  {
    agent_id: 'maintenance.schedule_recommendation',
    spec_version: '1.0.0',
    schema_version: '1.0.0',
    name: 'Maintenance Schedule',
    category: 'maintenance',
    description: 'Recommends maintenance frequency label (Monthly/Quarterly/Seasonal/Annual/As-needed).',
    inputs: [
      { key: 'species', type: 'string', required: true, description: 'Species.' },
      { key: 'context', type: 'object', required: false, description: 'Site/usage context (street, park, high traffic).' }
    ],
    output_modes: ['ok', 'insufficient_data'],
    output_schema: outputEnvelope(
      EnumPayload(['Monthly', 'Quarterly', 'Seasonal', 'Annual', 'As-needed'] as const, {
        tasks: { type: 'array', items: { type: 'string' }, default: [] }
      })
    ),
    tags: ['schedule', 'maintenance'],
    tooling: { external_tools: ['arborist_guidelines'] },
    governance: { risk: 'low', requires_evidence: false }
  },

  // 9) Overall Fit Score
  {
    agent_id: 'decision.overall_fit_score',
    spec_version: '1.0.0',
    schema_version: '1.0.0',
    name: 'Overall Fit Score',
    category: 'planning',
    description: 'Computes overall fit (0–100) from existing payload metrics and constraints; includes weighting transparency.',
    inputs: [
      { key: 'payload', type: 'object', required: true, description: 'Enriched payload from previous agents.' },
      { key: 'weights', type: 'object', required: false, description: 'Optional weight overrides.' }
    ],
    output_modes: ['ok', 'insufficient_data'],
    output_schema: outputEnvelope(
      ScorePayload(0, 100, {
        weights_used: {
          type: 'object',
          additionalProperties: { type: 'number' },
          default: {}
        },
        components: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['name', 'value', 'weight'],
            properties: {
              name: { type: 'string' },
              value: { type: 'number' },
              weight: { type: 'number' }
            }
          },
          default: []
        }
      })
    ),
    tags: ['scoring', 'ranking'],
    tooling: { external_tools: [] },
    governance: { risk: 'medium', requires_evidence: false }
  },

  // 10) Recommended Alternative
  {
    agent_id: 'recommendation.alternative_species',
    spec_version: '1.0.0',
    schema_version: '1.0.0',
    name: 'Recommended Alternative',
    category: 'planning',
    description: 'Suggests 1–2 alternative species and reasons, given a constraint or rejection reason.',
    inputs: [
      { key: 'species', type: 'string', required: false, description: 'Original species (optional).' },
      {
        key: 'constraint',
        type: 'string',
        required: true,
        description: 'Constraint to satisfy (e.g., salt tolerance, max height).'
      },
      { key: 'region', type: 'string', required: false, description: 'Region hint.' }
    ],
    output_modes: ['ok', 'insufficient_data'],
    output_schema: outputEnvelope({
      ...JsonSchemaBase,
      required: ['alternatives'],
      properties: {
        alternatives: {
          type: 'array',
          minItems: 1,
          maxItems: 2,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['species', 'reason'],
            properties: {
              species: { type: 'string', minLength: 1 },
              reason: { type: 'string', minLength: 1 },
              tradeoffs: { type: 'array', items: { type: 'string' }, default: [] }
            }
          }
        },
        rationale: { type: 'string' }
      }
    }),
    tags: ['alternatives', 'recommendation'],
    tooling: { external_tools: ['species_db'] },
    governance: { risk: 'low', requires_evidence: false }
  },

  // 11) CO2 Calculator
  {
    agent_id: 'benefits.co2_sequestration',
    spec_version: '1.0.0',
    schema_version: '1.0.0',
    name: 'CO2 Calculator',
    category: 'carbon',
    description: 'Estimates annual CO2 sequestration (kg/year), optionally wrapping i-Tree-like logic or proxy tables.',
    inputs: [
      { key: 'species', type: 'string', required: true, description: 'Species.' },
      { key: 'dbh_cm', type: 'number', required: false, description: 'Diameter at breast height (cm).' },
      { key: 'age_years', type: 'number', required: false, description: 'Optional age.' },
      { key: 'region', type: 'string', required: false, description: 'Region hint.' }
    ],
    output_modes: ['ok', 'insufficient_data'],
    output_schema: outputEnvelope(
      QuantityPayload(['kg/year'] as const, {
        method: { type: 'string', default: 'proxy' }
      })
    ),
    tags: ['co2', 'benefits'],
    tooling: { external_tools: ['itree_proxy', 'species_db'] },
    governance: { risk: 'medium', requires_evidence: true }
  },

  // 12) Pruning Urgency
  {
    agent_id: 'hazard.pruning_urgency',
    spec_version: '1.0.0',
    schema_version: '1.0.0',
    name: 'Pruning Urgency',
    category: 'risk',
    description: 'Labels pruning urgency (High/Medium/Low) based on tree condition/structure observations.',
    inputs: [
      { key: 'treeCondition', type: 'object', required: true, description: 'Condition observations (defects, decay, lean, crown).' },
      { key: 'context', type: 'object', required: false, description: 'Target occupancy, proximity to infrastructure.' }
    ],
    output_modes: ['ok', 'insufficient_data'],
    output_schema: outputEnvelope(
      EnumPayload(['High', 'Medium', 'Low'] as const, {
        triggers: { type: 'array', items: { type: 'string' }, default: [] }
      })
    ),
    tags: ['pruning', 'risk'],
    tooling: { external_tools: ['arborist_guidelines'] },
    governance: { risk: 'high', requires_evidence: true }
  },

  // 13) Zoning Check
  {
    agent_id: 'regulatory.zoning_check',
    spec_version: '1.0.0',
    schema_version: '1.0.0',
    name: 'Zoning Check',
    category: 'compliance',
    description: 'Determines zoning compliance for a species/location (Compliant/Rejected/Insufficient Data).',
    inputs: [
      { key: 'location', type: 'object', required: true, description: 'Location hint (coordinates/address/parcel id).' },
      { key: 'actionType', type: 'string', required: false, description: 'Planting/removal/works.' },
      { key: 'species', type: 'string', required: false, description: 'Optional species for restrictions.' },
      { key: 'zoningDataset', type: 'string', required: false, description: 'Dataset/source id.' }
    ],
    output_modes: ['ok', 'insufficient_data', 'rejected'],
    output_schema: outputEnvelope(
      BadgePayload(['Compliant', 'Rejected', 'Insufficient Data'] as const, {
        zone_id: { type: 'string' },
        restrictions: { type: 'array', items: { type: 'string' }, default: [] }
      })
    ),
    tags: ['zoning', 'regulatory'],
    tooling: { external_tools: ['zoning_plan', 'gis'] },
    governance: { risk: 'high', requires_evidence: true }
  },

  // 14) Planting Spec Snippet
  {
    agent_id: 'specs.planting_snippet',
    spec_version: '1.0.0',
    schema_version: '1.0.0',
    name: 'Planting Spec Snippet',
    category: 'document',
    description: 'Produces a species-specific planting specification snippet suitable for procurement/spec packs.',
    inputs: [
      { key: 'species', type: 'string', required: true, description: 'Species.' },
      { key: 'context', type: 'object', required: false, description: 'Site constraints (corridor, soil, watering, stakes).' },
      { key: 'standards', type: 'string', required: false, description: 'Applicable standards reference.' }
    ],
    output_modes: ['ok', 'insufficient_data'],
    output_schema: outputEnvelope(
      TextPayload({
        format: { type: 'string', enum: ['plain', 'markdown'], default: 'markdown' },
        sections: { type: 'array', items: { type: 'string' }, default: [] }
      })
    ),
    tags: ['spec', 'procurement'],
    tooling: { external_tools: ['spec_templates'] },
    governance: { risk: 'medium', requires_evidence: false }
  },

  // 15) Strategic Site & Regulatory Analysis
  {
    agent_id: 'analysis.strategic_site_regulatory',
    spec_version: '1.0.0',
    schema_version: '1.0.0',
    name: 'Strategic Site & Regulatory Analysis',
    category: 'planning',
    description:
      'Extracts site/regulatory/biophysical constraints with citations. Outputs a strict JSON constraints list plus summary.',
    inputs: [
      {
        key: 'locationHint',
        type: 'string',
        required: true,
        description: 'Location hint (address, municipality, coordinates, corridor description).'
      },
      { key: 'sources', type: 'array', required: false, description: 'Optional list of uploaded files/urls to ground constraints.' },
      {
        key: 'strictMode',
        type: 'boolean',
        required: false,
        default: false,
        description: 'If true, prefer insufficient_data over assumptions.'
      }
    ],
    output_modes: ['ok', 'insufficient_data'],
    output_schema: outputEnvelope(JsonConstraintsPayload()),
    tags: ['constraints', 'evidence', 'site', 'regulatory'],
    tooling: { external_tools: ['gis', 'policy_docs', 'open_datasets'] },
    governance: { risk: 'high', requires_evidence: true }
  }
];

export const agentProfiles: AgentProfile[] = AGENTS_V1;

// Optional: convenient map
export const AGENTS_BY_ID_V1: Record<string, AgentProfile> = Object.fromEntries(
  AGENTS_V1.map((a) => [a.agent_id, a])
);
