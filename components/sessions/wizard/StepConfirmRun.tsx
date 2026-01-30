import React from 'react';

interface StepConfirmRunProps {
  selectedSkills: Array<{ id: string; title: string }>;
  runMode: 'sequence' | 'parallel';
  allowPartial: boolean;
  assumptions: string[];
  onRunModeChange: (mode: 'sequence' | 'parallel') => void;
  onAllowPartialChange: (value: boolean) => void;
  onRun: () => void;
}

const StepConfirmRun: React.FC<StepConfirmRunProps> = ({
  selectedSkills,
  runMode,
  allowPartial,
  assumptions,
  onRunModeChange,
  onAllowPartialChange,
  onRun
}) => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Confirm & run</h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">Review your selections before running.</p>
      </div>

      <div className="border-t border-slate-200 pt-6">
        <h3 className="text-base font-semibold text-slate-900">Selected skills</h3>
        {selectedSkills.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No skills selected.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            {selectedSkills.map((skill) => (
              <li key={skill.id}>{skill.title}</li>
            ))}
          </ul>
        )}
      </div>

      {selectedSkills.length >= 2 ? (
        <div className="border-t border-slate-200 pt-6 space-y-3">
          <h3 className="text-base font-semibold text-slate-900">Run mode</h3>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="radio"
              name="run-mode"
              checked={runMode === 'sequence'}
              onChange={() => onRunModeChange('sequence')}
              className="h-4 w-4 text-weflora-teal"
            />
            Sequence (default)
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="radio"
              name="run-mode"
              checked={runMode === 'parallel'}
              onChange={() => onRunModeChange('parallel')}
              className="h-4 w-4 text-weflora-teal"
            />
            Parallel
          </label>
        </div>
      ) : null}

      <div className="border-t border-slate-200 pt-6">
        <h3 className="text-base font-semibold text-slate-900">Assumptions that will be made</h3>
        {assumptions.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No assumptions detected.</p>
        ) : (
          <ul className="mt-3 list-disc pl-5 text-sm text-slate-700">
            {assumptions.map((assumption) => (
              <li key={assumption}>{assumption}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-slate-200 pt-6">
        <label className="inline-flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={allowPartial}
            onChange={(event) => onAllowPartialChange(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-weflora-teal focus:ring-weflora-teal"
          />
          Allow partial runs (steps may emit insufficient_data)
        </label>
      </div>

      <div className="border-t border-slate-200 pt-6">
        <button
          type="button"
          onClick={onRun}
          className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
        >
          Run session
        </button>
      </div>
    </div>
  );
};

export default StepConfirmRun;
