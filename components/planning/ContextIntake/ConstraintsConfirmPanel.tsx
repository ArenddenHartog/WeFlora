import React from 'react';
import { CONSTRAINT_REGISTRY_MAP } from '../../../src/domain/constraints/constraintRegistry.ts';
import type { Claim, Constraint, EvidenceItem, Source } from '../../../src/decision-program/pciv/types.ts';

export interface ConstraintsConfirmPanelProps {
  constraints: Constraint[];
  claims: Claim[];
  evidenceItems: EvidenceItem[];
  sources: Source[];
  onConfirm: () => void;
}

const ConstraintsConfirmPanel: React.FC<ConstraintsConfirmPanelProps> = ({
  constraints,
  claims,
  evidenceItems,
  sources,
  onConfirm
}) => {
  const evidenceById = new Map(evidenceItems.map((item) => [item.evidenceId, item]));
  const sourceById = new Map(sources.map((source) => [source.sourceId, source]));
  const claimById = new Map(claims.map((claim) => [claim.claimId, claim]));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">Confirm constraint set</h2>
        <p className="text-sm text-slate-500">
          Review the canonical constraints that will be used for planning.
        </p>
      </div>

      <div className="space-y-3">
        {constraints.map((constraint) => {
          const registry = CONSTRAINT_REGISTRY_MAP.get(constraint.key);
          const evidenceRefs = constraint.derivedFrom
            .map((entry) => claimById.get(entry.claimId))
            .flatMap((claim) => claim?.evidenceRefs ?? []);
          const citations = evidenceRefs.map((ref) => {
            const evidence = evidenceById.get(ref.evidenceId);
            const source = evidence ? sourceById.get(evidence.sourceId) : undefined;
            const page = evidence?.locator.page ? `p. ${evidence.locator.page}` : undefined;
            return [source?.title ?? 'Source', page].filter(Boolean).join(' · ');
          });
          return (
            <div key={constraint.constraintId} className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{registry?.label ?? constraint.key}</p>
                  <p className="text-xs text-slate-500">Value: {String(constraint.value)}</p>
                </div>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                  {Math.round(constraint.confidence * 100)}% confidence
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Supporting evidence: {evidenceRefs.length}
              </p>
              {citations.length > 0 && (
                <ul className="text-[11px] text-slate-500 list-disc list-inside">
                  {citations.map((citation, index) => (
                    <li key={`${constraint.constraintId}-${index}`}>{citation}</li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onConfirm}
          className="text-sm font-semibold px-4 py-2 rounded-lg bg-weflora-teal text-white hover:bg-weflora-dark"
        >
          Proceed to Planning
        </button>
      </div>
    </div>
  );
};

export default ConstraintsConfirmPanel;
