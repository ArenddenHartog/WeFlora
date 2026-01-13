import { z } from 'zod';

/**
 * PCIV v1 schema pack.
 * Invariants:
 * - value_kind dictates which value_* field is populated (unless provenance is unknown).
 * - provenance === 'unknown' implies all value_* fields are nullish.
 * - provenance === 'source-backed' requires at least one source reference.
 */

export const PcivDomainV1Schema = z.enum(['site', 'regulatory', 'equity', 'biophysical']);
export const PcivProvenanceV1Schema = z.enum(['source-backed', 'model-inferred', 'user-entered', 'unknown']);
export const PcivUpdatedByV1Schema = z.enum(['user', 'model', 'system']);
export const PcivFieldTypeV1Schema = z.enum(['text', 'select', 'boolean']);
export const PcivValueKindV1Schema = z.enum(['string', 'number', 'boolean', 'enum', 'json']);

export const PcivRunStatusV1Schema = z.enum(['draft', 'committed', 'partial_committed']);
export const PcivSourceKindV1Schema = z.enum(['file', 'url', 'gis', 'api', 'manual']);
export const PcivSourceParseStatusV1Schema = z.enum(['pending', 'parsed', 'failed', 'unsupported']);

const nullish = (value: unknown) => value === null || value === undefined;

const valueFieldKeys = ['valueString', 'valueNumber', 'valueBoolean', 'valueEnum', 'valueJson'] as const;

type ValueFieldKey = (typeof valueFieldKeys)[number];

const valueKindFieldMap: Record<z.infer<typeof PcivValueKindV1Schema>, ValueFieldKey> = {
  string: 'valueString',
  number: 'valueNumber',
  boolean: 'valueBoolean',
  enum: 'valueEnum',
  json: 'valueJson'
};

const enforceValueKind = (
  ctx: z.RefinementCtx,
  valueKind: z.infer<typeof PcivValueKindV1Schema>,
  values: Record<ValueFieldKey, unknown>
) => {
  const requiredKey = valueKindFieldMap[valueKind];
  const requiredValue = values[requiredKey];
  if (nullish(requiredValue)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [requiredKey],
      message: `value_kind '${valueKind}' requires ${requiredKey}.`
    });
  }
  valueFieldKeys.forEach((key) => {
    if (key === requiredKey) return;
    if (!nullish(values[key])) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message: `value_kind '${valueKind}' forbids ${key}.`
      });
    }
  });
};

const enforceUnknownValues = (ctx: z.RefinementCtx, values: Record<ValueFieldKey, unknown>) => {
  valueFieldKeys.forEach((key) => {
    if (!nullish(values[key])) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message: 'provenance "unknown" forbids value fields.'
      });
    }
  });
};

const PcivValueFieldsV1Schema = z
  .object({
    valueKind: PcivValueKindV1Schema,
    valueString: z.string().nullable().optional(),
    valueNumber: z.number().nullable().optional(),
    valueBoolean: z.boolean().nullable().optional(),
    valueEnum: z.string().nullable().optional(),
    valueJson: z.unknown().nullable().optional()
  })
  .strict();

export const PcivRunV1Schema = z
  .object({
    id: z.string().uuid(),
    scopeId: z.string().min(1),
    userId: z.string().uuid().nullable().optional(),
    status: PcivRunStatusV1Schema,
    allowPartial: z.boolean(),
    committedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime()
  })
  .strict();

export const PcivSourceV1Schema = z
  .object({
    id: z.string().uuid(),
    runId: z.string().uuid(),
    kind: PcivSourceKindV1Schema,
    title: z.string().min(1),
    uri: z.string().min(1),
    fileId: z.string().uuid().nullable().optional(),
    mimeType: z.string().nullable().optional(),
    sizeBytes: z.number().int().nonnegative().nullable().optional(),
    parseStatus: PcivSourceParseStatusV1Schema,
    excerpt: z.string().nullable().optional(),
    rawMeta: z.record(z.string(), z.unknown()).optional().default({}),
    createdAt: z.string().datetime()
  })
  .strict();

