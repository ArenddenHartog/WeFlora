import React from 'react';
import type { EvidenceRef, ExecutionLogEntry } from '../../types';
import type { StepperStepViewModel, StepperStatus } from './RightSidebarStepper';
import { deriveReasoningCallouts, deriveRationaleDetails } from './reasoningUtils';

export interface ReasoningTimelineProps {
  runId: string;
  steps: StepperStepViewModel[];
  logs: ExecutionLogEntry[];
  evidenceIndex?: Record<string, EvidenceRef[]>;
  onOpenCitations?: (args: { evidence?: EvidenceRef[]; sourceId?: string }) => void;
  className?: string;
}

const statusDotStyles: Record<StepperStatus, string> = {
  queued: 'bg-slate-300',
  running: 'bg-amber-400 animate-pulse',
  done: 'bg-emerald-500',
  blocked: 'bg-amber-400',
  error: 'bg-rose-500',
  skipped: 'bg-slate-200'
};

const statusLabelStyles: Record<StepperStatus, string> = {
  queued: 'text-slate-400',
  running: 'text-orange-500',
  done: 'text-emerald-600',
  blocked: 'text-amber-600',
  error: 'text-rose-600',
  skipped: 'text-slate-300'
};

const phaseOrder = ['site', 'species', 'supply', 'other'];
const phaseLabels: Record<string, string> = {
  site: 'Site',
  species: 'Species',
  supply: 'Supply',
  other: 'Other'
};

const derivePhase = (stepId: string) => stepId.split(':')[0] ?? 'other';

const ReasoningTimeline: React.FC<ReasoningTimelineProps> = ({
  runId,
  steps,
  logs,
  evidenceIndex,
  onOpenCitations,
  className
}) => {
  const [expandedSteps, setExpandedSteps] = React.useState<Record<string, boolean>>({});
  const grouped = steps.reduce<Record<string, StepperStepViewModel[]>>((acc, step) => {
    const phase = derivePhase(step.stepId);
    acc[phase] = acc[phase] ?? [];
    acc[phase].push(step);
    return acc;
  }, {});

  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-4 space-y-4 ${className ?? ''}`}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Reasoning timeline</h3>
          <p className="text-xs text-slate-500">Run {runId}</p>
        </div>
        <span className="text-[10px] uppercase tracking-wide text-slate-400">Autonomy</span>
      </div>

      <div className="space-y-5">
        {phaseOrder.map((phase) => {
          const phaseSteps = grouped[phase];
          if (!phaseSteps) return null;
          return (
            <div key={phase} className="space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                {phaseLabels[phase] ?? phase}
              </p>
              <div className="space-y-3">
                {phaseSteps.map((step) => {
                  const callouts = deriveReasoningCallouts(step, logs);
                  const evidence = evidenceIndex?.[step.stepId] ?? [];
                  const details = deriveRationaleDetails(step, logs);
                  const isExpanded = expandedSteps[step.stepId];
                  return (
                    <div key={step.stepId} className="rounded-xl border border-slate-100 px-4 py-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <span className={`mt-1 h-2.5 w-2.5 rounded-full ${statusDotStyles[step.status]}`} />
                          <div>
                            <p className="text-xs font-semibold text-slate-700">{step.title}</p>
                            <p className={`text-[10px] uppercase tracking-wide ${statusLabelStyles[step.status]}`}>
                              {step.status}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() =>
                            setExpandedSteps((prev) => ({
                              ...prev,
                              [step.stepId]: !prev[step.stepId]
                            }))
                          }
                          className="text-[10px] text-slate-400 hover:text-slate-600"
                        >
                          {isExpanded ? 'Hide' : 'View rationale'}
                        </button>
                      </div>

                      {callouts.length > 0 && (
                        <ul className="mt-2 space-y-1 text-[11px] text-slate-600 list-disc list-inside">
                          {callouts.map((callout) => (
                            <li key={callout}>{callout}</li>
                          ))}
                        </ul>
                      )}

                      <div className="mt-3 flex items-center gap-2">
                        {evidence.length > 0 && (
                          <button
                            onClick={() => onOpenCitations?.({ evidence })}
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
                          >
                            {evidence.length} sources
                          </button>
                        )}
                        {step.blockingMissingInputs && step.blockingMissingInputs.length > 0 && (
                          <span className="text-[10px] font-semibold text-amber-600">Missing inputs</span>
                        )}
                      </div>

                      {isExpanded && details.length > 0 && (
                        <div className="mt-3 border-t border-slate-100 pt-3">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-2">
                            Rationale
                          </p>
                          <ul className="space-y-1 text-[11px] text-slate-600 list-disc list-inside">
                            {details.map((detail) => (
                              <li key={detail}>{detail}</li>
                            ))}
                          </ul>
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
