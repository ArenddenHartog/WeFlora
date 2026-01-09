import React, { useMemo, useState } from 'react';
import { CONSTRAINT_REGISTRY_MAP } from '../../../src/domain/constraints/constraintRegistry.ts';
import type { Claim, EvidenceItem, Source } from '../../../src/decision-program/pciv/types.ts';
import { formatEvidenceLines, groupClaimsByDomain } from '../../../src/decision-program/pciv/uiViewModel.ts';

type ClaimAction = 'accepted' | 'corrected' | 'rejected';

export interface ClaimsReviewPanelProps {
  claims: Claim[];
  evidenceItems: EvidenceItem[];
  sources: Source[];
  onUpdateClaim: (claimId: string, update: { status: ClaimAction; correctedValue?: unknown }) => void;
  onContinue: () => void;
}

const ClaimsReviewPanel: React.FC<ClaimsReviewPanelProps> = ({
  claims,
  evidenceItems,
  sources,
  onUpdateClaim,
  onContinue
}) => {
  const [editingClaimId, setEditingClaimId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const grouped = useMemo(() => groupClaimsByDomain(claims), [claims]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">Review extracted claims</h2>
        <p className="text-sm text-slate-500">
          Accept, correct, or ignore extracted claims before constraints are locked.
        </p>
      </div>

      {Object.entries(grouped).map(([domain, domainClaims]) => (
        <div key={domain} className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-700 capitalize">{domain}</h3>
          <div className="space-y-3">
            {domainClaims.map((claim) => {
              const registry = CONSTRAINT_REGISTRY_MAP.get(claim.normalized.key);
              const evidenceLines = formatEvidenceLines(claim.evidenceRefs, evidenceItems, sources);
              const isEditing = editingClaimId === claim.claimId;
              return (
                <div key={claim.claimId} className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{claim.statement}</p>
                      <p className="text-xs text-slate-500">
                        Maps to <span className="font-semibold">{registry?.label ?? claim.normalized.key}</span>
                      </p>
                    </div>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                      {Math.round(claim.confidence * 100)}% confidence
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">{claim.confidenceRationale}</p>
                  {evidenceLines.length > 0 && (
                    <ul className="text-[11px] text-slate-500 list-disc list-inside">
                      {evidenceLines.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  )}

                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <input
                        className="flex-1 rounded-lg border border-slate-200 px-2 py-1 text-xs"
                        value={editValue}
                        onChange={(event) => setEditValue(event.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          onUpdateClaim(claim.claimId, { status: 'corrected', correctedValue: editValue });
                          setEditingClaimId(null);
                        }}
                        className="text-xs font-semibold px-3 py-1 rounded-lg bg-weflora-teal text-white"
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => onUpdateClaim(claim.claimId, { status: 'accepted' })}
                        className="text-xs font-semibold px-3 py-1 rounded-lg bg-weflora-teal text-white"
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingClaimId(claim.claimId);
                          setEditValue(String(claim.normalized.value));
                        }}
                        className="text-xs font-semibold px-3 py-1 rounded-lg border border-slate-200 text-slate-600"
                      >
                        Correct
                      </button>
                      <button
                        type="button"
                        onClick={() => onUpdateClaim(claim.claimId, { status: 'rejected' })}
                        className="text-xs font-semibold px-3 py-1 rounded-lg border border-rose-200 text-rose-600"
                      >
                        Ignore
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onContinue}
          className="text-sm font-semibold px-4 py-2 rounded-lg bg-weflora-teal text-white hover:bg-weflora-dark"
        >
          Review constraints
        </button>
      </div>
    </div>
  );
};

export default ClaimsReviewPanel;
