import React, { useRef } from 'react';
import type { ExecutionState, DecisionProgram } from '../../types';
import type { StepperStepViewModel } from './RightSidebarStepper';
import RightSidebarStepper from './RightSidebarStepper';
import DraftMatrixTable from './DraftMatrixTable';
import ActionCards from './ActionCards';

export interface DecisionModeViewProps {
  program: DecisionProgram;
  state: ExecutionState;
  stepsVM: StepperStepViewModel[];
  onStartRun: () => void;
  onCancelRun?: () => void;
  onOpenCitations?: (args: { rowId: string; columnId: string; evidence?: any[] }) => void;
  onSubmitCard: (args: { cardId: string; cardType: 'deepen' | 'refine' | 'next_step'; input?: Record<string, unknown> }) =>
    Promise<any>;
  onPromoteToWorksheet?: (payload: { matrixId: string; rowIds?: string[] }) => void;
  className?: string;
}

const DecisionModeView: React.FC<DecisionModeViewProps> = ({
  program,
  state,
  stepsVM,
  onStartRun,
  onCancelRun,
  onOpenCitations,
  onSubmitCard,
  onPromoteToWorksheet,
  className
}) => {
  const actionCardsRef = useRef<HTMLDivElement>(null);

  return (
    <div className={`flex h-full bg-slate-50 ${className ?? ''}`}>
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">{program.title}</h2>
            <p className="text-xs text-slate-500">Status: {state.status}</p>
          </div>
          {state.status === 'idle' && (
            <button
              onClick={onStartRun}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-weflora-teal text-white hover:bg-weflora-dark"
            >
              Start Decision Run
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {state.draftMatrix ? (
            <DraftMatrixTable
              matrix={state.draftMatrix}
              onOpenCitations={onOpenCitations}
              onPromoteToWorksheet={onPromoteToWorksheet}
              showCellRationale
            />
          ) : (
            <div className="border border-dashed border-slate-200 rounded-xl p-6 bg-white text-center text-sm text-slate-500">
              No draft matrix yet. Start the run or resolve missing inputs.
            </div>
          )}

          <div ref={actionCardsRef}>
            <ActionCards
              runId={state.runId}
              cards={state.actionCards}
              blockedStepId={state.steps.find((step) => step.status === 'blocked')?.stepId}
              onSubmitCard={onSubmitCard}
              layout="grid"
              showTypeBadges
            />
          </div>
        </div>
      </div>

      <RightSidebarStepper
        runId={state.runId}
        status={state.status}
        currentStepId={state.currentStepId}
        steps={stepsVM}
        onCancelRun={onCancelRun}
        onResolveBlocked={() => actionCardsRef.current?.scrollIntoView({ behavior: 'smooth' })}
        showDebug={false}
      />
    </div>
  );
};

export default DecisionModeView;
