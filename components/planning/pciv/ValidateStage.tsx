import React, { useState } from 'react';
import type { PcivDraft, PcivMetrics } from '../../../src/decision-program/pciv/v0/types';

export interface ValidateStageProps {
  draft: PcivDraft;
  metrics: PcivMetrics;
  onCommit: (allowPartial: boolean) => void;
}

const ValidateStage: React.FC<ValidateStageProps> = ({ draft, metrics, onCommit }) => {
  const [confirmPartial, setConfirmPartial] = useState(false);

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-slate-800">Validate &amp; commit</h2>
        <p className="text-xs text-slate-500">
          Review the measurable outputs before committing context for planning.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-2">
          <h3 className="text-sm font-semibold text-slate-700">Summary</h3>
          <div className="space-y-1 text-xs text-slate-600">
            <p>Sources found: <span className="font-semibold">{metrics.sources_count}</span></p>
            <p>Sources ready: <span className="font-semibold">{metrics.sources_ready_count}</span></p>
            <p>Fields filled: <span className="font-semibold">{metrics.fields_filled_count}/{metrics.fields_total}</span></p>
            <p>Unresolved required: <span className="font-semibold">{metrics.required_unresolved_count}</span></p>
            <p>Constraints created: <span className="font-semibold">{metrics.constraints_count}</span></p>
            <p>Confidence overall: <span className="font-semibold">{metrics.confidence_overall}%</span></p>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-2">
          <h3 className="text-sm font-semibold text-slate-700">Status checks</h3>
          {metrics.sources_count === 0 && !draft.locationHint ? (
            <p className="text-xs text-amber-700">Awaiting documents or location hint.</p>
          ) : null}
          {metrics.required_unresolved_count > 0 ? (
            <p className="text-xs text-rose-600">
              {metrics.required_unresolved_count} required inputs remain unresolved.
            </p>
          ) : (
            <p className="text-xs text-emerald-600">All required inputs resolved.</p>
          )}
          {metrics.constraints_count === 0 ? (
            <p className="text-xs text-slate-500">No derived constraints yet — add sources or provide inputs.</p>
          ) : (
            <p className="text-xs text-slate-500">Constraints will be committed with provenance.</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          disabled={metrics.required_unresolved_count > 0}
          onClick={() => onCommit(false)}
          className="w-full md:w-auto px-5 py-2.5 rounded-xl bg-weflora-teal text-white text-sm font-semibold hover:bg-weflora-dark disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Commit &amp; Run
        </button>
        <label className="flex items-center gap-2 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={confirmPartial}
            onChange={(event) => setConfirmPartial(event.target.checked)}
            className="rounded border-slate-300"
          />
          I understand planning may be less specific without full context.
        </label>
        <button
          type="button"
          onClick={() => onCommit(true)}
          disabled={!confirmPartial}
          className="w-full md:w-auto px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Proceed with partial context
        </button>
      </div>
    </section>
  );
};

export default ValidateStage;
