import { z } from 'zod';

export const SemVerSchema = z
  .string()
  .regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-.]+)?(?:\+[0-9A-Za-z-.]+)?$/);

export const AgentIdSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/);

export const IsoDateTimeSchema = z.string().datetime({ offset: true });

export const ConfidenceSchema = z.object({
  level: z.enum(['high', 'medium', 'low', 'unknown']),
  score: z.number().min(0).max(1).nullable().optional(),
  reasons: z.array(z.string()).max(20).optional()
});

export const EvidenceSchema = z.object({
  kind: z.enum(['authoritative', 'proxy', 'heuristic', 'user_provided', 'computed', 'external_tool']),
  claim: z.string().min(1),
  citations: z
    .array(
      z.object({
        label: z.string().min(1),
        vault_ref: z.object({
          kind: z.enum(['file', 'dataset', 'record', 'url', 'inline']),
          ref: z.string().min(1),
          locator: z.string().nullable().optional(),
          hash: z.string().regex(/^[a-fA-F0-9]{32,128}$/).optional()
        }),
        excerpt: z.string().max(500).nullable().optional()
      })
    )
    .max(20)
    .optional(),
  notes: z.string().max(1000).nullable().optional()
});

export const AssumptionSchema = z.object({
  id: z.string().min(1),
  claim: z.string().min(1),
  basis: z.enum(['authoritative', 'proxy', 'heuristic', 'user_input', 'missing_data']),
  risk: z.enum(['low', 'medium', 'high']),
  confidence: ConfidenceSchema,
  how_to_validate: z.string().min(1),
  owner: z.enum(['weflora', 'user', 'shared'])
});

export const OutputEnvelopeSchema = z.object({
  mode: z.enum(['ok', 'insufficient_data', 'rejected']),
  payload: z.record(z.any()).nullable().optional(),
  confidence: ConfidenceSchema.optional(),
  evidence: z.array(EvidenceSchema).max(100).optional(),
  assumptions: z.array(AssumptionSchema).max(100).optional(),
  insufficient_data: z
    .object({
      missing: z.array(z.string()).min(1).max(50),
      recommended_next: z.array(z.string()).max(50).optional()
    })
    .optional()
});

export const AgentProfileSchema = z.object({
  schema_version: SemVerSchema,
  spec_version: SemVerSchema,
  agent_id: AgentIdSchema,
  name: z.string().min(1),
  category: z.enum([
    'compliance',
    'planning',
    'biodiversity',
    'climate_resilience',
    'water',
    'carbon',
    'maintenance',
    'procurement',
    'risk',
    'enrichment',
    'geospatial',
    'document'
  ]),
  description: z.string().min(1),
  inputs: z.array(z.record(z.any())),
  output_modes: z.array(z.enum(['ok', 'insufficient_data', 'rejected'])),
  output_schema: z.record(z.any()),
  tags: z.array(z.string()).optional(),
  tooling: z.record(z.any()).nullable().optional(),
  governance: z.record(z.any()).nullable().optional()
});

export const WorkflowTemplateSchema = z.object({
  schema_version: SemVerSchema,
  workflow_id: z.string().min(1),
  spec_version: SemVerSchema,
  name: z.string().min(1),
  description: z.string().min(1),
  parameters_schema: z.record(z.any()).optional(),
  steps: z
    .array(
      z.object({
        step_id: z.string().min(1),
        title: z.string().min(1),
        agent_id: AgentIdSchema,
        agent_version: SemVerSchema,
        parameters: z.record(z.any()).optional(),
        input_mapping: z
          .array(
            z.object({
              from: z.string(),
              to: z.string(),
              mode: z.enum(['copy', 'merge', 'append', 'set_if_missing']),
              required: z.boolean().optional(),
              default_value: z.union([z.string(), z.number(), z.boolean(), z.record(z.any()), z.array(z.any()), z.null()]).optional()
            })
          )
          .optional(),
        output_mapping: z
          .array(
            z.object({
              from: z.string(),
              to: z.string(),
              mode: z.enum(['copy', 'merge', 'append', 'set_if_missing']),
              required: z.boolean().optional(),
              default_value: z.union([z.string(), z.number(), z.boolean(), z.record(z.any()), z.array(z.any()), z.null()]).optional()
            })
          )
          .optional(),
        optional: z.boolean().optional(),
        on_insufficient_data: z.enum(['skip', 'continue_with_partial', 'fail', 'mark_review']).optional()
      })
    )
    .min(1)
});

export const StepRecordSchema = z.object({
  schema_version: SemVerSchema,
  id: z.string().uuid(),
  run_id: z.string().uuid(),
  scope_id: z.string().min(1),
  agent_id: AgentIdSchema,
  agent_version: SemVerSchema,
  workflow_id: z.string().min(1).nullable().optional(),
  workflow_version: SemVerSchema.nullable().optional(),
  workflow_step_id: z.string().min(1).nullable().optional(),
  status: z.enum(['queued', 'running', 'ok', 'insufficient_data', 'rejected', 'error']),
  inputs: z.record(z.any()),
  output: OutputEnvelopeSchema,
  metrics: z.record(z.any()).nullable().optional(),
  error: z.record(z.any()).nullable().optional(),
  created_at: IsoDateTimeSchema,
  started_at: IsoDateTimeSchema.nullable().optional(),
  finished_at: IsoDateTimeSchema.nullable().optional()
});

export const ArtifactRecordSchema = z
  .object({
    schema_version: SemVerSchema,
    id: z.string().uuid(),
    run_id: z.string().uuid(),
    scope_id: z.string().min(1),
    type: z.string().min(1),
    title: z.string().nullable().optional(),
    version: z.number().int().min(1),
    status: z.enum(['draft', 'final', 'superseded']),
    supersedes: z.string().uuid().nullable().optional(),
    derived_from_steps: z.array(z.string().uuid()),
    content: z.object({
      format: z.enum(['json', 'markdown', 'html', 'text']),
      body: z.union([z.string(), z.record(z.any()), z.array(z.any()), z.null()])
    }),
    evidence: z.array(EvidenceSchema),
    assumptions: z.array(AssumptionSchema),
    created_at: IsoDateTimeSchema
  })
  .superRefine((value, ctx) => {
    if (value.status === 'superseded' && !value.supersedes) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'superseded artifacts must include supersedes'
      });
    }
  });

export type AgentProfile = z.infer<typeof AgentProfileSchema>;
export type WorkflowTemplate = z.infer<typeof WorkflowTemplateSchema>;
export type StepRecord = z.infer<typeof StepRecordSchema>;
export type ArtifactRecord = z.infer<typeof ArtifactRecordSchema>;
export type OutputEnvelope = z.infer<typeof OutputEnvelopeSchema>;
