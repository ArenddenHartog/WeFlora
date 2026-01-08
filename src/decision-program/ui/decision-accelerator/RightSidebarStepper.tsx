import React from 'react';
import type { ExecutionState, DecisionStep, StepState, RunStatus, EvidenceRef, ExecutionLogEntry, Phase } from '../../types';
import { CheckIcon, XIcon, FlowerIcon } from '../../../../components/icons';

export type StepperStatus = 'queued' | 'running' | 'done' | 'blocked' | 'error' | 'skipped';

export interface StepperStepViewModel {
  stepId: string;
  title: string;
  kind: string;
  phase: Phase;
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
  producesPointers?: string[];
}

export interface RightSidebarStepperProps {
  runId?: string;
  status?: RunStatus;
  currentStepId?: string;
  steps: StepperStepViewModel[];
  logs?: ExecutionLogEntry[];
  evidenceIndex?: Record<string, EvidenceRef[]>;
  onResolveBlocked?: (stepId: string) => void;
  onRerunStep?: (stepId: string) => void;
  onCancelRun?: () => void;
  onOpenCitations?: (args: { stepId: string; evidence?: EvidenceRef[] }) => void;
  onStepSelect?: (stepId: string) => void;
  headerTitle?: string;
  headerSubtitle?: string;
  showRunMeta?: boolean;
  showDebug?: boolean;
  className?: string;
}

type _StepperExecutionState = ExecutionState;
type _StepperDecisionStep = DecisionStep;
type _StepperStepState = StepState;

const statusDotStyles: Record<StepperStatus, string> = {
  queued: 'bg-slate-300',
  running: 'border-weflora-teal',
  done: 'bg-emerald-500',
  blocked: 'bg-amber-400',
  error: 'bg-rose-500',
  skipped: 'bg-slate-200'
};

const phaseOrder: Phase[] = ['site', 'species', 'supply'];

const shouldHideLogMessage = (message: string) =>
  /agent completed|queued for execution|execution state created|step blocked/i.test(message);

const formatSubstepLabel = (message: string) => message.replace(/\.$/, '');

const buildSubsteps = (
  step: StepperStepViewModel,
  logs: ExecutionLogEntry[] = []
): Array<{ label: string; status: StepperStatus }> => {
  const stepLogs = logs
    .filter((entry) => entry.data?.stepId === step.stepId)
    .map((entry) => entry.message)
    .filter((message) => !shouldHideLogMessage(message));

  const uniqueLogs = stepLogs.filter((message, index, arr) => arr.indexOf(message) === index);
  const derived = uniqueLogs.map((message) => ({
    label: formatSubstepLabel(message),
    status: step.status === 'running' ? 'running' : step.status === 'done' ? 'done' : step.status
  }));

  if (derived.length > 0) {
    if (step.status === 'running') {
      return derived.map((item, index) => ({
        ...item,
        status: index === derived.length - 1 ? 'running' : 'done'
      }));
    }
    return derived;
  }

  if (step.status === 'blocked') {
    return [
      {
        label: 'Waiting for required inputs',
        status: 'blocked'
      }
    ];
  }

  return [];
};

const RightSidebarStepper: React.FC<RightSidebarStepperProps> = ({
  steps,
  logs,
  headerTitle = 'Planning flow',
  onStepSelect,
  className
}) => {
  const grouped = steps.reduce<Record<string, StepperStepViewModel[]>>((acc, step) => {
    const phase = step.phase;
    acc[phase] = acc[phase] ?? [];
    acc[phase].push(step);
    return acc;
  }, {});

  return (
    <aside
      className={`planning-stepper-scroll w-80 border-l border-slate-200 bg-white px-4 py-6 space-y-6 sticky top-0 h-[calc(100vh-96px)] overflow-y-auto ${className ?? ''}`}
    >
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-slate-800">{headerTitle}</h3>
        <p className="text-[11px] text-slate-400">Live planning state</p>
      </div>

      {steps.length === 0 && (
        <div className="text-xs text-slate-400">
          Planning steps will appear here once the run begins.
        </div>
      )}

      <div className="space-y-6">
        {phaseOrder.map((phase) => {
          const phaseSteps = grouped[phase];
          if (!phaseSteps || phaseSteps.length === 0) return null;
          return (
            <div key={phase} className="space-y-3">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{phase}</h4>
              <div className="space-y-3">
                {phaseSteps.map((step) => {
                  const substeps = buildSubsteps(step, logs);
                  return (
                    <div key={step.stepId} className="space-y-2">
                      <button
                        type="button"
                        onClick={() => onStepSelect?.(step.stepId)}
                        className="flex w-full items-start gap-3 text-left"
                      >
                        <span className="mt-1 flex h-4 w-4 items-center justify-center">
                          {step.status === 'done' && <CheckIcon className="h-3.5 w-3.5 text-emerald-500" />}
                          {step.status === 'error' && <XIcon className="h-3.5 w-3.5 text-rose-500" />}
                          {step.status === 'running' && (
                            <span className="h-3.5 w-3.5 rounded-full border-2 border-weflora-teal border-t-transparent animate-spin" />
                          )}
                          {step.status === 'queued' && (
                            <span className={`h-2.5 w-2.5 rounded-full ${statusDotStyles[step.status]}`} />
                          )}
                          {step.status === 'blocked' && (
                            <span className={`h-2.5 w-2.5 rounded-full ${statusDotStyles[step.status]}`} />
                          )}
                          {step.status === 'skipped' && (
                            <span className={`h-2.5 w-2.5 rounded-full ${statusDotStyles[step.status]}`} />
                          )}
                        </span>
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-slate-700">{step.title}</p>
                          {step.status === 'running' && (
                            <p className="text-[11px] text-weflora-teal">Working…</p>
                          )}
                          {step.status === 'blocked' && (
                            <p className="text-[11px] text-amber-600">Needs input</p>
                          )}
                          {step.status === 'error' && (
                            <p className="text-[11px] text-rose-600">Needs review</p>
                          )}
                        </div>
                        {step.status === 'running' && (
                          <span className="mt-1 text-weflora-teal/70">
                            <FlowerIcon className="h-3 w-3 opacity-70" />
                          </span>
                        )}
                      </button>
                      {substeps.length > 0 && (
                        <div className="space-y-1 pl-7">
                          {substeps.map((substep) => (
                            <div key={substep.label} className="flex items-center gap-2 text-[11px] text-slate-500">
                              <span className="flex h-2 w-2 items-center justify-center">
                                {substep.status === 'done' && <CheckIcon className="h-2.5 w-2.5 text-emerald-500" />}
                                {substep.status === 'error' && <XIcon className="h-2.5 w-2.5 text-rose-500" />}
                                {substep.status === 'running' && (
                                  <span className="h-2 w-2 rounded-full border border-weflora-teal border-t-transparent animate-spin" />
                                )}
                                {(substep.status === 'queued' || substep.status === 'blocked') && (
                                  <span className={`h-1.5 w-1.5 rounded-full ${statusDotStyles[substep.status]}`} />
                                )}
                              </span>
                              <span className={substep.status === 'running' ? 'text-weflora-teal' : ''}>
                                {substep.label}
                              </span>
                            </div>
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
    </aside>
  );
};

export default RightSidebarStepper;
