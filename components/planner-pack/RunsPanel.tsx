import React from 'react';

interface RunsPanelProps {
  inventoryStatus: 'idle' | 'running' | 'failed' | 'succeeded';
  composeStatus: 'idle' | 'running' | 'failed' | 'succeeded';
  inventoryError?: string | null;
  composeError?: string | null;
  logs: string[];
  onRunInventory: () => void;
  onCompose: () => void;
}

const RunsPanel: React.FC<RunsPanelProps> = ({
  inventoryStatus,
  composeStatus,
  inventoryError,
  composeError,
  logs,
  onRunInventory,
  onCompose
}) => {
  return (
    <section className="space-y-4">
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
            onClick={onRunInventory}
            disabled={inventoryStatus === 'running'}
            className="w-full px-3 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold disabled:opacity-60"
          >
            {inventoryStatus === 'running' ? 'Running Inventory Ingest…' : 'Run Inventory Ingest'}
          </button>
          {inventoryError && (
            <div className="text-xs text-red-600">
              {inventoryError}
              <div className="text-[10px] text-slate-500">Retry by running the ingest again.</div>
            </div>
          )}
        </div>
        <div className="space-y-2">
          <button
            onClick={onCompose}
            disabled={composeStatus === 'running'}
            className="w-full px-3 py-2 bg-weflora-teal text-white rounded-lg text-xs font-semibold disabled:opacity-60"
          >
            {composeStatus === 'running' ? 'Generating Planner Pack…' : 'Generate Planner Pack'}
          </button>
          {composeError && (
            <div className="text-xs text-red-600">
              {composeError}
              <div className="text-[10px] text-slate-500">Retry by generating the Planner Pack again.</div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default RunsPanel;
