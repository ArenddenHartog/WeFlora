import type { FloraGPTMode, FloraGPTResponseEnvelope } from '../../../types';

export type ValidationResult = {
  ok: boolean;
  errors?: string[];
};

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

const validateCommon = (
  payload: FloraGPTResponseEnvelope,
  mode: FloraGPTMode,
  schemaVersion: 'v0.1' | 'v0.2'
): string[] => {
  const errors: string[] = [];
  if (payload.schemaVersion !== schemaVersion) errors.push(`schemaVersion must be ${schemaVersion}`);
  if (!payload.meta?.schema_version) {
    errors.push('meta.schema_version is required');
  } else if (payload.meta.schema_version !== schemaVersion) {
    errors.push(`meta.schema_version must be ${schemaVersion}`);
  }
  if (payload.mode !== mode) errors.push('mode mismatch');
  if (!['answer', 'clarifying_questions', 'error'].includes(payload.responseType)) {
    errors.push('invalid responseType');
  }
  if (!payload.data || typeof payload.data !== 'object') errors.push('data must be an object');
  return errors;
};

export const validateFloraGPTPayload = (mode: FloraGPTMode, payload: unknown): ValidationResult => {
  if (!payload || typeof payload !== 'object') {
    return { ok: false, errors: ['payload must be an object'] };
  }

  const envelope = payload as FloraGPTResponseEnvelope;
  const schemaVersion = envelope.schemaVersion === 'v0.2' && mode === 'general_research' ? 'v0.2' : 'v0.1';
  const errors = validateCommon(envelope, mode, schemaVersion);

  if (envelope.responseType === 'clarifying_questions') {
    if (!isStringArray(envelope.data?.questions) || envelope.data.questions.length === 0) {
      errors.push('clarifying_questions requires data.questions (1-3 items)');
    }
  }

  if (envelope.responseType === 'answer') {
    if (mode === 'general_research') {
      if (typeof envelope.data?.summary !== 'string') errors.push('summary is required');
      if (schemaVersion === 'v0.2') {
        const reasoning = envelope.data?.reasoning_summary;
        if (!Array.isArray(reasoning?.approach) || reasoning.approach.length === 0) {
          errors.push('reasoning_summary.approach is required');
        }
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
