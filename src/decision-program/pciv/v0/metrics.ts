import type { PcivDraft, PcivMetrics } from './types';

const isFilledValue = (value: PcivDraft['fields'][string]['value']) =>
  value !== undefined && value !== null && value !== '';

export const computePcivMetrics = (draft: PcivDraft): PcivMetrics => {
  const fields = Object.values(draft.fields);
  const fieldsTotal = fields.length;
  const fieldsFilled = fields.filter((field) => isFilledValue(field.value));
  const requiredUnresolved = fields.filter(
    (field) => field.required && !isFilledValue(field.value)
  );
  const sourceBackedFilled = fieldsFilled.filter((field) => field.provenance === 'source-backed');
  const confidenceOverall =
    fieldsFilled.length === 0 ? 0 : Math.round((sourceBackedFilled.length / fieldsFilled.length) * 100);

  return {
    sources_count: draft.sources.length,
    sources_ready_count: draft.sources.filter((source) => source.status === 'parsed').length,
    fields_total: fieldsTotal,
    fields_filled_count: fieldsFilled.length,
    required_unresolved_count: requiredUnresolved.length,
    constraints_count: draft.constraints.length,
    confidence_overall: confidenceOverall
  };
};
