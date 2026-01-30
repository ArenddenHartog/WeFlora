import React from 'react';
import type { PlannerArtifact } from '../../src/planner-pack/v1/schemas';
import ArtifactsTimeline from './ArtifactsTimeline';
import { type AssumptionItem } from './AssumptionsModule';

interface LivingRecordPanelProps {
  artifacts: Partial<Record<PlannerArtifact['type'], PlannerArtifact>>;
  assumptions: AssumptionItem[];
  recordStatus: string;
  confidenceLabel: string;
  lastUpdatedLabel: string;
}

const LivingRecordPanel: React.FC<LivingRecordPanelProps> = ({
  artifacts,
  assumptions,
  recordStatus,
  confidenceLabel,
  lastUpdatedLabel
}) => {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Living record</h2>
        <p className="text-sm text-slate-500">Planner Pack timeline</p>
        <p className="mt-1 text-xs text-slate-400">Last updated {lastUpdatedLabel}</p>
        <p className="mt-1 text-xs text-slate-400">Status: {recordStatus} · Confidence: {confidenceLabel}</p>
      </div>
      <ArtifactsTimeline artifacts={artifacts} assumptions={assumptions} />
    </section>
  );
};

export default LivingRecordPanel;
