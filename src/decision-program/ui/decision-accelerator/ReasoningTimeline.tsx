import React from 'react';
import type { EvidenceItem, EvidenceRef, EvidenceSource, ExecutionLogEntry, Phase, TimelineEntry } from '../../types';
import type { StepperStepViewModel } from './RightSidebarStepper';
import { buildReasoningTimelineItems, mergeTimelineEntries } from './reasoningUtils';

export interface ReasoningTimelineProps {
  steps: StepperStepViewModel[];
  logs: ExecutionLogEntry[];
  evidenceIndex?: Record<string, EvidenceRef[]>;
  evidenceSources?: EvidenceSource[];
  timelineEntries?: TimelineEntry[];
  onOpenCitations?: (args: { evidence?: EvidenceRef[]; sourceId?: string }) => void;
  focusedEntryId?: string | null;
  className?: string;
}

const phaseOrder: Phase[] = ['site', 'species', 'supply'];

const ReasoningTimeline: React.FC<ReasoningTimelineProps> = ({
  steps,
  logs,
  evidenceIndex,
  evidenceSources,
  timelineEntries,
  onOpenCitations,
  focusedEntryId,
  className
}) => {
  const [expandedEvidence, setExpandedEvidence] = React.useState<Record<string, boolean>>({});
  const fallbackItems = buildReasoningTimelineItems(steps, logs, evidenceIndex);
  const items = mergeTimelineEntries(timelineEntries, fallbackItems);
  const grouped = items.reduce<Record<string, typeof items>>((acc, item) => {
    const phase = item.phase ?? 'site';
    acc[phase] = acc[phase] ?? [];
    acc[phase].push(item);
    return acc;
  }, {});

  const sourceMap = React.useMemo(() => {
    const map = new Map<string, EvidenceSource>();
    (evidenceSources ?? []).forEach((source) => map.set(source.id, source));
    return map;
  }, [evidenceSources]);

  React.useEffect(() => {
    if (!focusedEntryId) return;
    setExpandedEvidence((prev) => ({ ...prev, [focusedEntryId]: true }));
  }, [focusedEntryId]);

  const formatCitation = (citation: EvidenceItem['citations'][number]) => {
    const source = sourceMap.get(citation.sourceId);
    const page = citation.locator?.page ? `p. ${citation.locator.page}` : undefined;
    return [source?.title ?? citation.sourceId, page].filter(Boolean).join(' · ');
  };

  return (
    <section className={`space-y-6 ${className ?? ''}`} id="planning-timeline">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Reasoning timeline</h3>
          <p className="text-xs text-slate-500">Findings, evidence, and artifacts as the run unfolds.</p>
        </div>
      </div>

      {items.length === 0 && (
        <div className="text-xs text-slate-400">Findings will appear here as the run progresses.</div>
      )}

      <div className="space-y-10">
        {phaseOrder.map((phase) => {
          const phaseItems = grouped[phase] ?? [];
          if (phaseItems.length === 0) return null;
          return (
            <div key={phase} className="space-y-4" id={`timeline-${phase}`}>
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{phase}</h4>
              <div className="space-y-6 border-l border-slate-200 pl-6">
                {phaseItems.map((item) => {
                  const isEvidenceExpanded = expandedEvidence[item.id];
                  return (
                    <div key={item.id} className="space-y-3" id={`timeline-${item.stepId ?? item.id}`}>
                      <div className="space-y-2">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-slate-800">{item.title}</p>
                            {item.status && (
                              <span className="text-[10px] font-semibold uppercase text-slate-400">{item.status}</span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-600">{item.summary}</p>
                        </div>
                        {item.keyFindings.length > 0 && (
                          <ul className="text-[11px] text-slate-600 list-disc list-inside space-y-1">
                            {item.keyFindings.slice(0, 5).map((finding) => (
                              <li key={finding}>{finding}</li>
                            ))}
                          </ul>
                        )}
                      </div>

                      {((item.evidence?.length ?? 0) > 0 || (item.evidenceRefs?.length ?? 0) > 0) && (
                        <div className="space-y-2">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedEvidence((prev) => ({
                                ...prev,
                                [item.id]: !prev[item.id]
                              }))
                            }
                            className="text-[11px] font-semibold text-slate-500 hover:text-slate-700"
                          >
                            Evidence & citations · {isEvidenceExpanded ? 'Hide' : 'View'}
                          </button>
                          {isEvidenceExpanded && (
                            <div className="space-y-2">
                              {item.evidence && item.evidence.length > 0 && (
                                <div className="space-y-2">
                                  {item.evidence.map((entry) => (
                                    <div key={entry.id} className="rounded-md border border-slate-100 bg-slate-50 px-2 py-1.5">
                                      <p className="text-slate-700">{entry.claim}</p>
                                      {entry.citations.length > 0 && (
                                        <ul className="mt-1 space-y-1 text-[11px] text-slate-500">
                                          {entry.citations.map((citation, index) => (
                                            <li key={`${entry.id}-citation-${index}`}>{formatCitation(citation)}</li>
                                          ))}
                                        </ul>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                              {item.evidenceRefs && item.evidenceRefs.length > 0 && (
                                <div className="space-y-2">
                                  <button
                                    type="button"
                                    onClick={() => onOpenCitations?.({ evidence: item.evidenceRefs })}
                                    className="text-[11px] font-semibold text-weflora-teal hover:text-weflora-dark"
                                  >
                                    Open citations panel
                                  </button>
                                  <ul className="space-y-1 text-[11px] text-slate-500">
                                    {item.evidenceRefs.slice(0, 4).map((entry) => (
                                      <li key={`${entry.sourceId}-${entry.locationHint ?? ''}`}>
                                        {entry.note ?? entry.locationHint ?? entry.sourceId}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {item.artifacts && item.artifacts.length > 0 && (
                        <div className="text-[11px] text-slate-500">
                          Artifacts:{' '}
                          {item.artifacts.map((artifact, index) => (
                            <a
                              key={artifact.href}
                              href={artifact.href}
                              className="text-weflora-teal hover:text-weflora-dark"
                            >
                              {artifact.label}
                              {index < item.artifacts.length - 1 ? ', ' : ''}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default ReasoningTimeline;
