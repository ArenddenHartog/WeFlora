import React, { useMemo, useState } from 'react';
import type { PlannerArtifact } from '../../src/planner-pack/v1/schemas';
import ArtifactsTimeline from './ArtifactsTimeline';
import { renderArtifactContent } from './artifactRenderers';

interface ArtifactsPanelProps {
  artifacts: Partial<Record<PlannerArtifact['type'], PlannerArtifact>>;
  onExport: (artifact: PlannerArtifact) => void;
}

const ArtifactsPanel: React.FC<ArtifactsPanelProps> = ({ artifacts, onExport }) => {
  const availableTabs = useMemo(
    () =>
      ['memo', 'options', 'species_mix', 'maintenance', 'procurement', 'email_draft', 'check_report'] as PlannerArtifact['type'][],
    []
  );
  const [activeTab, setActiveTab] = useState<PlannerArtifact['type']>('memo');
  const [viewMode, setViewMode] = useState<'timeline' | 'tabs'>('timeline');

  const currentArtifact = artifacts[activeTab];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-800">Planner Pack Artifacts</h3>
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
      </div>

      {viewMode === 'timeline' ? (
        <ArtifactsTimeline artifacts={artifacts} onExport={onExport} />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {availableTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                  activeTab === tab
                    ? 'bg-weflora-mint/30 border-weflora-teal text-weflora-dark'
                    : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                {tab.replace('_', ' ')}
              </button>
            ))}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 text-sm text-slate-700">
            {currentArtifact ? (
              <div className="space-y-4">
                <div className="flex items-center justify-end">
                  <button
                    onClick={() => onExport(currentArtifact)}
                    className="px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg text-slate-600 hover:border-weflora-teal"
                  >
                    Export
                  </button>
                </div>
                {renderArtifactContent(currentArtifact)}
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

export default ArtifactsPanel;
