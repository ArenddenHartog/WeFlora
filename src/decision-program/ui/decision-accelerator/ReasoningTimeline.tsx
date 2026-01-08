import React from 'react';
import type { EvidenceRef, ExecutionLogEntry } from '../../types';
import type { StepperStepViewModel } from './RightSidebarStepper';
import { buildReasoningTimelineItems } from './reasoningUtils';

export interface ReasoningTimelineProps {
  steps: StepperStepViewModel[];
  logs: ExecutionLogEntry[];
  evidenceIndex?: Record<string, EvidenceRef[]>;
  onOpenCitations?: (args: { evidence?: EvidenceRef[]; sourceId?: string }) => void;
  className?: string;
}

const ReasoningTimeline: React.FC<ReasoningTimelineProps> = ({ steps, logs, evidenceIndex, onOpenCitations, className }) => {
  const [expandedItems, setExpandedItems] = React.useState<Record<string, boolean>>({});
  const items = buildReasoningTimelineItems(steps, logs, evidenceIndex);

  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-4 space-y-4 ${className ?? ''}`}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Reasoning timeline</h3>
          <p className="text-xs text-slate-500">Narrated findings and rationale</p>
        </div>
      </div>

      <div className="space-y-3">
        {items.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-200 p-4 text-xs text-slate-500">
            Findings will appear here as the run progresses.
          </div>
        )}
        {items.map((item) => {
          const isExpanded = expandedItems[item.id];
          return (
            <div key={item.id} className="rounded-xl border border-slate-100 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-slate-700">{item.title}</p>
                  <p className="text-[11px] text-slate-600 mt-1">{item.summary}</p>
                </div>
                {item.details && item.details.length > 0 && (
                  <button
                    onClick={() =>
                      setExpandedItems((prev) => ({
                        ...prev,
                        [item.id]: !prev[item.id]
                      }))
                    }
                    className="text-[10px] text-slate-400 hover:text-slate-600"
                  >
                    {isExpanded ? 'Hide' : 'Explain'}
                  </button>
                )}
              </div>

              <div className="mt-3 flex items-center gap-2">
                {item.evidence && item.evidence.length > 0 && (
                  <button
                    onClick={() => onOpenCitations?.({ evidence: item.evidence })}
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
                  >
                    Sources · {item.evidence.length}
                  </button>
                )}
              </div>

              {isExpanded && item.details && item.details.length > 0 && (
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-2">
                    Explanation
                  </p>
                  <ul className="space-y-1 text-[11px] text-slate-600 list-disc list-inside">
                    {item.details.map((detail) => (
                      <li key={detail}>{detail}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default ReasoningTimeline;
