import React, { useEffect, useMemo, useState } from 'react';
import type { PcivCommittedContext, PcivContextIntakeRun, PcivDraft, PcivMetrics, PcivStage } from '../../../src/decision-program/pciv/v0/types';
import {
  applyPcivAutoMapping,
  ensureDefaultInferences,
  setPcivFieldValue,
  updateLocationHintField
} from '../../../src/decision-program/pciv/v0/map';
import { commitPcivDraft, loadPcivRun, updatePcivDraft } from '../../../src/decision-program/pciv/v0/store';
import ImportStage from './ImportStage';
import MapStage from './MapStage';
import ValidateStage from './ValidateStage';

export interface PCIVFlowProps {
  projectId: string;
  userId?: string | null;
  onComplete: (commit: PcivCommittedContext) => void;
  onCancel?: () => void;
}

const STAGES: Array<{ id: PcivStage; label: string }> = [
  { id: 'import', label: 'Import' },
  { id: 'map', label: 'Map' },
  { id: 'validate', label: 'Validate & Commit' }
];

const PCIVFlow: React.FC<PCIVFlowProps> = ({ projectId, userId, onComplete, onCancel }) => {
  const [stage, setStage] = useState<PcivStage>('import');
  const [run, setRun] = useState<PcivContextIntakeRun | null>(null);

  useEffect(() => {
    const loaded = loadPcivRun(projectId, userId ?? null);
    setRun(loaded);
  }, [projectId, userId]);

  const draft = run?.draft;
  const metrics = run?.metrics;

  const updateDraft = (updater: PcivDraft | ((draft: PcivDraft) => PcivDraft)) => {
    setRun((prev) => {
      if (!prev) return prev;
      const nextDraft = typeof updater === 'function' ? updater(prev.draft) : updater;
      return updatePcivDraft(prev, nextDraft);
    });
  };

  const handleLocationHintChange = (value: string) => {
    if (!draft || !run) return;
    const updated = ensureDefaultInferences(updateLocationHintField(draft, value));
    updateDraft(updated);
  };

  const handleUpdateField = (pointer: string, value: PcivDraft['fields'][string]['value']) => {
    if (!draft) return;
    const updated = setPcivFieldValue(draft, pointer, value);
    updateDraft(updated);
  };

  const handleNext = () => {
    if (!draft) return;
    if (stage === 'import') {
      const updated = ensureDefaultInferences(applyPcivAutoMapping(draft));
      updateDraft(updated);
      setStage('map');
      return;
    }
    if (stage === 'map') {
      setStage('validate');
    }
  };

  const handleCommit = (allowPartial: boolean) => {
    if (!run) return;
    const result = commitPcivDraft(run, allowPartial);
    setRun(result.run);
    onComplete(result.commit);
  };

  const headerMetrics = useMemo(() => metrics ?? ({
    sources_count: 0,
    sources_ready_count: 0,
    fields_total: 0,
    fields_filled_count: 0,
    required_unresolved_count: 0,
    constraints_count: 0,
    confidence_overall: 0
  } satisfies PcivMetrics), [metrics]);

  const stageLabel = STAGES.find((entry) => entry.id === stage)?.label ?? 'Import';

  if (!draft || !run) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-slate-500 bg-slate-50">
        Loading context intake...
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-slate-50">
      <div className="border-b border-slate-200 bg-white px-6 py-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide">Context intake</p>
            <h1 className="text-lg font-semibold text-slate-800">PCIV v0 · Context Intake</h1>
          </div>
          <div className="flex items-center gap-2">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                Back to planning
              </button>
            )}
            {stage !== 'validate' && (
              <button
                type="button"
                onClick={handleNext}
                className="text-xs font-semibold px-4 py-2 rounded-lg bg-weflora-teal text-white hover:bg-weflora-dark"
              >
                Next
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            {STAGES.map((entry) => (
              <span
                key={entry.id}
                className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${
                  entry.id === stage
                    ? 'bg-weflora-mint/40 border-weflora-teal text-weflora-dark'
                    : 'border-slate-200 text-slate-400'
                }`}
              >
                {entry.label}
              </span>
            ))}
          </div>
          <span className="text-slate-400">•</span>
          <span className="font-semibold text-slate-600">Stage: {stageLabel}</span>
          <span className="text-slate-400">•</span>
          <span>Sources: {headerMetrics.sources_count}</span>
          <span>Fields: {headerMetrics.fields_filled_count}/{headerMetrics.fields_total}</span>
          <span>Unresolved required: {headerMetrics.required_unresolved_count}</span>
          <span>Constraints: {headerMetrics.constraints_count}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-5xl mx-auto space-y-8">
          {stage === 'import' && (
            <ImportStage
              draft={draft}
              metrics={headerMetrics}
              onUpdateDraft={updateDraft}
              onLocationHintChange={handleLocationHintChange}
            />
          )}
          {stage === 'map' && (
            <MapStage
              draft={draft}
              onUpdateField={handleUpdateField}
            />
          )}
          {stage === 'validate' && (
            <ValidateStage
              draft={draft}
              metrics={headerMetrics}
              onCommit={handleCommit}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default PCIVFlow;
