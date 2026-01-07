import type { ActionCard, ActionCardInput, ActionCardSuggestedAction, PointerPatch } from '../../types';

export type InputEl = HTMLInputElement | HTMLSelectElement;

export const normalizeNumberInputValue = (rawValue: string): number | undefined =>
  rawValue === '' ? undefined : Number(rawValue);

export const buildPatchesForInputs = (inputs: ActionCardInput[], formValues: Record<string, unknown>): PointerPatch[] =>
  inputs
    .map((input) => ({
      pointer: input.pointer,
      value: formValues[input.id]
    }))
    .filter((patch) => {
      if (patch.value === undefined) return false;
      if (typeof patch.value === 'string' && patch.value.trim() === '') return false;
      return true;
    });

export const shouldDisableRefine = (inputs: ActionCardInput[], formValues: Record<string, unknown>) =>
  inputs.some((input) => {
    const isRequired = input.severity === 'required' || input.required;
    return isRequired && (formValues[input.id] === undefined || formValues[input.id] === '');
  });

export const buildSuggestedActionSubmitArgs = (card: ActionCard, action: ActionCardSuggestedAction) => ({
  cardId: card.id,
  cardType: card.type,
  input: { action: action.action }
});
