import React from 'react';
import { AI_TOKENS } from '../src/config/aiPresence';
import { useUI, type EvidenceProvenance } from '../contexts/UIContext';

export type EvidenceGlowStatus = 'generated' | 'verified' | 'warning' | 'error';

export type EvidenceGlowProps = {
  status: EvidenceGlowStatus;
  provenance?: EvidenceProvenance;
  className?: string;
  children: React.ReactNode;
};

const statusToClasses = (status: EvidenceGlowStatus) => {
  if (status === 'verified') {
    return {
      bg: AI_TOKENS.tintBg,
      border: AI_TOKENS.tintBorder,
      text: AI_TOKENS.text,
      hoverBorder: 'hover:border-weflora-teal/40',
    };
  }
  if (status === 'warning') {
    return {
      bg: 'bg-weflora-amber/10',
      border: 'border-weflora-amber/20',
      text: 'text-weflora-dark',
      hoverBorder: 'hover:border-weflora-amber/40',
    };
  }
  if (status === 'error') {
    return {
      bg: 'bg-weflora-red/10',
      border: 'border-weflora-red/20',
      text: 'text-weflora-dark',
      hoverBorder: 'hover:border-weflora-red/40',
    };
  }
  return {
    bg: AI_TOKENS.tintBg,
    border: AI_TOKENS.tintBorder,
    text: AI_TOKENS.text,
    hoverBorder: 'hover:border-weflora-teal/40',
  };
};

export const EvidenceGlow: React.FC<EvidenceGlowProps> = ({ status, provenance, className, children }) => {
  const { openEvidencePanel } = useUI();
  const c = statusToClasses(status);

  return (
    <div
      className={`rounded-lg border ${c.bg} ${c.border} ${c.text} ${c.hoverBorder} transition-colors ${className || ''}`}
      onClick={() => provenance && openEvidencePanel(provenance)}
      role={provenance ? 'button' : undefined}
      tabIndex={provenance ? 0 : undefined}
      onKeyDown={(e) => {
        if (!provenance) return;
        if (e.key === 'Enter' || e.key === ' ') openEvidencePanel(provenance);
      }}
    >
      {children}
    </div>
  );
};

export default EvidenceGlow;

