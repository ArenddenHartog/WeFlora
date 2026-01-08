import type { ActionCardInput } from '../../types';

export type ValidationGroup = 'site' | 'regulatory' | 'equity' | 'species' | 'supply' | 'other';

const groupOrder: ValidationGroup[] = ['site', 'regulatory', 'equity', 'species', 'supply', 'other'];

const groupLabels: Record<ValidationGroup, string> = {
  site: 'Site',
  regulatory: 'Regulatory',
  equity: 'Equity',
  species: 'Species',
  supply: 'Supply',
  other: 'Other'
};

export const getValidationGroup = (pointer: string): ValidationGroup => {
  if (pointer.includes('/context/site/')) return 'site';
  if (pointer.includes('/context/regulatory/')) return 'regulatory';
  if (pointer.includes('/context/equity/')) return 'equity';
  if (pointer.includes('/context/species/')) return 'species';
  if (pointer.includes('/context/supply/')) return 'supply';
  return 'other';
};

export const getValidationGroupLabel = (group: ValidationGroup): string => groupLabels[group];

export const groupInputsByCategory = (inputs: ActionCardInput[]) =>
  groupOrder
    .map((group) => ({
      group,
      label: groupLabels[group],
      inputs: inputs.filter((input) => getValidationGroup(input.pointer) === group)
    }))
    .filter((entry) => entry.inputs.length > 0);

export const splitInputsBySeverity = (inputs: ActionCardInput[]) => {
  const required = inputs.filter((input) => input.severity === 'required' || input.required);
  const recommended = inputs.filter((input) => input.severity === 'recommended');
  const optional = inputs.filter((input) => input.severity === 'optional');
  return { required, recommended, optional };
};

const isMissingValue = (value: unknown) =>
  value === undefined || value === null || (typeof value === 'string' && value.trim() === '');

export const hasMissingRequiredInputs = (inputs: ActionCardInput[], values: Record<string, unknown>) =>
  inputs.some((input) => (input.severity === 'required' || input.required) && isMissingValue(values[input.id]));

export const hasMissingRecommendedInputs = (inputs: ActionCardInput[], values: Record<string, unknown>) =>
  inputs.some((input) => input.severity === 'recommended' && isMissingValue(values[input.id]));

export const hasMissingOptionalInputs = (inputs: ActionCardInput[], values: Record<string, unknown>) =>
  inputs.some((input) => input.severity === 'optional' && isMissingValue(values[input.id]));
