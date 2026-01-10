import React, { useMemo, useState } from 'react';
import type { DerivedConstraints } from '../../types';
import type { PcivConstraint } from '../../pciv/v0/types';
import { shouldUsePcivConstraints } from './derivedConstraintsUtils';

const formatValue = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return `${value}`;
  return String(value);
};

const renderSection = (title: string, entries: Array<{ label: string; value: unknown }>) => (
  <div className="space-y-2">
    <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{title}</h4>
    <div className="space-y-1 text-xs text-slate-700">
      {entries.map((entry) => (
        <div key={entry.label} className="flex items-center justify-between gap-4">
          <span className="text-slate-500">{entry.label}</span>
          <span className="font-semibold">{formatValue(entry.value)}</span>
        </div>
      ))}
    </div>
  </div>
);

export interface DerivedConstraintsPanelProps {
  derivedConstraints?: DerivedConstraints;
  pcivConstraints?: PcivConstraint[];
}

const provenanceBadge = (provenance: PcivConstraint['provenance']) => {
  switch (provenance) {
    case 'source-backed':
      return 'bg-emerald-50 text-emerald-700';
    case 'user-entered':
      return 'bg-sky-50 text-sky-700';
    case 'model-inferred':
      return 'bg-amber-50 text-amber-700';
    default:
      return 'bg-slate-100 text-slate-500';
  }
};

const DerivedConstraintsPanel: React.FC<DerivedConstraintsPanelProps> = ({ derivedConstraints, pcivConstraints }) => {
  const [snippet, setSnippet] = useState<{ label: string; text: string } | null>(null);

  const hasPcivConstraints = shouldUsePcivConstraints(pcivConstraints);
  const groupedPciv = useMemo(() => {
    if (!hasPcivConstraints) return null;
    return pcivConstraints.reduce<Record<string, PcivConstraint[]>>((acc, constraint) => {
      acc[constraint.domain] = acc[constraint.domain] ?? [];
      acc[constraint.domain].push(constraint);
      return acc;
    }, {});
  }, [hasPcivConstraints, pcivConstraints]);

  if (hasPcivConstraints) {
    return (
      <section className="space-y-3" id="planning-constraints" data-testid="derived-constraints-panel">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Derived constraints</h3>
            <p className="text-xs text-slate-500">Structured constraints extracted from context intake.</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {Object.entries(groupedPciv ?? {}).map(([domain, constraints]) => (
            <div key={domain} className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                {domain.charAt(0).toUpperCase() + domain.slice(1)}
              </h4>
              <div className="space-y-2 text-xs text-slate-700">
                {constraints.map((constraint) => (
                  <div key={constraint.id} className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold text-slate-700">{constraint.label}</p>
                      <p className="text-[11px] text-slate-500">Value: {formatValue(constraint.value)}</p>
                      {constraint.provenance === 'source-backed' && constraint.snippet && (
                        <button
                          type="button"
                          onClick={() => setSnippet({ label: constraint.label, text: constraint.snippet ?? '' })}
                          className="text-[11px] font-semibold text-weflora-teal hover:text-weflora-dark"
                        >
                          View snippet
                        </button>
                      )}
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${provenanceBadge(constraint.provenance)}`}>
                      {constraint.provenance.replace('-', ' ')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        {snippet && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
            <div className="max-w-lg w-full rounded-2xl bg-white p-5 space-y-3 shadow-xl">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-800">Snippet · {snippet.label}</h4>
                <button
                  type="button"
                  onClick={() => setSnippet(null)}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                >
                  Close
                </button>
              </div>
              <p className="text-xs text-slate-600 whitespace-pre-wrap">{snippet.text}</p>
            </div>
          </div>
        )}
      </section>
    );
  }

  if (!derivedConstraints) return null;
  const { regulatory, site, equity, biophysical } = derivedConstraints;
  const hasAnyValue =
    Object.values(regulatory).some((value) => value !== null && value !== undefined && value !== '') ||
    Object.values(site).some((value) => value !== null && value !== undefined && value !== '') ||
    Object.values(equity).some((value) => value !== null && value !== undefined && value !== '') ||
    Object.values(biophysical).some((value) => value !== null && value !== undefined && value !== '');

  return (
    <section className="space-y-3" id="planning-constraints" data-testid="derived-constraints-panel">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Derived constraints</h3>
          <p className="text-xs text-slate-500">Structured constraints extracted from evidence.</p>
        </div>
      </div>
      {!hasAnyValue ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          No derived constraints yet — add sources or provide inputs.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {renderSection('Regulatory', [
            { label: 'Setting', value: regulatory.setting },
            { label: 'Salt tolerance required', value: regulatory.saltToleranceRequired },
            { label: 'Protected zone', value: regulatory.protectedZone },
            { label: 'Permit needed', value: regulatory.permitNeeded },
            { label: 'Max height class', value: regulatory.maxHeightClass }
          ])}
          {renderSection('Site', [
            { label: 'Light exposure', value: site.lightExposure },
            { label: 'Soil type', value: site.soilType },
            { label: 'Moisture', value: site.moisture },
            { label: 'Compaction risk', value: site.compactionRisk },
            { label: 'Rooting volume class', value: site.rootingVolumeClass },
            { label: 'Crown clearance class', value: site.crownClearanceClass },
            { label: 'Utilities present', value: site.utilitiesPresent },
            { label: 'Setbacks known', value: site.setbacksKnown }
          ])}
          {renderSection('Equity', [
            { label: 'Priority zones', value: equity.priorityZones },
            { label: 'Heat vulnerability', value: equity.heatVulnerability },
            { label: 'Asthma burden', value: equity.asthmaBurden },
            { label: 'Underserved flag', value: equity.underservedFlag }
          ])}
          {renderSection('Biophysical', [
            { label: 'Canopy cover', value: biophysical.canopyCover },
            { label: 'LST class', value: biophysical.lstClass },
            { label: 'Distance to paved', value: biophysical.distanceToPaved },
            { label: 'Flood risk', value: biophysical.floodRisk }
          ])}
        </div>
      )}
    </section>
  );
};

export default DerivedConstraintsPanel;
