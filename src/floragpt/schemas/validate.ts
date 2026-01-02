import type { FloraGPTMode, FloraGPTResponseEnvelope } from '../../../types';

export type ValidationResult = {
  ok: boolean;
  errors?: string[];
};

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

const expectedSchemaVersion = (mode: FloraGPTMode) =>
  mode === 'general_research' ? 'v0.2' : 'v0.1';

const validateCommon = (payload: FloraGPTResponseEnvelope, mode: FloraGPTMode): string[] => {
  const errors: string[] = [];
  const expected = expectedSchemaVersion(mode);
  if (payload.schemaVersion !== expected) errors.push(`schemaVersion must be ${expected}`);
  if (!payload.meta?.schema_version) {
    errors.push('meta.schema_version is required');
  } else if (payload.meta.schema_version !== expected) {
    errors.push(`meta.schema_version must be ${expected}`);
  }
  if (payload.mode !== mode) errors.push('mode mismatch');
  if (!['answer', 'clarifying_questions', 'error'].includes(payload.responseType)) {
    errors.push('invalid responseType');
  }
  if (!payload.data || typeof payload.data !== 'object') errors.push('data must be an object');
  if (mode === 'general_research' && !Array.isArray(payload.meta?.sources_used)) {
    errors.push('meta.sources_used is required for general_research');
  }
  return errors;
};

export const validateFloraGPTPayload = (mode: FloraGPTMode, payload: unknown): ValidationResult => {
  if (!payload || typeof payload !== 'object') {
    return { ok: false, errors: ['payload must be an object'] };
  }

  const envelope = payload as FloraGPTResponseEnvelope;
  const errors = validateCommon(envelope, mode);

  if (envelope.responseType === 'clarifying_questions') {
    if (!isStringArray(envelope.data?.questions) || envelope.data.questions.length === 0) {
      errors.push('clarifying_questions requires data.questions (1-3 items)');
    }
  }

  if (envelope.responseType === 'answer') {
    if (mode === 'general_research') {
      if (typeof envelope.data?.summary !== 'string') errors.push('summary is required');
      if (typeof envelope.data?.output_label !== 'string') errors.push('output_label is required');
      const reasoning = envelope.data?.reasoning_summary;
      if (!reasoning || typeof reasoning !== 'object') {
        errors.push('reasoning_summary is required');
      } else {
        if (!isStringArray(reasoning.approach) || reasoning.approach.length === 0 || reasoning.approach.length > 3) {
          errors.push('reasoning_summary.approach must be 1-3 items');
        }
        if (!isStringArray(reasoning.assumptions)) errors.push('reasoning_summary.assumptions must be string[]');
        if (!isStringArray(reasoning.risks)) errors.push('reasoning_summary.risks must be string[]');
      }
      if (!isStringArray(envelope.data?.follow_ups) || envelope.data.follow_ups.length < 3 || envelope.data.follow_ups.length > 3) {
        errors.push('follow_ups must contain exactly 3 items');
      }
    }
    if (mode === 'suitability_scoring') {
      const results = envelope.data?.results;
      if (!Array.isArray(results) || results.length === 0) {
        errors.push('results array is required');
      }
    }
    if (mode === 'spec_writer') {
      if (typeof envelope.data?.specTitle !== 'string') errors.push('specTitle is required');
      if (!Array.isArray(envelope.data?.specFields) || envelope.data.specFields.length === 0) {
        errors.push('specFields array is required');
      }
    }
    if (mode === 'policy_compliance') {
      if (typeof envelope.data?.status !== 'string') errors.push('status is required');
    }
  }

  return { ok: errors.length === 0, errors: errors.length ? errors : undefined };
};
