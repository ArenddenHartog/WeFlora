import React from 'react';
import type { PlannerArtifact } from '../../src/planner-pack/v1/schemas';
import ArtifactsTimeline from './ArtifactsTimeline';

interface ArtifactsPanelProps {
  artifacts: Partial<Record<PlannerArtifact['type'], PlannerArtifact>>;
}

const ArtifactsPanel: React.FC<ArtifactsPanelProps> = ({ artifacts }) => {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-800">Planner Pack Artifacts</h3>
      </div>
      <ArtifactsTimeline artifacts={artifacts} />
    </section>
  );
};

export default ArtifactsPanel;
