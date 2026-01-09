import React from 'react';
import type { EvidenceNode } from '../../types';
import type { SimulationDiff } from '../../evidence/simulate';

export interface EvidenceMapControlsProps {
  isOpen: boolean;
  constraints: EvidenceNode[];
  selectedConstraint?: EvidenceNode | null;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  onSelectConstraint: (id: string) => void;
  value: string | number | boolean | null;
  onValueChange: (value: string | number | boolean) => void;
  confidence: number;
  onConfidenceChange: (value: number) => void;
  overrideEvidence: boolean;
  onOverrideEvidenceChange: (value: boolean) => void;
  diff?: SimulationDiff | null;
}

const formatDelta = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}`;

const EvidenceMapControls: React.FC<EvidenceMapControlsProps> = ({
  isOpen,
  constraints,
  selectedConstraint,
  searchTerm,
  onSearchTermChange,
  onSelectConstraint,
  value,
  onValueChange,
  confidence,
  onConfidenceChange,
  overrideEvidence,
  onOverrideEvidenceChange,
  diff
}) => {
  if (!isOpen) return null;
  const filteredConstraints = constraints.filter((node) =>
    node.label.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const options = Array.isArray(selectedConstraint?.metadata?.options)
    ? (selectedConstraint?.metadata?.options as string[])
    : null;
  const valueType = typeof value;
  const changedConstraints = (diff?.changedNodes ?? [])
    .filter((entry) => entry.id.startsWith('constraint:'))
    .sort((a, b) => Math.abs(b.nextConfidence - b.prevConfidence) - Math.abs(a.nextConfidence - a.prevConfidence))
    .slice(0, 5);

  return (
    <aside className="absolute left-0 top-0 h-full w-80 border-r border-slate-200 bg-white/95 px-4 py-5 backdrop-blur">
      <div className="space-y-4">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-slate-400">What-if simulation</p>
          <p className="text-xs text-slate-600">Patch constraints and see confidence + rank deltas.</p>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-600">Find constraint</label>
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
            placeholder="Search constraints"
            className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs"
          />
          <div className="max-h-40 space-y-1 overflow-y-auto">
            {filteredConstraints.map((node) => (
              <button
                key={node.id}
                type="button"
                onClick={() => onSelectConstraint(node.id)}
                className={`w-full rounded-md border px-2 py-1 text-left text-xs ${
                  node.id === selectedConstraint?.id
                    ? 'border-weflora-mint/60 text-weflora-teal bg-weflora-mint/10'
                    : 'border-slate-200 text-slate-600'
                }`}
              >
                {node.label}
              </button>
            ))}
          </div>
        </div>

        {selectedConstraint && (
          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold text-slate-600">Edit value</p>
              {options ? (
                <select
                  value={String(value ?? '')}
                  onChange={(event) => onValueChange(event.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1 text-xs"
                >
                  {options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : valueType === 'boolean' ? (
                <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={Boolean(value)}
                    onChange={(event) => onValueChange(event.target.checked)}
                    className="rounded border-slate-300 text-weflora-teal"
                  />
                  Toggle true
                </label>
              ) : (
                <input
                  type={valueType === 'number' ? 'number' : 'text'}
                  value={value === null ? '' : String(value)}
                  onChange={(event) => {
                    const next =
                      valueType === 'number' ? Number(event.target.value) : (event.target.value as string);
                    onValueChange(next);
                  }}
                  className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1 text-xs"
                />
              )}
            </div>

            <div>
              <label className="flex items-center justify-between text-xs font-semibold text-slate-600">
                <span>Assume true confidence</span>
                <span className="text-slate-500">{confidence.toFixed(2)}</span>
              </label>
              <input
                type="range"
                min={0.5}
                max={0.98}
                step={0.01}
                value={confidence}
                onChange={(event) => onConfidenceChange(Number(event.target.value))}
                className="mt-2 w-full accent-weflora-teal"
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={overrideEvidence}
                onChange={(event) => onOverrideEvidenceChange(event.target.checked)}
                className="rounded border-slate-300 text-weflora-teal"
              />
              Override evidence
            </label>
          </div>
        )}

        <div className="space-y-2 border-t border-slate-200 pt-3">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">Projected changes</p>
          <div className="space-y-2">
            <div>
              <p className="text-xs font-semibold text-slate-600">Ranking delta</p>
              <ul className="text-xs text-slate-600 space-y-1">
                {(diff?.topMovers ?? []).length === 0 && <li>No movers yet.</li>}
                {diff?.topMovers.map((entry) => (
                  <li key={entry.id} className="flex justify-between gap-2">
                    <span className="truncate">{entry.label}</span>
                    <span className="text-slate-500">{entry.rankDelta ? formatDelta(entry.rankDelta) : '0'}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-600">Confidence delta</p>
              <ul className="text-xs text-slate-600 space-y-1">
                {changedConstraints.length === 0 && <li>No confidence shifts.</li>}
                {changedConstraints.map((entry) => (
                  <li key={entry.id} className="flex justify-between gap-2">
                    <span className="truncate">{entry.id.replace('constraint:', '')}</span>
                    <span className="text-slate-500">
                      {formatDelta(entry.nextConfidence - entry.prevConfidence)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default EvidenceMapControls;
