import React from 'react';
import { consensusBarStrong, consensusBarMedium, consensusBarWeak } from '../../src/ui/tokens';

export type EvidenceStrength = 'strong' | 'moderate' | 'weak';

export interface EvidenceStrengthBarProps {
  strength: EvidenceStrength;
  /** Max bars (default 8). Strong=8, Moderate=6, Weak=4 */
  maxBars?: number;
  /** Optional text label below (e.g. "Strong", "Moderate") */
  label?: string;
  className?: string;
}

const strengthConfig: Record<EvidenceStrength, { filled: number; barClass: string }> = {
  strong: { filled: 8, barClass: consensusBarStrong },
  moderate: { filled: 6, barClass: consensusBarMedium },
  weak: { filled: 4, barClass: consensusBarWeak },
};

const EvidenceStrengthBar: React.FC<EvidenceStrengthBarProps> = ({
  strength,
  maxBars = 8,
  label,
  className = ''
}) => {
  const { filled, barClass } = strengthConfig[strength];
  const displayFilled = Math.min(filled, maxBars);

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <div className="flex gap-0.5">
        {Array.from({ length: maxBars }).map((_, i) => (
          <div
            key={i}
            className={`w-1.5 h-4 rounded-sm ${i < displayFilled ? barClass : 'bg-slate-200'}`}
          />
        ))}
      </div>
      {label && (
        <span className="text-[10px] font-semibold text-slate-600">{label}</span>
      )}
    </div>
  );
};

export default EvidenceStrengthBar;
