import React from 'react';

interface PreflightItem {
  label: string;
  status: 'ok' | 'warn';
  detail?: string;
}

interface RunsPanelProps {
  inventoryStatus: 'idle' | 'running' | 'failed' | 'succeeded';
  composeStatus: 'idle' | 'running' | 'failed' | 'succeeded';
  inventoryError?: string | null;
  composeError?: string | null;
  logs: string[];
  preflightItems: PreflightItem[];
  primaryLabel: string;
  secondaryLabel: string;
  onPrimaryAction: () => void;
  onSecondaryAction: () => void;
}

const RunsPanel: React.FC<RunsPanelProps> = ({
  inventoryStatus,
  composeStatus,
  inventoryError,
  composeError,
  logs,
  preflightItems,
  primaryLabel,
  secondaryLabel,
  onPrimaryAction,
  onSecondaryAction
}) => {
  return (
    <section className="space-y-4">
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-800">Preflight checklist</h3>
        <div className="space-y-2 text-xs">
          {preflightItems.map((item) => (
            <div key={item.label} className="flex items-start justify-between gap-2 border border-slate-200 rounded-lg p-2 bg-white">
              <div>
                <div className="font-semibold text-slate-700">{item.label}</div>
                {item.detail && <div className="text-[11px] text-slate-500">{item.detail}</div>}
              </div>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full border ${
                  item.status === 'ok'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}
              >
                {item.status === 'ok' ? 'Ready' : 'Review'}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-800">WeFlora Log</h3>
        <div className="space-y-2 text-xs text-slate-600">
          {logs.length === 0 ? (
            <div className="text-slate-400">No runs yet. WeFlora will log actions here.</div>
          ) : (
            logs.map((entry, index) => (
              <div key={`${entry}-${index}`} className="border border-slate-200 rounded-lg p-2">
                {entry}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div className="space-y-2">
          <button
            onClick={onPrimaryAction}
            disabled={composeStatus === 'running'}
            className="w-full px-3 py-2 bg-weflora-teal text-white rounded-lg text-xs font-semibold disabled:opacity-60"
          >
            {composeStatus === 'running' ? 'Working…' : primaryLabel}
          </button>
          {composeError && (
            <div className="text-xs text-red-600">
              {composeError}
              <div className="text-[10px] text-slate-500">Retry the primary action once ready.</div>
            </div>
          )}
        </div>
        <div className="space-y-2">
          <button
            onClick={onSecondaryAction}
            disabled={inventoryStatus === 'running'}
            className="w-full px-3 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold disabled:opacity-60"
          >
            {inventoryStatus === 'running' ? 'Running Inventory Ingest…' : secondaryLabel}
          </button>
          {inventoryError && (
            <div className="text-xs text-red-600">
              {inventoryError}
              <div className="text-[10px] text-slate-500">Retry by running the ingest again.</div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default RunsPanel;
