import React from 'react';
import EvidenceStrengthBar, { type EvidenceStrength } from './EvidenceStrengthBar';

export interface KeyClaimRow {
  id: string;
  claim: string;
  evidenceStrength: EvidenceStrength;
  reasoning: string;
  paperIds: string[];
  paperCount?: number;
}

export interface KeyClaimsTableProps {
  rows: KeyClaimRow[];
  onPaperClick?: (paperId: string) => void;
  className?: string;
}

const KeyClaimsTable: React.FC<KeyClaimsTableProps> = ({
  rows,
  onPaperClick,
  className = ''
}) => {
  return (
    <div className={`overflow-x-auto rounded-xl border border-slate-100 ${className}`}>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/50">
            <th className="text-left py-3 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Claim</th>
            <th className="text-left py-3 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-24">Evidence strength</th>
            <th className="text-left py-3 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Reasoning</th>
            <th className="text-left py-3 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-32">Papers</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="border-b border-slate-50 hover:bg-slate-50/30 transition-colors"
            >
              <td className="py-3 px-4 text-slate-700 font-medium">{row.claim}</td>
              <td className="py-3 px-4">
                <EvidenceStrengthBar
                  strength={row.evidenceStrength}
                  label={row.evidenceStrength.charAt(0).toUpperCase() + row.evidenceStrength.slice(1)}
                />
              </td>
              <td className="py-3 px-4 text-slate-600">{row.reasoning}</td>
              <td className="py-3 px-4">
                <div className="flex flex-wrap gap-1">
                  {row.paperIds.slice(0, 5).map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => onPaperClick?.(id)}
                      className="text-[10px] font-semibold text-weflora-teal hover:text-weflora-dark hover:underline"
                    >
                      {id}
                    </button>
                  ))}
                  {row.paperIds.length > 5 && (
                    <span className="text-[10px] text-slate-400">+{row.paperIds.length - 5}</span>
                  )}
                </div>
                {row.paperCount != null && (
                  <p className="text-[10px] text-slate-500 mt-0.5">{row.paperCount} papers</p>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default KeyClaimsTable;
