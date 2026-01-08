import React from 'react';
import type { ExecutionState, DecisionStep, StepState, RunStatus, EvidenceRef, ExecutionLogEntry } from '../../types';
import { CheckIcon, XIcon } from '../../../../components/icons';

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
  running: 'border-amber-400',
  done: 'bg-emerald-500',
  blocked: 'bg-amber-400',
  error: 'bg-rose-500',
  skipped: 'bg-slate-200'
};

const phaseOrder = ['site', 'species', 'supply'];

const derivePhase = (stepId: string) => stepId.split(':')[0] ?? 'other';

const STEP_SUBSTEPS: Record<string, string[]> = {
  'site:derive-site-constraints': ['Analyzing site inputs', 'Deriving constraints', 'Summarizing fit signals'],
  'species:generate-candidates': ['Analyzing documents', 'Generating candidate list', 'Summarizing shortlist'],
  'species:score-candidates': ['Evaluating constraints', 'Scoring candidates', 'Summarizing results'],
  'species:diversity-check': ['Checking diversity rules', 'Identifying gaps', 'Summarizing compliance'],
  'supply:availability-reconcile': ['Reviewing supply inputs', 'Matching availability', 'Summarizing supply fit']
};

const defaultSubsteps = ['Analyzing inputs', 'Synthesizing evidence', 'Summarizing outputs'];

const getSubsteps = (stepId: string) => STEP_SUBSTEPS[stepId] ?? defaultSubsteps;

const deriveSubstepStatuses = (status: StepperStatus, count: number) => {
  if (status === 'done') return Array.from({ length: count }, () => 'done' as const);
  if (status === 'running') return Array.from({ length: count }, (_, index) => (index === 0 ? 'running' : 'queued'));
  if (status === 'blocked') return Array.from({ length: count }, (_, index) => (index === 0 ? 'blocked' : 'queued'));
  if (status === 'error') return Array.from({ length: count }, (_, index) => (index === 0 ? 'error' : 'queued'));
  return Array.from({ length: count }, () => 'queued' as const);
};

const RightSidebarStepper: React.FC<RightSidebarStepperProps> = ({ steps, headerTitle = 'Planning flow', className }) => {
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
        </div>
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
                  const substeps = getSubsteps(step.stepId);
                  const substepStatuses = deriveSubstepStatuses(step.status, substeps.length);
                  return (
                    <div key={step.stepId} className="rounded-lg border border-slate-100 p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-start gap-2">
                          <span className="mt-1 flex h-3 w-3 items-center justify-center">
                            {step.status === 'done' && <CheckIcon className="h-3 w-3 text-emerald-500" />}
                            {step.status === 'error' && <XIcon className="h-3 w-3 text-rose-500" />}
                            {step.status === 'running' && (
                              <span className="h-3 w-3 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
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
                          <div>
                            <p className="text-xs font-semibold text-slate-700">{step.title}</p>
                            {step.status === 'blocked' && (
                              <p className="text-[10px] uppercase tracking-wide text-amber-600">Needs input</p>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 space-y-2">
                        {substeps.map((substep, index) => {
                          const subStatus = substepStatuses[index];
                          return (
                            <div key={substep} className="flex items-center gap-2 text-[11px] text-slate-500">
                              <span className="flex h-2 w-2 items-center justify-center">
                                {subStatus === 'done' && <CheckIcon className="h-2.5 w-2.5 text-emerald-500" />}
                                {subStatus === 'error' && <XIcon className="h-2.5 w-2.5 text-rose-500" />}
                                {subStatus === 'running' && (
                                  <span className="h-2 w-2 rounded-full border border-amber-400 border-t-transparent animate-spin" />
                                )}
                                {(subStatus === 'queued' || subStatus === 'blocked') && (
                                  <span className={`h-1.5 w-1.5 rounded-full ${statusDotStyles[subStatus]}`} />
                                )}
                              </span>
                              <span className={subStatus === 'running' ? 'text-amber-600' : ''}>{substep}</span>
                            </div>
                          );
                        })}
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
