import React from 'react';
import type { DerivedConstraints } from '../../types';

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
}

const DerivedConstraintsPanel: React.FC<DerivedConstraintsPanelProps> = ({ derivedConstraints }) => {
  if (!derivedConstraints) return null;
  const { regulatory, site, equity, biophysical } = derivedConstraints;
  return (
    <section className="space-y-3" id="planning-constraints">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Derived constraints</h3>
          <p className="text-xs text-slate-500">Structured constraints extracted from evidence.</p>
        </div>
      </div>
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
    </section>
  );
};

export default DerivedConstraintsPanel;
