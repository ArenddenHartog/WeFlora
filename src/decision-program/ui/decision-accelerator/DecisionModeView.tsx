import React, { useMemo, useRef, useState, useEffect } from 'react';
import type { ExecutionState, DecisionProgram, EvidenceRef } from '../../types';
import type { StepperStepViewModel } from './RightSidebarStepper';
import RightSidebarStepper from './RightSidebarStepper';
import DraftMatrixTable from './DraftMatrixTable';
import ActionCards from './ActionCards';
import { useUI } from '../../../../contexts/UIContext';
import { toCitationsPayload } from '../../orchestrator/evidenceToCitations';
import ReasoningTimeline from './ReasoningTimeline';
import ValidationDrawer from './ValidationDrawer';
import { buildPatchesForInputs } from './actionCardUtils';
import { getByPointer } from '../../runtime/pointers';
import { splitInputsBySeverity } from './validationUtils';
import { showMatrixColumn, toggleMatrixColumnPinned, toggleMatrixColumnVisible } from './draftMatrixUtils';

export interface DecisionModeViewProps {
  program: DecisionProgram;
  state: ExecutionState;
  stepsVM: StepperStepViewModel[];
  onStartRun: () => void;
  onCancelRun?: () => void;
  onOpenCitations?: (args: { rowId: string; columnId: string; evidence?: EvidenceRef[] }) => void;
  onSubmitCard: (args: { cardId: string; cardType: 'deepen' | 'refine' | 'next_step'; input?: Record<string, unknown> }) =>
    Promise<any>;
  onPromoteToWorksheet?: (payload: { matrixId: string; rowIds?: string[] }) => void;
  labels?: {
    startRun?: string;
    promotionSummary?: string;
    promotionMessage?: string;
  };
  stepperTitle?: string;
  stepperSubtitle?: string;
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
  labels,
  stepperTitle,
  stepperSubtitle,
  className
}) => {
  const actionCardsRef = useRef<HTMLDivElement>(null);
  const matrixRef = useRef<HTMLDivElement>(null);
  const { openEvidencePanel, setCitationsFilter, showNotification } = useUI();
  const [localMatrix, setLocalMatrix] = useState(state.draftMatrix);
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [matrixDensity, setMatrixDensity] = useState<'comfortable' | 'compact'>('comfortable');
  const [isValidationOpen, setIsValidationOpen] = useState(false);
  const [validationValues, setValidationValues] = useState<Record<string, string | number | boolean>>({});

  useEffect(() => {
    setLocalMatrix((prev) => {
      if (!state.draftMatrix) return state.draftMatrix;
      if (!prev) return state.draftMatrix;
      const prevById = new Map(prev.columns.map((column) => [column.id, column]));
      const columns = state.draftMatrix.columns.map((column) => {
        const previous = prevById.get(column.id);
        if (!previous) return column;
        return {
          ...column,
          pinned: previous.pinned ?? column.pinned,
          visible: previous.visible ?? column.visible
        };
      });
      return { ...state.draftMatrix, columns };
    });
  }, [state.draftMatrix]);

  useEffect(() => {
    if (!localMatrix) return;
    setSelectedRowIds((prev) => prev.filter((rowId) => localMatrix.rows.some((row) => row.id === rowId)));
  }, [localMatrix]);

  const visibleMatrix = localMatrix ?? state.draftMatrix;
  const suggestedColumns = useMemo(
    () => visibleMatrix?.columns.filter((column) => column.visible === false) ?? [],
    [visibleMatrix]
  );
  const refineCard = useMemo(() => state.actionCards.find((card) => card.type === 'refine'), [state.actionCards]);
  const refineInputs = useMemo(() => refineCard?.inputs ?? [], [refineCard]);
  const { required: requiredInputs, recommended: recommendedInputs, optional: optionalInputs } = useMemo(
    () => splitInputsBySeverity(refineInputs),
    [refineInputs]
  );

  useEffect(() => {
    if (!refineCard) return;
    setValidationValues((prev) => {
      const next = { ...prev };
      refineInputs.forEach((input) => {
        if (next[input.id] !== undefined) return;
        const existingValue = getByPointer(state, input.pointer);
        if (existingValue !== undefined) {
          next[input.id] = existingValue as string | number | boolean;
        }
      });
      return next;
    });
  }, [refineCard, refineInputs, state]);

  const handleOpenCitations = (args: { rowId: string; columnId: string; evidence?: EvidenceRef[] }) => {
    const evidence = args.evidence ?? [];
    const payload = toCitationsPayload(evidence, { selectedDocs: state.context.selectedDocs });
    if (payload.sourceIds.length === 0) {
      showNotification('No citations available for this cell.', 'error');
      return;
    }
    setCitationsFilter({ sourceIds: payload.sourceIds });
    openEvidencePanel({
      label: `Draft Matrix citations • ${args.columnId}`,
      sources: payload.sourceIds,
      generatedAt: new Date().toISOString()
    });
    onOpenCitations?.(args);
  };

  const handleOpenStepCitations = (args: { evidence?: EvidenceRef[]; label?: string }) => {
    const evidence = args.evidence ?? [];
    const payload = toCitationsPayload(evidence, { selectedDocs: state.context.selectedDocs });
    if (payload.sourceIds.length === 0) {
      showNotification('No citations available for this step.', 'error');
      return;
    }
    setCitationsFilter({ sourceIds: payload.sourceIds });
    openEvidencePanel({
      label: args.label ?? 'Step citations',
      sources: payload.sourceIds,
      generatedAt: new Date().toISOString()
    });
  };

  const updateMatrix = (updater: (matrix: NonNullable<ExecutionState['draftMatrix']>) => NonNullable<ExecutionState['draftMatrix']>) => {
    setLocalMatrix((prev) => {
      if (!prev) return prev;
      return updater(prev);
    });
  };

  const handleToggleColumnPinned = (columnId: string) => {
    updateMatrix((matrix) => toggleMatrixColumnPinned(matrix, columnId));
  };

  const handleToggleColumnVisible = (columnId: string) => {
    updateMatrix((matrix) => toggleMatrixColumnVisible(matrix, columnId));
  };

  const handleAddColumn = (columnId: string) => {
    updateMatrix((matrix) => showMatrixColumn(matrix, columnId));
  };

  const handleToggleRowSelected = (rowId: string) => {
    setSelectedRowIds((prev) => (prev.includes(rowId) ? prev.filter((id) => id !== rowId) : [...prev, rowId]));
  };

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
              {labels?.startRun ?? 'Start Decision Run'}
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <ReasoningTimeline
            runId={state.runId}
            steps={stepsVM}
            logs={state.logs}
            evidenceIndex={state.evidenceIndex}
            onOpenCitations={(args) => handleOpenStepCitations({ evidence: args.evidence, label: 'Step citations' })}
          />

          {visibleMatrix ? (
            <div ref={matrixRef}>
              <DraftMatrixTable
                matrix={visibleMatrix}
                onOpenCitations={handleOpenCitations}
                onToggleColumnPinned={handleToggleColumnPinned}
                onToggleColumnVisible={handleToggleColumnVisible}
                onAddColumn={handleAddColumn}
                onDensityChange={setMatrixDensity}
                suggestedColumns={suggestedColumns}
                selectedRowIds={selectedRowIds}
                onToggleRowSelected={handleToggleRowSelected}
                onPromoteToWorksheet={undefined}
                density={matrixDensity}
                showCellRationale
                showConfidence
              />
            </div>
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
              onOpenValidation={() => setIsValidationOpen(true)}
              layout="grid"
              showTypeBadges={false}
            />
          </div>
        </div>
      </div>

      <RightSidebarStepper
        runId={state.runId}
        status={state.status}
        currentStepId={state.currentStepId}
        steps={stepsVM}
        logs={state.logs}
        evidenceIndex={state.evidenceIndex}
        onCancelRun={onCancelRun}
        onResolveBlocked={() => setIsValidationOpen(true)}
        onOpenCitations={(args) => handleOpenStepCitations({ evidence: args.evidence, label: `Step citations • ${args.stepId}` })}
        headerTitle={stepperTitle}
        headerSubtitle={stepperSubtitle}
        showDebug={false}
      />

      {refineCard && (
        <ValidationDrawer
          isOpen={isValidationOpen}
          title="Resolve inputs"
          requiredInputs={requiredInputs}
          recommendedInputs={recommendedInputs}
          optionalInputs={optionalInputs}
          values={validationValues}
          onChange={(inputId, value) => setValidationValues((prev) => ({ ...prev, [inputId]: value }))}
          onApply={() => {
            if (!refineCard) return;
            const patches = buildPatchesForInputs(refineInputs, validationValues);
            onSubmitCard({
              cardId: refineCard.id,
              cardType: 'refine',
              input: {
                action: 'refine:continue',
                patches
              }
            });
            setIsValidationOpen(false);
          }}
          onApplyDefaults={
            refineCard.suggestedActions?.some((action) => action.action === 'refine:apply-defaults')
              ? () => {
                  onSubmitCard({
                    cardId: refineCard.id,
                    cardType: 'refine',
                    input: { action: 'refine:apply-defaults' }
                  });
                  setIsValidationOpen(false);
                }
              : undefined
          }
          onClose={() => setIsValidationOpen(false)}
          canProceedWithMissingRecommended
        />
      )}
    </div>
  );
};

export default DecisionModeView;
