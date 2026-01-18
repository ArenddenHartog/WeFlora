import React, { useMemo, useState } from 'react';
import type { PlannerArtifact } from '../../src/planner-pack/v1/schemas';
import ArtifactsTimeline from './ArtifactsTimeline';
import AssumptionsModule, { type AssumptionItem } from './AssumptionsModule';
import { renderArtifactContent } from './artifactRenderers';

interface LivingRecordPanelProps {
  artifacts: Partial<Record<PlannerArtifact['type'], PlannerArtifact>>;
  assumptions: AssumptionItem[];
  recordStatus: string;
  confidenceLabel: string;
  lastUpdatedLabel: string;
  onExport: (artifact: PlannerArtifact) => void;
}

const orderedTabs: Array<{ id: PlannerArtifact['type'] | 'assumptions'; label: string }> = [
  { id: 'memo', label: 'Memo' },
  { id: 'assumptions', label: 'Assumptions' },
  { id: 'options', label: 'Options' },
  { id: 'species_mix', label: 'Species mix' },
  { id: 'procurement', label: 'Procurement' },
  { id: 'maintenance', label: 'Maintenance' },
  { id: 'email_draft', label: 'Email' },
  { id: 'check_report', label: 'Check report' }
];

const LivingRecordPanel: React.FC<LivingRecordPanelProps> = ({
  artifacts,
  assumptions,
  recordStatus,
  confidenceLabel,
  lastUpdatedLabel,
  onExport
}) => {
  const [viewMode, setViewMode] = useState<'timeline' | 'tabs'>('timeline');
  const [activeTab, setActiveTab] = useState<typeof orderedTabs[number]['id']>('memo');
  const [developerMode, setDeveloperMode] = useState(false);
  const [viewSource, setViewSource] = useState(false);

  const currentArtifact = useMemo(() => {
    if (activeTab === 'assumptions') return null;
    return artifacts[activeTab as PlannerArtifact['type']];
  }, [activeTab, artifacts]);

  return (
    <section className="space-y-4">
      <header className="border border-slate-200 rounded-xl p-4 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-400">Living record</div>
            <div className="text-lg font-semibold text-slate-900">Planner Pack</div>
            <div className="text-xs text-slate-500">Last updated {lastUpdatedLabel}</div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="px-2 py-1 rounded-full border border-slate-200 text-slate-600">Status: {recordStatus}</span>
            <span className="px-2 py-1 rounded-full border border-slate-200 text-slate-600">
              Confidence: {confidenceLabel}
            </span>
            {currentArtifact && (
              <button
                onClick={() => onExport(currentArtifact)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-weflora-teal text-white"
              >
                Export
              </button>
            )}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('timeline')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                viewMode === 'timeline'
                  ? 'bg-weflora-mint/30 border-weflora-teal text-weflora-dark'
                  : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
              }`}
            >
              Timeline
            </button>
            <button
              onClick={() => setViewMode('tabs')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                viewMode === 'tabs'
                  ? 'bg-weflora-mint/30 border-weflora-teal text-weflora-dark'
                  : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
              }`}
            >
              Tabs
            </button>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={() => setDeveloperMode((prev) => !prev)}
              className="text-[10px] uppercase tracking-wide text-slate-400 hover:text-slate-600"
            >
              {developerMode ? 'Developer mode on' : 'Developer mode'}
            </button>
            {developerMode && (
              <button
                onClick={() => setViewSource((prev) => !prev)}
                className={`px-2 py-1 rounded-full border text-[10px] uppercase tracking-wide ${
                  viewSource
                    ? 'bg-slate-100 border-slate-300 text-slate-600'
                    : 'bg-white border-slate-200 text-slate-400'
                }`}
              >
                View source
              </button>
            )}
          </div>
        </div>
      </header>

      {viewMode === 'timeline' ? (
        <ArtifactsTimeline artifacts={artifacts} assumptions={assumptions} onExport={onExport} />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {orderedTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                  activeTab === tab.id
                    ? 'bg-weflora-mint/30 border-weflora-teal text-weflora-dark'
                    : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 text-sm text-slate-700">
            {activeTab === 'assumptions' ? (
              <AssumptionsModule items={assumptions} />
            ) : currentArtifact ? (
              <div className="space-y-4">
                {renderArtifactContent(currentArtifact)}
                {viewSource && developerMode && (
                  <pre className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-3 overflow-x-auto">
                    {JSON.stringify(currentArtifact.payload, null, 2)}
                  </pre>
                )}
              </div>
            ) : (
              <div className="text-xs text-slate-400">Planner Pack artifacts are preparing…</div>
            )}
          </div>
        </div>
      )}
    </section>
  );
};

export default LivingRecordPanel;
