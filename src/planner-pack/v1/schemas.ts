import { z } from 'zod';

export const PlannerInterventionTypeSchema = z.enum(['street', 'park', 'corridor', 'district', 'other']);
export const PlannerInterventionStatusSchema = z.enum(['draft', 'evidence_ready', 'submission_ready', 'submitted']);

const GeoJsonFeatureSchema = z
  .object({
    type: z.literal('Feature'),
    geometry: z.object({ type: z.string() }).passthrough()
  })
  .passthrough();

const GeoJsonFeatureCollectionSchema = z
  .object({
    type: z.literal('FeatureCollection'),
    features: z.array(z.any()).default([])
  })
  .passthrough();

export const GeoJsonSchema = z.union([GeoJsonFeatureSchema, GeoJsonFeatureCollectionSchema]);

export const PlannerGeometrySchema = z.discriminatedUnion('kind', [
  z.object({
    id: z.string().uuid().optional(),
    interventionId: z.string().uuid().optional(),
    kind: z.literal('polygon'),
    geojson: GeoJsonSchema,
    corridorWidthM: z.number().optional(),
    areaM2: z.number().nullable().optional(),
    lengthM: z.number().nullable().optional(),
    createdAt: z.string().optional()
  }),
  z.object({
    id: z.string().uuid().optional(),
    interventionId: z.string().uuid().optional(),
    kind: z.literal('corridor'),
    geojson: GeoJsonSchema,
    corridorWidthM: z.number(),
    areaM2: z.number().nullable().optional(),
    lengthM: z.number().nullable().optional(),
    createdAt: z.string().optional()
  })
]);

export const PlannerInterventionSchema = z.object({
  id: z.string().uuid(),
  scopeId: z.string(),
  createdBy: z.string().uuid().nullable().optional(),
  name: z.string().min(1),
  municipality: z.string().nullable().optional(),
  interventionType: PlannerInterventionTypeSchema,
  status: PlannerInterventionStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string()
});

export const PlannerSourceSchema = z.object({
  id: z.string().uuid(),
  interventionId: z.string().uuid(),
  kind: z.enum(['upload', 'url', 'baseline']),
  title: z.string(),
  uri: z.string().nullable().optional(),
  fileId: z.string().uuid().nullable().optional(),
  mimeType: z.string().nullable().optional(),
  parseStatus: z.enum(['pending', 'parsed', 'partial', 'failed']),
  parseReport: z.record(z.any()).default({}),
  createdAt: z.string()
});

export const PlannerRunSchema = z.object({
  id: z.string().uuid(),
  interventionId: z.string().uuid(),
  workerType: z.enum(['inventory_ingest', 'planner_pack_compose']),
  status: z.enum(['running', 'succeeded', 'failed']),
  assumptions: z.record(z.any()).default({}),
  inputsHash: z.string().nullable().optional(),
  startedAt: z.string(),
  finishedAt: z.string().nullable().optional()
});

export const PlannerArtifactSchema = z.object({
  id: z.string().uuid(),
  interventionId: z.string().uuid(),
  runId: z.string().uuid().nullable().optional(),
  type: z.enum(['memo', 'options', 'procurement', 'email_draft', 'check_report']),
  version: z.number().int().min(1),
  payload: z.record(z.any()),
  renderedHtml: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export type PlannerIntervention = z.infer<typeof PlannerInterventionSchema>;
export type PlannerGeometry = z.infer<typeof PlannerGeometrySchema>;
export type PlannerSource = z.infer<typeof PlannerSourceSchema>;
export type PlannerRun = z.infer<typeof PlannerRunSchema>;
export type PlannerArtifact = z.infer<typeof PlannerArtifactSchema>;

export type PlannerGeometryInput = Omit<PlannerGeometry, 'id' | 'interventionId' | 'createdAt'>;
