import React from 'react';
import { consensusBarStrong, consensusBarMedium, consensusBarWeak } from '../../src/ui/tokens';

export type EvidenceStrength = 'strong' | 'moderate' | 'weak';

export interface ConsensusSegment {
  /** Label (e.g. "Strong", "Yes", "Moderate") */
  label: string;
  /** Strength category for color mapping */
  strength: EvidenceStrength;
  /** Percentage 0-100 */
  percent: number;
  /** Optional count (e.g. "8 papers") */
  count?: number;
  /** Optional hover tooltip content */
  tooltip?: React.ReactNode;
}

export interface ConsensusBarProps {
  segments: ConsensusSegment[];
  /** Total count for subtitle (e.g. "Prediction of 16 relevant papers") */
  totalLabel?: string;
  /** Optional filter/click handler per segment */
  onSegmentClick?: (segment: ConsensusSegment, index: number) => void;
  className?: string;
}

const strengthToBarClass: Record<EvidenceStrength, string> = {
  strong: consensusBarStrong,
  moderate: consensusBarMedium,
  weak: consensusBarWeak,
};

const ConsensusBar: React.FC<ConsensusBarProps> = ({
  segments,
  totalLabel,
  onSegmentClick,
  className = ''
}) => {
  const total = segments.reduce((sum, s) => sum + s.percent, 0);
  const normalized = total > 0 ? segments.map((s) => ({ ...s, percent: (s.percent / total) * 100 })) : segments;

  return (
    <div className={`space-y-2 ${className}`}>
      {totalLabel && (
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{totalLabel}</p>
      )}
      <div className="flex h-6 w-full rounded-lg overflow-hidden bg-slate-100">
        {normalized.map((segment, index) => {
          if (segment.percent <= 0) return null;
          const barClass = strengthToBarClass[segment.strength];
          const segmentContent = (
            <div
              key={`${segment.label}-${index}`}
              className={`h-full flex items-center justify-center min-w-[2px] transition-all ${barClass}`}
              style={{ width: `${segment.percent}%` }}
              title={segment.tooltip ? undefined : `${segment.label}: ${segment.percent.toFixed(0)}%`}
            >
              {segment.percent >= 12 && (
                <span className="text-[10px] font-bold text-white truncate px-1">
                  {segment.percent >= 18 ? `${segment.percent.toFixed(0)}%` : ''}
                </span>
              )}
            </div>
          );

          if (onSegmentClick) {
            return (
              <button
                type="button"
                key={`${segment.label}-${index}`}
                onClick={() => onSegmentClick(segment, index)}
                className="flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-weflora-teal/50 rounded"
              >
                {segmentContent}
              </button>
            );
          }

          return (
            <div key={`${segment.label}-${index}`} className="relative group flex-shrink-0">
              {segmentContent}
              {segment.tooltip && segment.percent >= 8 && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10 w-64 p-3 rounded-lg bg-white border border-slate-200 shadow-lg text-left">
                  {segment.tooltip}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-3 text-[11px]">
        {normalized.filter((s) => s.percent > 0).map((segment, index) => (
          <span key={`${segment.label}-${index}`} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-sm ${strengthToBarClass[segment.strength]}`} />
            <span className="font-semibold text-slate-700">{segment.label}</span>
            <span className="text-slate-500">{segment.percent.toFixed(0)}%</span>
            {segment.count != null && (
              <span className="text-slate-400">({segment.count})</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
};

export default ConsensusBar;
