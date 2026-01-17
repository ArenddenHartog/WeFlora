import React, { useMemo, useState } from 'react';
import type { PlannerArtifact } from '../../src/planner-pack/v1/schemas';

interface ArtifactsPanelProps {
  artifacts: Partial<Record<PlannerArtifact['type'], PlannerArtifact>>;
  onExport: (artifact: PlannerArtifact) => void;
}

const renderPayload = (artifact: PlannerArtifact) => {
  const payload = artifact.payload as any;
  if (artifact.type === 'memo' && artifact.renderedHtml) {
    return <div dangerouslySetInnerHTML={{ __html: artifact.renderedHtml }} />;
  }

  if (artifact.type === 'options') {
    return (
      <div className="space-y-3">
        {(payload.options ?? []).map((option: any, index: number) => (
          <div key={`${option.title}-${index}`} className="border border-slate-200 rounded-lg p-3">
            <div className="font-semibold text-slate-800">{option.title}</div>
            <div className="text-xs text-slate-500">{option.summary}</div>
          </div>
        ))}
      </div>
    );
  }

  if (artifact.type === 'procurement') {
    return (
      <ul className="list-disc list-inside text-sm text-slate-600">
        {(payload.checklist ?? []).map((item: string, index: number) => (
          <li key={`${item}-${index}`}>{item}</li>
        ))}
      </ul>
    );
  }

  if (artifact.type === 'email_draft') {
    return (
      <div className="space-y-3 text-sm text-slate-700">
        <div className="font-semibold">{payload.subject}</div>
        <pre className="whitespace-pre-wrap text-xs bg-slate-50 p-3 rounded-lg">{payload.body}</pre>
      </div>
    );
  }

  if (artifact.type === 'check_report') {
    return (
      <div className="space-y-2 text-sm">
        <div className="font-semibold">Inventory Summary</div>
        <div className="text-xs text-slate-500">Trees count: {payload.inventorySummary?.treesCount ?? 0}</div>
        <div className="text-xs text-slate-500">Species count: {payload.inventorySummary?.speciesCount ?? 0}</div>
        <div className="text-xs text-slate-500">Missing species: {Math.round((payload.inventorySummary?.missingSpeciesPct ?? 0) * 100)}%</div>
      </div>
    );
  }

  return <pre className="text-xs text-slate-500">{JSON.stringify(payload, null, 2)}</pre>;
};

const ArtifactsPanel: React.FC<ArtifactsPanelProps> = ({ artifacts, onExport }) => {
  const availableTabs = useMemo(
    () => ['memo', 'options', 'procurement', 'email_draft', 'check_report'] as PlannerArtifact['type'][],
    []
  );
  const [activeTab, setActiveTab] = useState<PlannerArtifact['type']>('memo');

  const currentArtifact = artifacts[activeTab];

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">Planner Pack Artifacts</h3>
        {currentArtifact && (
          <button
            onClick={() => onExport(currentArtifact)}
            className="px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg text-slate-600 hover:border-weflora-teal"
          >
            Export
          </button>
        )}
      </div>

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
            {renderPayload(currentArtifact)}
            {Array.isArray((currentArtifact.payload as any)?.assumptions) && (
              <div>
                <h4 className="text-xs font-semibold text-slate-600">Assumptions</h4>
                <ul className="list-disc list-inside text-xs text-slate-500">
                  {((currentArtifact.payload as any).assumptions ?? []).map((item: string, index: number) => (
                    <li key={`${item}-${index}`}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
            {Array.isArray((currentArtifact.payload as any)?.evidence) && (
              <div>
                <h4 className="text-xs font-semibold text-slate-600">Evidence supporting compliance</h4>
                <ul className="list-disc list-inside text-xs text-slate-500">
                  {((currentArtifact.payload as any).evidence ?? []).map((item: any, index: number) => (
                    <li key={`${item.title ?? item.kind}-${index}`}>{item.title ?? item.kind}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="text-xs text-slate-400">Planner Pack artifacts are preparing…</div>
        )}
      </div>
    </section>
  );
};

export default ArtifactsPanel;
