import React, { useMemo } from 'react';
import type { PlannerArtifact } from '../../src/planner-pack/v1/schemas';
import type { AssumptionItem } from './AssumptionsModule';
import AssumptionsModule from './AssumptionsModule';

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
}

const formatTime = (iso?: string) => (iso ? new Date(iso).toLocaleString() : '—');

const ArtifactsTimeline: React.FC<ArtifactsTimelineProps> = ({ artifacts, assumptions = [] }) => {
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
    <div className="relative">
      <div className="absolute left-2 top-0 h-full w-px bg-slate-200" />
      <div className="space-y-10 pl-8">
        {items.map((item) => {
          const artifact = item.artifactType ? artifacts[item.artifactType] : null;
          const outputPayload = artifact?.payload ?? null;
          const outputPointers = outputPayload ? [{ pointer: `/artifacts/${item.artifactType}`, value: outputPayload }] : [];

          return (
            <article key={item.id} className="relative pb-8">
              <div className="absolute left-[-28px] top-2 h-3 w-3 rounded-full border border-weflora-teal bg-white" />

              <header className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs text-slate-400">{formatTime(item.timestamp)}</p>
                  <p className="mt-2 text-base font-semibold text-slate-900">{item.label}</p>
                </div>
                <span className="inline-flex items-center rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-600">
                  complete
                </span>
              </header>

              <div className="mt-5 space-y-5">
                <section>
                  <h4 className="text-sm font-semibold text-slate-700">What happened</h4>
                  <p className="mt-2 text-sm text-slate-900">{item.label}</p>
                </section>

                <section>
                  <h4 className="text-sm font-semibold text-slate-700">Inputs</h4>
                  <p className="mt-2 text-sm text-slate-500">No inputs captured for this step.</p>
                </section>

                <section>
                  <h4 className="text-sm font-semibold text-slate-700">Outputs</h4>
                  {outputPointers.length === 0 ? (
                    <p className="mt-2 text-sm text-slate-500">No outputs recorded for this step.</p>
                  ) : (
                    <ul className="mt-2 space-y-1 text-xs text-slate-700">
                      {outputPointers.map((item) => (
                        <li key={item.pointer} className="font-mono">
                          {item.pointer} = {JSON.stringify(item.value)}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section>
                  <h4 className="text-sm font-semibold text-slate-700">Evidence</h4>
                  <p className="mt-2 text-sm text-slate-500">No evidence captured for this step.</p>
                </section>

                <section>
                  <h4 className="text-sm font-semibold text-slate-700">Assumptions</h4>
                  {item.isAssumptions ? <AssumptionsModule items={assumptions} /> : <p className="mt-2 text-sm text-slate-500">No assumptions recorded.</p>}
                </section>

                <section>
                  <h4 className="text-sm font-semibold text-slate-700">Artifacts / Actions</h4>
                  {artifact ? (
                    <div className="mt-2 space-y-3">
                      <div className="text-sm text-slate-700">{artifact.title ?? artifact.type}</div>
                      <pre className="whitespace-pre-wrap text-xs font-mono text-slate-600">
                        {JSON.stringify(artifact.payload ?? {}, null, 2)}
                      </pre>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-slate-500">No artifacts or actions emitted.</p>
                  )}
                </section>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
};

export default ArtifactsTimeline;
