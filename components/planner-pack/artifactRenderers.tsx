import React from 'react';
import type { PlannerArtifact } from '../../src/planner-pack/v1/schemas';
import DocumentViewer from './DocumentViewer';

const formatCurrencyBand = (band: string) => band;

export const renderArtifactContent = (artifact: PlannerArtifact) => {
  const payload = artifact.payload as any;

  if (artifact.type === 'memo') {
    return (
      <DocumentViewer
        html={artifact.renderedHtml ?? null}
        fallback={<div className="text-xs text-slate-500">Memo content pending.</div>}
      />
    );
  }

  if (artifact.type === 'options') {
    return (
      <div className="space-y-3">
        {(payload.options ?? []).map((option: any, index: number) => (
          <div key={`${option.title}-${index}`} className="border border-slate-200 rounded-lg p-3 bg-white">
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
        <pre className="whitespace-pre-wrap text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
          {payload.body}
        </pre>
      </div>
    );
  }

  if (artifact.type === 'check_report') {
    return (
      <div className="space-y-2 text-sm">
        <div className="font-semibold">Inventory Summary</div>
        <div className="text-xs text-slate-500">Trees count: {payload.inventorySummary?.treesCount ?? 0}</div>
        <div className="text-xs text-slate-500">Species count: {payload.inventorySummary?.speciesCount ?? 0}</div>
        <div className="text-xs text-slate-500">
          Missing species: {Math.round((payload.inventorySummary?.missingSpeciesPct ?? 0) * 100)}%
        </div>
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
                  <li key={item.name}>
                    {item.name}: {Math.round(item.pct * 100)}%
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {payload.distribution?.genus?.length ? (
            <div>
              <div className="text-xs font-semibold text-slate-600">Top genus</div>
              <ul className="list-disc list-inside text-xs text-slate-500">
                {payload.distribution.genus.map((item: any) => (
                  <li key={item.name}>
                    {item.name}: {Math.round(item.pct * 100)}%
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {payload.distribution?.family?.length ? (
            <div>
              <div className="text-xs font-semibold text-slate-600">Top family</div>
              <ul className="list-disc list-inside text-xs text-slate-500">
                {payload.distribution.family.map((item: any) => (
                  <li key={item.name}>
                    {item.name}: {Math.round(item.pct * 100)}%
                  </li>
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
      <div className="space-y-4 text-sm text-slate-700">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="font-semibold">Maintenance & Lifecycle Plan</div>
            <div className="text-xs text-slate-500">{payload.preparedBy}</div>
          </div>
          <div className="text-xs text-slate-500">Years 0–10</div>
        </div>
        <div className="grid gap-3">
          {(payload.phases ?? []).map((phase: any) => (
            <div key={phase.phase} className="border border-slate-200 rounded-lg p-3 bg-white">
              <div className="text-xs font-semibold text-slate-700">{phase.phase}</div>
              <div className="mt-2 grid md:grid-cols-2 gap-2 text-xs text-slate-600">
                {(phase.tasks ?? []).map((task: any, index: number) => (
                  <div key={`${task.task}-${index}`} className="border border-slate-100 rounded-md p-2">
                    <div className="font-semibold text-slate-700">{task.task}</div>
                    <div>Frequency: {task.frequency}</div>
                    <div>Seasonality: {task.seasonality}</div>
                    <div>Responsible: {task.responsibleParty}</div>
                    <div>OPEX band: {formatCurrencyBand(task.opexBand)}</div>
                    {task.risks?.length ? (
                      <div className="mt-1">
                        <span className="font-semibold text-slate-500">Risks:</span> {task.risks.join(', ')}
                      </div>
                    ) : null}
                    {task.mitigations?.length ? (
                      <div>
                        <span className="font-semibold text-slate-500">Mitigations:</span> {task.mitigations.join(', ')}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        {(payload.summary ?? []).length ? (
          <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
            <div className="text-xs font-semibold text-slate-700 mb-1">At-a-glance</div>
            <ul className="list-disc list-inside text-xs text-slate-600">
              {payload.summary.map((item: string, index: number) => (
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
