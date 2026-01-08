import React from 'react';
import BaseModal from '../../../../components/BaseModal';
import type { ActionCardInput } from '../../types';
import {
  groupInputsByCategory,
  hasMissingOptionalInputs,
  hasMissingRecommendedInputs,
  hasMissingRequiredInputs
} from './validationUtils';

export interface ValidationDrawerProps {
  isOpen: boolean;
  title?: string;
  requiredInputs: ActionCardInput[];
  recommendedInputs: ActionCardInput[];
  optionalInputs?: ActionCardInput[];
  values: Record<string, string | number | boolean>;
  onChange: (inputId: string, value: string | number | boolean) => void;
  onSave: () => void;
  onSaveAndContinue: () => void;
  onClose: () => void;
  canProceedWithMissingRecommended: boolean;
  onApplyDefaults?: () => void;
}

const ValidationDrawer: React.FC<ValidationDrawerProps> = ({
  isOpen,
  title = 'Resolve inputs',
  requiredInputs,
  recommendedInputs,
  optionalInputs,
  values,
  onChange,
  onSave,
  onSaveAndContinue,
  onClose,
  canProceedWithMissingRecommended,
  onApplyDefaults
}) => {
  const missingRequired = hasMissingRequiredInputs(requiredInputs, values);
  const missingRecommended = hasMissingRecommendedInputs(recommendedInputs, values);
  const missingOptional = optionalInputs ? hasMissingOptionalInputs(optionalInputs, values) : false;
  const disableContinue = missingRequired || (!canProceedWithMissingRecommended && missingRecommended);

  const renderInputField = (input: ActionCardInput) => (
    <label key={input.id} className="block text-xs text-slate-600 space-y-1">
      <span className="font-semibold">{input.label}</span>
      {input.type === 'select' ? (
        <select
          value={(values[input.id] as string | undefined) ?? ''}
          onChange={(event) => onChange(input.id, event.target.value)}
          className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs"
        >
          <option value="" disabled>
            {input.placeholder ?? 'Select option'}
          </option>
          {input.options?.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : input.type === 'number' ? (
        <input
          type="number"
          value={(values[input.id] as number | string | undefined) ?? ''}
          onChange={(event) => onChange(input.id, event.target.value === '' ? '' : Number(event.target.value))}
          placeholder={input.placeholder}
          className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs"
        />
      ) : input.type === 'boolean' ? (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={Boolean(values[input.id])}
            onChange={(event) => onChange(input.id, event.target.checked)}
            className="rounded border-slate-300 text-weflora-teal"
          />
          <span className="text-xs text-slate-500">{input.placeholder ?? 'Toggle'}</span>
        </div>
      ) : (
        <input
          type="text"
          value={(values[input.id] as string | undefined) ?? ''}
          onChange={(event) => onChange(input.id, event.target.value)}
          placeholder={input.placeholder}
          className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs"
        />
      )}
      {input.helpText && <p className="text-[10px] text-slate-400">{input.helpText}</p>}
      {input.impactNote && input.impactNote !== input.helpText && (
        <p className="text-[10px] text-slate-500">{input.impactNote}</p>
      )}
    </label>
  );

  const renderGroupedInputs = (inputs: ActionCardInput[]) =>
    groupInputsByCategory(inputs).map(({ group, label, inputs: grouped }) => (
      <div key={group} className="space-y-3">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
        {grouped.map(renderInputField)}
      </div>
    ));

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      subtitle="Update inputs at any time to refine the planning run."
      size="lg"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          {onApplyDefaults && (
            <button
              type="button"
              onClick={onApplyDefaults}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
            >
              Apply safe defaults
            </button>
          )}
          <button
            type="button"
            onClick={onSave}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            Save
          </button>
          <button
            type="button"
            onClick={onSaveAndContinue}
            disabled={disableContinue}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg ${
              disableContinue
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-weflora-teal text-white hover:bg-weflora-dark'
            }`}
          >
            Save & Continue
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {(missingRecommended || missingOptional) && (
          <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
            Continuing with partial inputs may reduce specificity.
          </div>
        )}

        {requiredInputs.length > 0 && (
          <div className="space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Required</p>
            {renderGroupedInputs(requiredInputs)}
          </div>
        )}

        {recommendedInputs.length > 0 && (
          <div className="space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Recommended</p>
            {renderGroupedInputs(recommendedInputs)}
          </div>
        )}

        {optionalInputs && optionalInputs.length > 0 && (
          <div className="space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Optional</p>
            {renderGroupedInputs(optionalInputs)}
          </div>
        )}
      </div>
    </BaseModal>
  );
};

export default ValidationDrawer;