export const PcivInputV1Schema = PcivValueFieldsV1Schema.extend({
  id: z.string().uuid(),
  runId: z.string().uuid(),
  pointer: z.string().min(1),
  label: z.string().min(1),
  domain: PcivDomainV1Schema,
  required: z.boolean(),
  fieldType: PcivFieldTypeV1Schema,
  options: z.array(z.string()).nullable().optional(),
  provenance: PcivProvenanceV1Schema,
  updatedBy: PcivUpdatedByV1Schema,
  updatedAt: z.string().datetime(),
  evidenceSnippet: z.string().nullable().optional(),
  sourceIds: z.array(z.string().uuid()).optional()
})
  .strict()
  .superRefine((data, ctx) => {
    const values = {
      valueString: data.valueString,
      valueNumber: data.valueNumber,
      valueBoolean: data.valueBoolean,
      valueEnum: data.valueEnum,
      valueJson: data.valueJson
    };

    if (data.provenance === 'unknown') {
      enforceUnknownValues(ctx, values);
    } else {
      enforceValueKind(ctx, data.valueKind, values);
    }

    if (data.provenance === 'source-backed') {
      if (!data.sourceIds || data.sourceIds.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['sourceIds'],
          message: 'provenance "source-backed" requires at least one source reference.'
        });
      }
    }
  });

export const PcivInputSourceV1Schema = z
  .object({
    inputId: z.string().uuid(),
    sourceId: z.string().uuid()
  })
  .strict();

export const PcivConstraintV1Schema = PcivValueFieldsV1Schema.extend({
  id: z.string().uuid(),
  runId: z.string().uuid(),
  key: z.string().min(1),
  domain: PcivDomainV1Schema,
  label: z.string().min(1),
  provenance: PcivProvenanceV1Schema,
  sourceId: z.string().uuid().nullable().optional(),
  snippet: z.string().nullable().optional(),
  createdAt: z.string().datetime()
})
  .strict()
  .superRefine((data, ctx) => {
    const values = {
      valueString: data.valueString,
      valueNumber: data.valueNumber,
      valueBoolean: data.valueBoolean,
      valueEnum: data.valueEnum,
      valueJson: data.valueJson
    };

    if (data.provenance === 'unknown') {
      enforceUnknownValues(ctx, values);
    } else {
      enforceValueKind(ctx, data.valueKind, values);
    }

    if (data.provenance === 'source-backed' && !data.sourceId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sourceId'],
        message: 'provenance "source-backed" requires sourceId.'
      });
    }
  });

export const PcivArtifactV1Schema = z
  .object({
    id: z.string().uuid(),
    runId: z.string().uuid(),
    type: z.string().min(1),
    title: z.string().min(1),
    payload: z.record(z.string(), z.unknown()).optional().default({}),
    createdAt: z.string().datetime()
  })
  .strict();

export const PcivContextViewV1Schema = z
  .object({
    run: PcivRunV1Schema,
    sourcesById: z.record(z.string(), PcivSourceV1Schema),
    inputsByPointer: z.record(z.string(), PcivInputV1Schema),
    constraints: z.array(PcivConstraintV1Schema),
    artifactsByType: z.record(z.string(), z.array(PcivArtifactV1Schema))
  })
  .strict();

export type PcivRunV1 = z.infer<typeof PcivRunV1Schema>;
export type PcivSourceV1 = z.infer<typeof PcivSourceV1Schema>;
export type PcivInputV1 = z.infer<typeof PcivInputV1Schema>;
export type PcivInputSourceV1 = z.infer<typeof PcivInputSourceV1Schema>;
export type PcivConstraintV1 = z.infer<typeof PcivConstraintV1Schema>;
export type PcivArtifactV1 = z.infer<typeof PcivArtifactV1Schema>;
export type PcivContextViewV1 = z.infer<typeof PcivContextViewV1Schema>;
