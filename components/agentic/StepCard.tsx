import React from 'react';
import type { StepRecord } from '../../src/agentic/contracts/zod.ts';

const statusStyles: Record<string, string> = {
  ok: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  insufficient_data: 'bg-amber-50 text-amber-700 border-amber-200',
  rejected: 'bg-rose-50 text-rose-700 border-rose-200',
  error: 'bg-rose-50 text-rose-700 border-rose-200',
  running: 'bg-slate-50 text-slate-700 border-slate-200',
  queued: 'bg-slate-50 text-slate-700 border-slate-200'
};

interface StepCardProps {
  step: StepRecord;
  agentName: string;
  selected?: boolean;
  onSelect?: () => void;
}

const StepCard: React.FC<StepCardProps> = ({ step, agentName, selected, onSelect }) => {
  const evidenceCount = step.output.evidence?.length ?? 0;
  const assumptionsCount = step.output.assumptions?.length ?? 0;
  const confidence = step.output.confidence?.level ?? 'unknown';
  const timestamp = new Date(step.created_at).toLocaleString();

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left rounded-xl border px-3 py-3 transition-all ${
        selected ? 'border-weflora-teal bg-weflora-mint/10' : 'border-slate-200 bg-white hover:bg-slate-50'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={`text-[10px] uppercase tracking-wide border rounded-full px-2 py-0.5 ${statusStyles[step.status] ?? statusStyles.ok}`}>
          {step.status.replace('_', ' ')}
        </span>
        <span className="text-[11px] text-slate-400">{timestamp}</span>
      </div>
      <div className="mt-2">
        <p className="text-sm font-semibold text-slate-800">{agentName}</p>
        <p className="text-xs text-slate-500">Confidence: {confidence}</p>
      </div>
      <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
        <span>{evidenceCount} evidence</span>
        <span>{assumptionsCount} assumptions</span>
      </div>
    </button>
  );
};

export default StepCard;
