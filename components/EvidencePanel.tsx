import React from 'react';
import { XIcon, SparklesIcon, DatabaseIcon } from './icons';
import { useUI } from '../contexts/UIContext';

const EvidencePanel: React.FC = () => {
  const { activeEvidence, closeEvidencePanel } = useUI();
  if (!activeEvidence) return null;

  const sources = activeEvidence.sources || [];

  return (
    <aside className="absolute top-0 right-0 bottom-0 w-[360px] max-w-[85vw] bg-white border-l border-slate-200 shadow-xl z-40">
      <div className="h-14 px-4 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2 font-bold text-slate-800">
          <SparklesIcon className="h-5 w-5 text-weflora-teal" />
          Evidence
        </div>
        <button
          onClick={closeEvidencePanel}
          className="h-8 w-8 flex items-center justify-center cursor-pointer text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          title="Close"
        >
          <XIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="p-4 space-y-4 overflow-y-auto h-[calc(100%-56px)]">
        <div className="rounded-xl border border-weflora-teal/20 bg-weflora-teal/10 p-4">
          <div className="text-xs font-bold text-weflora-dark uppercase tracking-wider mb-2">Provenance</div>
          <div className="text-sm font-semibold text-slate-800">{activeEvidence.label}</div>
          {activeEvidence.generatedAt && (
            <div className="text-xs text-slate-500 mt-1">Generated: {activeEvidence.generatedAt}</div>
          )}
        </div>

        <div>
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
            <DatabaseIcon className="h-4 w-4 text-slate-400" />
            Sources
          </div>
          {sources.length === 0 ? (
            <div className="text-sm text-slate-500">No sources attached.</div>
          ) : (
            <ul className="space-y-2">
              {sources.map((s, idx) => (
                <li key={`${s}-${idx}`} className="text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-2">
                  {s}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </aside>
  );
};

export default EvidencePanel;

