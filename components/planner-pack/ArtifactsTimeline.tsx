import React, { useMemo, useState } from 'react';
import type { PlannerArtifact } from '../../src/planner-pack/v1/schemas';
import type { AssumptionItem } from './AssumptionsModule';
import AssumptionsModule from './AssumptionsModule';
import { renderArtifactContent } from './artifactRenderers';

interface TimelineItem {
  id: string;
  label: string;
  timestamp?: string;
  artifactType?: PlannerArtifact['type'];
  isAssumptions?: boolean;
}

interface ArtifactsTimelineProps {
  artifacts: Partial<Record<PlannerArtifact['type'], PlannerArtifact>>;
  assumptions?: AssumptionItem[];
  onExport: (artifact: PlannerArtifact) => void;
}

const formatTime = (iso?: string) => (iso ? new Date(iso).toLocaleString() : '—');

const ArtifactsTimeline: React.FC<ArtifactsTimelineProps> = ({ artifacts, assumptions = [], onExport }) => {
  const [expanded, setExpanded] = useState<string | null>(null);

  const items = useMemo<TimelineItem[]>(() => {
    const list: TimelineItem[] = [];
    const pushArtifact = (type: PlannerArtifact['type'], label: string) => {
      const artifact = artifacts[type];
      if (!artifact) return;
      list.push({
        id: type,
        label,
        timestamp: artifact.createdAt,
        artifactType: type
      });
    };

    pushArtifact('memo', 'Compliance memo generated');
    list.push({
      id: 'assumptions',
      label: 'Assumptions & confidence',
      timestamp: artifacts.memo?.createdAt ?? artifacts.options?.createdAt,
      isAssumptions: true
    });
    pushArtifact('options', 'Option set prepared');
    pushArtifact('species_mix', 'Species mix (10-20-30) generated');
    pushArtifact('procurement', 'Procurement pack prepared');
    pushArtifact('maintenance', 'Maintenance plan generated');
    pushArtifact('email_draft', 'Email draft ready');
    pushArtifact('check_report', 'Inventory ingested');

    return list;
  }, [artifacts]);

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const artifact = item.artifactType ? artifacts[item.artifactType] : null;
        const isOpen = expanded === item.id;
        return (
          <div key={item.id} className="border border-slate-200 rounded-lg bg-white">
            <button
              onClick={() => setExpanded(isOpen ? null : item.id)}
              className="w-full flex items-center justify-between px-4 py-3 text-left"
            >
              <div>
                <div className="text-sm font-semibold text-slate-800">{item.label}</div>
                <div className="text-[10px] text-slate-400">{formatTime(item.timestamp)}</div>
              </div>
              <span className="text-[10px] text-slate-500">{isOpen ? 'Collapse' : 'Preview'}</span>
            </button>
            {isOpen && item.isAssumptions && (
              <div className="px-4 pb-4">
                <AssumptionsModule items={assumptions} />
              </div>
            )}
            {isOpen && artifact && (
              <div className="px-4 pb-4">
                <div className="flex items-center justify-end mb-2">
                  <button
                    onClick={() => onExport(artifact)}
                    className="px-2 py-1 text-[10px] font-semibold border border-slate-200 rounded-lg text-slate-600 hover:border-weflora-teal"
                  >
                    Export
                  </button>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  {renderArtifactContent(artifact)}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ArtifactsTimeline;
