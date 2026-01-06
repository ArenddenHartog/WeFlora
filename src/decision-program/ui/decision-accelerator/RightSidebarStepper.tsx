import React from 'react';
import type { ExecutionState, DecisionStep, StepState, RunStatus } from '../../types';

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
}

export interface RightSidebarStepperProps {
  runId: string;
  status: RunStatus;
  currentStepId?: string;
  steps: StepperStepViewModel[];
  onResolveBlocked?: (stepId: string) => void;
  onRerunStep?: (stepId: string) => void;
  onCancelRun?: () => void;
  showDebug?: boolean;
  className?: string;
}

type _StepperExecutionState = ExecutionState;
type _StepperDecisionStep = DecisionStep;
type _StepperStepState = StepState;

const statusStyles: Record<StepperStatus, string> = {
  queued: 'text-slate-400',
  running: 'text-weflora-teal',
  done: 'text-emerald-600',
  blocked: 'text-amber-600',
  error: 'text-rose-600',
  skipped: 'text-slate-300'
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
  showDebug = false,
  className
}) => {
  const grouped = steps.reduce<Record<string, StepperStepViewModel[]>>((acc, step) => {
    const phase = derivePhase(step.stepId);
    acc[phase] = acc[phase] ?? [];
    acc[phase].push(step);
    return acc;
  }, {});

  return (
    <aside className={`w-80 border-l border-slate-200 bg-white p-4 space-y-4 ${className ?? ''}`}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Decision Accelerator</h3>
          <p className="text-xs text-slate-500">Run {runId} · {status}</p>
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
                {phaseSteps.map((step) => (
                  <div key={step.stepId} className="rounded-lg border border-slate-100 p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold text-slate-700">{step.title}</p>
                        <p className={`text-[10px] uppercase tracking-wide ${statusStyles[step.status]}`}>
                          {step.status}
                        </p>
                      </div>
                      {currentStepId === step.stepId && (
                        <span className="text-[10px] text-weflora-teal font-semibold">Active</span>
                      )}
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
                            Resolve inputs
                          </button>
                        )}
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
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
};

export default RightSidebarStepper;
