import React from 'react';
import type { ExecutionState, DecisionStep, StepState, RunStatus, EvidenceRef, ExecutionLogEntry, Phase } from '../../types';
import { CheckIcon, XIcon, FlowerIcon } from '../../../../components/icons';
import { flowLine, flowStepDone, flowStepActive, flowStepBlocked } from '../../../../src/ui/tokens';

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
      className={`planning-stepper-scroll w-80 border-l border-slate-100 bg-white px-4 py-6 space-y-6 sticky top-0 h-[calc(100vh-96px)] overflow-y-auto ${className ?? ''}`}
    >
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-slate-800">{headerTitle}</h3>
        <p className="text-[11px] text-slate-500">Live planning state</p>
      </div>

      {steps.length === 0 && (
        <div className="text-xs text-slate-500">
          Planning steps will appear here once the run begins.
        </div>
      )}

      <div className="space-y-6">
        {phaseOrder.map((phase) => {
          const phaseSteps = grouped[phase];
          if (!phaseSteps || phaseSteps.length === 0) return null;
          return (
            <div key={phase} className="space-y-3">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{phase}</h4>
              <div className={`relative pl-5 ${flowLine}`}>
                {phaseSteps.map((step) => {
                  const substeps = buildSubsteps(step, logs);
                  const isActive = step.status === 'running';
                  const isDone = step.status === 'done';
                  const isBlocked = step.status === 'blocked';
                  const isError = step.status === 'error';

                  return (
                    <div key={step.stepId} className="relative flex gap-4 pb-6 last:pb-0">
                      {/* Timeline marker */}
                      <span
                        className={`absolute left-0 -translate-x-[calc(0.5rem+3px)] flex h-4 w-4 items-center justify-center rounded-full border-2 z-10
                          ${isActive ? 'border-weflora-teal bg-white ring-2 ring-white' : ''}
                          ${isDone ? 'bg-weflora-teal border-weflora-teal' : ''}
                          ${isBlocked ? 'bg-weflora-amber border-weflora-amber' : ''}
                          ${isError ? 'bg-weflora-rose border-weflora-rose' : ''}
                          ${step.status === 'queued' || step.status === 'skipped' ? 'bg-slate-200 border-slate-200' : ''}
                        `}
                      >
                        {isDone && <CheckIcon className="h-2.5 w-2.5 text-white" />}
                        {isError && <XIcon className="h-2.5 w-2.5 text-white" />}
                      </span>

                      {/* Step card */}
                      <div className="flex-1 min-w-0 space-y-2">
                        <button
                          type="button"
                          onClick={() => onStepSelect?.(step.stepId)}
                          className={`w-full text-left transition-colors rounded-lg px-4 py-3
                            ${isActive ? flowStepActive : ''}
                            ${isDone ? `${flowStepDone} hover:bg-slate-50/80` : ''}
                            ${isBlocked ? flowStepBlocked : ''}
                            ${isError ? 'border border-weflora-rose/40 bg-weflora-redLight' : ''}
                            ${step.status === 'queued' || step.status === 'skipped' ? 'bg-slate-50/50 border border-slate-100' : ''}
                          `}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className={`text-xs font-semibold truncate ${isActive ? 'text-white' : 'text-slate-700'}`}>
                              {step.title}
                            </p>
                            {isActive && (
                              <span className="flex-shrink-0 text-white/90">
                                <FlowerIcon className="h-3 w-3" />
                              </span>
                            )}
                          </div>
                          {isActive && (
                            <p className="mt-0.5 text-[11px] text-white/90">Working…</p>
                          )}
                          {isBlocked && (
                            <p className="mt-0.5 text-[11px] text-weflora-amberDark">Needs input</p>
                          )}
                          {isError && (
                            <p className="mt-0.5 text-[11px] text-weflora-redDark">Needs review</p>
                          )}
                        </button>
                        {substeps.length > 0 && (
                          <div className="space-y-1 pl-2">
                            {substeps.map((substep) => (
                              <div key={substep.label} className="flex items-center gap-2 text-[11px] text-slate-500">
                                <span className="flex h-2 w-2 items-center justify-center flex-shrink-0">
                                  {substep.status === 'done' && <CheckIcon className="h-2.5 w-2.5 text-weflora-teal" />}
                                  {substep.status === 'error' && <XIcon className="h-2.5 w-2.5 text-weflora-rose" />}
                                  {substep.status === 'running' && (
                                    <span className="h-2 w-2 rounded-full border border-weflora-teal border-t-transparent animate-spin" />
                                  )}
                                  {(substep.status === 'queued' || substep.status === 'blocked') && (
                                    <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
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
