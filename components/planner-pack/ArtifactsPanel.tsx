import React, { useMemo, useState } from 'react';
import type { PlannerArtifact } from '../../src/planner-pack/v1/schemas';
import ArtifactsTimeline from './ArtifactsTimeline';

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
            {option.intent && <div className="text-xs text-slate-500">{option.intent}</div>}
            <div className="grid gap-2 text-xs text-slate-600 mt-2">
              {option.plantingMix && (
                <div>
                  <span className="font-semibold text-slate-500">Planting mix:</span> {option.plantingMix}
                </div>
              )}
              {option.quantities && (
                <div>
                  <span className="font-semibold text-slate-500">Quantities:</span> {option.quantities}
                </div>
              )}
              {option.capexOpex && (
                <div>
                  <span className="font-semibold text-slate-500">Capex/Opex:</span> {option.capexOpex}
                </div>
              )}
              {option.tradeoffs && (
                <div>
                  <span className="font-semibold text-slate-500">Tradeoffs:</span> {option.tradeoffs}
                </div>
              )}
              {option.whenToChoose && (
                <div>
                  <span className="font-semibold text-slate-500">When to choose:</span> {option.whenToChoose}
                </div>
              )}
            </div>
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

  if (artifact.type === 'species_mix') {
    return (
      <div className="space-y-3 text-sm text-slate-700">
        <div className="font-semibold">Species mix overview</div>
        <div className="text-xs text-slate-500">Mode: {payload.mode}</div>
        <div className="text-xs text-slate-500">{payload.baselineNote}</div>
        <div className="grid gap-2">
          {payload.distribution?.species?.length ? (
            <div>
              <div className="text-xs font-semibold text-slate-600">Top species</div>
              <ul className="list-disc list-inside text-xs text-slate-500">
                {payload.distribution.species.map((item: any) => (
                  <li key={item.name}>{item.name}: {Math.round(item.pct * 100)}%</li>
                ))}
              </ul>
            </div>
          ) : null}
          {payload.distribution?.genus?.length ? (
            <div>
              <div className="text-xs font-semibold text-slate-600">Top genus</div>
              <ul className="list-disc list-inside text-xs text-slate-500">
                {payload.distribution.genus.map((item: any) => (
                  <li key={item.name}>{item.name}: {Math.round(item.pct * 100)}%</li>
                ))}
              </ul>
            </div>
          ) : null}
          {payload.distribution?.family?.length ? (
            <div>
              <div className="text-xs font-semibold text-slate-600">Top family</div>
              <ul className="list-disc list-inside text-xs text-slate-500">
                {payload.distribution.family.map((item: any) => (
                  <li key={item.name}>{item.name}: {Math.round(item.pct * 100)}%</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
        {payload.violations?.length ? (
          <div>
            <div className="text-xs font-semibold text-slate-600">10-20-30 violations</div>
            <ul className="list-disc list-inside text-xs text-slate-500">
              {payload.violations.map((item: string, index: number) => (
                <li key={`${item}-${index}`}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {payload.recommendation && <div className="text-xs text-slate-500">{payload.recommendation}</div>}
      </div>
    );
  }

  if (artifact.type === 'maintenance') {
    return (
      <div className="space-y-3 text-sm text-slate-700">
        <div className="font-semibold">Maintenance lifecycle</div>
        <div className="text-xs text-slate-500">{payload.preparedBy}</div>
        <div className="space-y-2">
          {(payload.schedule ?? []).map((phase: any) => (
            <div key={phase.phase} className="border border-slate-200 rounded-lg p-3">
              <div className="text-xs font-semibold text-slate-700">{phase.phase}</div>
              <ul className="list-disc list-inside text-xs text-slate-500">
                {(phase.tasks ?? []).map((task: string, index: number) => (
                  <li key={`${task}-${index}`}>{task}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        {payload.mowingGuidance?.length ? (
          <div>
            <div className="text-xs font-semibold text-slate-600">Mowing guidance</div>
            <ul className="list-disc list-inside text-xs text-slate-500">
              {payload.mowingGuidance.map((item: string, index: number) => (
                <li key={`${item}-${index}`}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {payload.opexBands?.length ? (
          <div>
            <div className="text-xs font-semibold text-slate-600">Opex bands</div>
            <ul className="list-disc list-inside text-xs text-slate-500">
              {payload.opexBands.map((item: string, index: number) => (
                <li key={`${item}-${index}`}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    );
  }

  return <pre className="text-xs text-slate-500">{JSON.stringify(payload, null, 2)}</pre>;
};

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
                {renderPayload(currentArtifact)}
                {Array.isArray((currentArtifact.payload as any)?.assumptionsDetailed) && (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                    <div className="text-xs font-semibold text-slate-700">Assumptions & validation</div>
                    <div className="mt-2 space-y-2">
                      {((currentArtifact.payload as any).assumptionsDetailed ?? []).map((item: any) => (
                        <div key={item.id} className="text-xs text-slate-600">
                          <div className="font-semibold text-slate-700">{item.statement}</div>
                          <div className="text-[11px] text-slate-500">Basis: {item.basis} · Confidence: {item.confidence}</div>
                          <div className="text-[11px] text-slate-500">Validate: {item.how_to_validate}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
        </div>
      )}
    </section>
  );
};

export default ArtifactsPanel;
