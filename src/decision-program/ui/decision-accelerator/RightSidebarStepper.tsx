import React from 'react';
import type { ExecutionState, DecisionStep, StepState, RunStatus, EvidenceRef, ExecutionLogEntry } from '../../types';
import { deriveReasoningCallouts } from './reasoningUtils';

export type StepperStatus = 'queued' | 'running' | 'done' | 'blocked' | 'error' | 'skipped';

export interface StepperStepViewModel {
  stepId: string;
  title: string;
  kind: string;
  agentRef?: string;
  status: StepperStatus;
  startedAt?: string;
  endedAt?: string;
  durationMs?: number;
  blockingMissingInputs?: string[];
  error?: { message: string; code?: string };
  summary?: string;
  evidenceCount?: number;
  reasoningSummary?: string[];
}

export interface RightSidebarStepperProps {
  runId: string;
  status: RunStatus;
  currentStepId?: string;
  steps: StepperStepViewModel[];
  logs?: ExecutionLogEntry[];
  evidenceIndex?: Record<string, EvidenceRef[]>;
  onResolveBlocked?: (stepId: string) => void;
  onRerunStep?: (stepId: string) => void;
  onCancelRun?: () => void;
  onOpenCitations?: (args: { stepId: string; evidence?: EvidenceRef[] }) => void;
  headerTitle?: string;
  headerSubtitle?: string;
  showRunMeta?: boolean;
  showDebug?: boolean;
  className?: string;
}

type _StepperExecutionState = ExecutionState;
type _StepperDecisionStep = DecisionStep;
type _StepperStepState = StepState;

const statusStyles: Record<StepperStatus, string> = {
  queued: 'text-slate-400',
  running: 'text-orange-500',
  done: 'text-emerald-600',
  blocked: 'text-amber-600',
  error: 'text-rose-600',
  skipped: 'text-slate-300'
};

const statusDotStyles: Record<StepperStatus, string> = {
  queued: 'bg-slate-300',
  running: 'bg-amber-400 animate-pulse',
  done: 'bg-emerald-500',
  blocked: 'bg-amber-400',
  error: 'bg-rose-500',
  skipped: 'bg-slate-200'
};

const phaseOrder = ['site', 'species', 'supply'];

const derivePhase = (stepId: string) => stepId.split(':')[0] ?? 'other';

const RightSidebarStepper: React.FC<RightSidebarStepperProps> = ({
  runId,
  status,
  currentStepId,
  steps,
  onResolveBlocked,
  onRerunStep,
  onCancelRun,
  onOpenCitations,
  headerTitle = 'Planning flow',
  headerSubtitle,
  showRunMeta = true,
  showDebug = false,
  className,
  logs = [],
  evidenceIndex
}) => {
  const [expandedSteps, setExpandedSteps] = React.useState<Record<string, boolean>>({});
  const grouped = steps.reduce<Record<string, StepperStepViewModel[]>>((acc, step) => {
    const phase = derivePhase(step.stepId);
    acc[phase] = acc[phase] ?? [];
    acc[phase].push(step);
    return acc;
  }, {});

  return (
    <aside className={`planning-stepper-scroll w-80 border-l border-slate-200 bg-white p-4 space-y-4 sticky top-0 h-[calc(100vh-96px)] overflow-y-auto ${className ?? ''}`}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">{headerTitle}</h3>
          {showRunMeta && (
            <p className="text-xs text-slate-500">
              {headerSubtitle ?? `Run ${runId} · ${status}`}
            </p>
          )}
        </div>
        {onCancelRun && (
          <button onClick={onCancelRun} className="text-xs text-slate-400 hover:text-slate-600">
            Cancel
          </button>
        )}
      </div>

      <div className="space-y-4">
        {phaseOrder.map((phase) => {
          const phaseSteps = grouped[phase];
          if (!phaseSteps) return null;
          return (
            <div key={phase}>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">{phase}</h4>
              <div className="space-y-3">
                {phaseSteps.map((step) => {
                  const isExpanded = expandedSteps[step.stepId];
                  const evidence = evidenceIndex?.[step.stepId] ?? [];
                  const callouts = deriveReasoningCallouts(step, logs);
                  return (
                    <div key={step.stepId} className="rounded-lg border border-slate-100 p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-start gap-2">
                          <span className={`mt-1 h-2.5 w-2.5 rounded-full ${statusDotStyles[step.status]}`} />
                          <div>
                            <p className="text-xs font-semibold text-slate-700">{step.title}</p>
                            <p className={`text-[10px] uppercase tracking-wide ${statusStyles[step.status]}`}>
                              {step.status}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              setExpandedSteps((prev) => ({
                                ...prev,
                                [step.stepId]: !prev[step.stepId]
                              }))
                            }
                            className="text-[10px] text-slate-400 hover:text-slate-600"
                          >
                            {isExpanded ? 'Hide' : 'Details'}
                          </button>
                        </div>
                      </div>
                      {step.blockingMissingInputs && step.blockingMissingInputs.length > 0 && (
                        <div className="mt-2">
                          <p className="text-[10px] text-amber-600 font-semibold">Missing inputs</p>
                          <ul className="text-[10px] text-slate-500 list-disc list-inside">
                            {step.blockingMissingInputs.map((missing) => (
                              <li key={missing}>{missing}</li>
                            ))}
                          </ul>
                          {onResolveBlocked && (
                            <button
                              onClick={() => onResolveBlocked(step.stepId)}
                              className="mt-2 text-[10px] font-semibold text-amber-700"
                            >
                              Resolve
                            </button>
                          )}
                        </div>
                      )}
                      {isExpanded && (
                        <div className="mt-2 space-y-2">
                          {callouts.length > 0 && (
                            <div>
                              <p className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold">
                                What I did
                              </p>
                              <ul className="text-[11px] text-slate-600 list-disc list-inside">
                                {callouts.map((item) => (
                                  <li key={item}>{item}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                              {step.evidenceCount ?? evidence.length} sources
                            </span>
                            {onOpenCitations && evidence.length > 0 && (
                              <button
                                onClick={() => onOpenCitations({ stepId: step.stepId, evidence })}
                                className="text-[10px] font-semibold text-weflora-teal"
                              >
                                Open citations
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                      {step.error && (
                        <p className="text-[10px] text-rose-600 mt-2">{step.error.message}</p>
                      )}
                      {showDebug && step.durationMs !== undefined && (
                        <p className="text-[10px] text-slate-400 mt-2">Duration {step.durationMs}ms</p>
                      )}
                      {onRerunStep && (
                        <button
                          onClick={() => onRerunStep(step.stepId)}
                          className="mt-2 text-[10px] text-slate-400"
                        >
                          Rerun step
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
};

export default RightSidebarStepper;
