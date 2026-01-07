import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { ExecutionState } from '../../src/decision-program/types';
import PlanningRunnerView from './PlanningRunnerView';
import { buildProgram } from '../../src/decision-program/orchestrator/buildProgram';
import { buildActionCards } from '../../src/decision-program/orchestrator/buildActionCards';
import { buildDefaultPatchesForPointers, buildDefaultsLogEntry } from '../../src/decision-program/orchestrator/pointerInputRegistry';
import { planRun } from '../../src/decision-program/orchestrator/planRun';
import { runAgentStep } from '../../src/decision-program/orchestrator/runAgentStep';
import { buildAgentRegistry } from '../../src/decision-program/agents/registry';
import { setByPointer } from '../../src/decision-program/runtime/pointers';
import { buildRouteLogEntry, handleRouteAction } from '../../src/decision-program/ui/decision-accelerator/routeHandlers';
import { buildWorksheetTableFromDraftMatrix } from '../../src/decision-program/orchestrator/evidenceToCitations';
import RightSidebarStepper from '../../src/decision-program/ui/decision-accelerator/RightSidebarStepper';
import { useUI } from '../../contexts/UIContext';
import { useChat } from '../../contexts/ChatContext';
import { useProject } from '../../contexts/ProjectContext';
import { ChevronRightIcon, FlowerIcon } from '../icons';

const PlanningView: React.FC = () => {
  const navigate = useNavigate();
  const params = useParams();
  const program = useMemo(() => buildProgram(), []);
  const agentRegistry = useMemo(() => buildAgentRegistry(), []);
  const { showNotification } = useUI();
  const { planningRuns, upsertPlanningRun } = useChat();
  const { createMatrix } = useProject();
  const planningRunId = params.runId;
  const projectId = params.projectId ?? null;
  const defaultPlanningContext = useMemo(
    () => ({
      site: {},
      regulatory: {},
      equity: {},
      species: {},
      supply: {},
      selectedDocs: [] as any[]
    }),
    []
  );
  const [planningState, setPlanningState] = useState<ExecutionState | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    if (!planningRunId) return;
    const existing = planningRuns.find((run) => run.runId === planningRunId);
    if (existing?.executionState) {
      setPlanningState(existing.executionState);
    }
  }, [planningRunId, planningRuns]);

  useEffect(() => {
    if (!planningState) return;
    const timeout = window.setTimeout(() => {
      upsertPlanningRun({
        runId: planningState.runId,
        programId: planningState.programId,
        executionState: planningState,
        status: planningState.status,
        projectId
      });
    }, 600);
    return () => window.clearTimeout(timeout);
  }, [planningState, projectId, upsertPlanningRun]);

  const withActionCards = useCallback((state: ExecutionState) => ({
    ...state,
    actionCards: buildActionCards(state)
  }), []);

  const startPlanningRun = useCallback(async () => {
    setIsStarting(true);
    const planned = withActionCards(planRun(program, defaultPlanningContext));
    setPlanningState(planned);
    navigate(`/planning/${planned.runId}`);
    const stepped = await runAgentStep(planned, program, agentRegistry);
    setPlanningState(withActionCards(stepped));
    setIsStarting(false);
  }, [agentRegistry, defaultPlanningContext, program, withActionCards, navigate]);

  const stepsVM = useMemo(() => {
    const evidenceIndex = planningState?.evidenceIndex ?? {};
    if (!planningState) {
      return program.steps.map((step) => ({
        stepId: step.id,
        title: step.title,
        kind: step.kind,
        agentRef: step.agentRef,
        status: 'queued' as const,
        summary: 'Waiting to start this step.',
        evidenceCount: 0
      }));
    }
    return program.steps.map(step => {
      const stepState = planningState.steps.find(candidate => candidate.stepId === step.id);
      const startedAt = stepState?.startedAt;
      const endedAt = stepState?.endedAt;
      const durationMs =
        startedAt && endedAt
          ? new Date(endedAt).getTime() - new Date(startedAt).getTime()
          : undefined;
      const relatedLogs = planningState.logs.filter((entry) => entry.data?.stepId === step.id);
      const summary =
        relatedLogs[relatedLogs.length - 1]?.message ??
        (stepState?.status === 'blocked'
          ? 'Waiting for missing required inputs.'
          : stepState?.status === 'done'
              ? 'Completed with current inputs.'
              : stepState?.status === 'running'
                  ? 'Executing agents and gathering evidence.'
                  : 'Queued for execution.');
      return {
        stepId: step.id,
        title: step.title,
        kind: step.kind,
        agentRef: step.agentRef,
        status: (stepState?.status ?? 'queued') as any,
        startedAt,
        endedAt,
        durationMs,
        blockingMissingInputs: stepState?.blockingMissingInputs,
        error: stepState?.error,
        summary,
        reasoningSummary: stepState?.reasoningSummary,
        evidenceCount: evidenceIndex[step.id]?.length ?? 0
      };
    });
  }, [planningState, program.steps]);

  const promoteToWorksheet = useCallback(async () => {
    if (!planningState?.draftMatrix) return;
    const hasEvidence = planningState.draftMatrix.rows.some((row) =>
      row.cells.some((cell) => (cell.evidence ?? []).length > 0)
    );
    const includeCitations = hasEvidence ? window.confirm('Include citations column?') : false;
    const { columns, rows } = buildWorksheetTableFromDraftMatrix(planningState.draftMatrix, {
      includeCitations
    });
    const worksheetColumns = columns.map((title, index) => ({
      id: `col-${index + 1}`,
      title,
      type: 'text' as const,
      width: 200,
      isPrimaryKey: index === 0
    }));
    const worksheetRows = rows.map((row, rowIndex) => ({
      id: `row-${Date.now()}-${rowIndex}`,
      entityName: row[0] ?? '',
      cells: worksheetColumns.reduce((acc, column, colIndex) => {
        acc[column.id] = { columnId: column.id, value: row[colIndex] ?? '' };
        return acc;
      }, {} as Record<string, { columnId: string; value: string | number }>)
    }));
    const created = await createMatrix({
      id: `mtx-${Date.now()}`,
      title: planningState.draftMatrix.title ?? 'Draft Matrix',
      description: 'Planning matrix promotion',
      columns: worksheetColumns,
      rows: worksheetRows,
      projectId: projectId ?? undefined
    });
    if (!created?.id) {
      showNotification('Worksheet creation not implemented', 'error');
      return;
    }
    showNotification('Worksheet created', 'success');
    navigate(`/worksheets/${created.id}`);
  }, [createMatrix, navigate, planningState?.draftMatrix, projectId, showNotification]);

  const handleSubmitActionCard = useCallback(
    async ({ cardId, cardType, input }: { cardId: string; cardType: 'deepen' | 'refine' | 'next_step'; input?: Record<string, unknown> }) => {
      const action = typeof (input as any)?.action === 'string' ? ((input as any).action as string) : null;
      let patches = Array.isArray((input as any)?.patches)
        ? ((input as any).patches as Array<{ pointer: string; value: unknown }>)
        : [];
      const contextPatch = input && (input as any).context && typeof (input as any).context === 'object'
        ? ((input as any).context as any)
        : null;

      let resumeRequested = false;
      let handledRoute = false;
      let nextStateSnapshot: ExecutionState | null = null;

      setPlanningState((prev) => {
        if (!prev) return prev;
        let nextState = { ...prev };
        if (action) {
          handledRoute = handleRouteAction({
            action,
            onPromoteToWorksheet: () => {
              promoteToWorksheet();
            },
            onDraftReport: () => {
              showNotification('Planning action routed to report.', 'success');
            },
            toast: (message) => showNotification(message, 'error')
          });
          if (handledRoute) {
            nextState = {
              ...nextState,
              logs: [...nextState.logs, buildRouteLogEntry({ action, runId: nextState.runId })]
            };
            nextStateSnapshot = nextState;
            return withActionCards(nextState);
          }
        }

      if (cardType === 'refine' && action === 'refine:apply-defaults') {
        const card = prev.actionCards.find(candidate => candidate.id === cardId);
        const pointers = card?.inputs?.map((candidate) => candidate.pointer) ?? [];
        const { patches: defaultPatches, appliedPointers } = buildDefaultPatchesForPointers(prev, pointers);
        if (appliedPointers.length > 0) {
          patches = defaultPatches;
            nextState = {
              ...nextState,
              logs: [...nextState.logs, buildDefaultsLogEntry({ runId: nextState.runId, pointers: appliedPointers })]
            };
          } else {
            patches = [];
        }
      }

        patches.forEach((patch) => {
          try {
            setByPointer(nextState, patch.pointer, patch.value);
          } catch (error) {
            console.error('planning_program_patch_failed', {
              runId: nextState.runId,
              pointer: patch.pointer,
              error: (error as Error).message
            });
          }
        });

        if (contextPatch) {
          nextState.context = { ...nextState.context, ...contextPatch };
        }

      resumeRequested = cardType === 'refine' && (patches.length > 0 || action === 'refine:continue');
      nextStateSnapshot = nextState;
      return withActionCards(nextState);
    });

      if (handledRoute) {
        return;
      }
      if (resumeRequested && nextStateSnapshot) {
        const stepped = await runAgentStep(nextStateSnapshot, program, agentRegistry);
        setPlanningState(withActionCards(stepped));
        return;
      }
    },
    [agentRegistry, program, promoteToWorksheet, showNotification, withActionCards]
  );

  if (planningState) {
    return (
      <div className="flex h-full flex-col bg-slate-50">
        <header className="border-b border-slate-200 bg-white px-6 py-4">
          <div className="flex items-center gap-4">
            {projectId && (
              <button
                onClick={() => navigate(`/project/${projectId}`)}
                className="flex items-center gap-1 text-slate-500 hover:text-slate-800 text-sm font-medium"
                title="Back to Project"
              >
                <ChevronRightIcon className="h-4 w-4 rotate-180" />
                Back
              </button>
            )}
            <div className="h-10 w-10 bg-weflora-mint/20 rounded-xl flex items-center justify-center text-weflora-teal">
              <FlowerIcon className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800">Planning</h1>
          </div>
        </header>
        <div className="flex-1 min-h-0">
          <PlanningRunnerView
            program={program}
            state={planningState}
            stepsVM={stepsVM}
            onStartRun={startPlanningRun}
            onSubmitCard={handleSubmitActionCard}
            onCancelRun={() => setPlanningState(null)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex items-center gap-4">
          {projectId && (
            <button
              onClick={() => navigate(`/project/${projectId}`)}
              className="flex items-center gap-1 text-slate-500 hover:text-slate-800 text-sm font-medium"
              title="Back to Project"
            >
              <ChevronRightIcon className="h-4 w-4 rotate-180" />
              Back
            </button>
          )}
          <div className="h-10 w-10 bg-weflora-mint/20 rounded-xl flex items-center justify-center text-weflora-teal">
            <FlowerIcon className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Planning</h1>
        </div>
      </header>
      <div className="flex flex-1 min-h-0">
        <main className="flex-1 flex items-center justify-center px-6 py-10">
          <div className="w-full max-w-xl space-y-8">
            <div className="space-y-4">
              <button
                onClick={startPlanningRun}
                disabled={isStarting}
                className="w-full px-5 py-3 bg-weflora-teal text-white rounded-xl font-semibold text-sm shadow-sm hover:bg-weflora-dark transition-colors disabled:opacity-70"
              >
                {isStarting ? 'Starting Planning...' : 'Start Planning'}
              </button>
              <button
                type="button"
                className="w-full px-5 py-3 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Load Example
              </button>
            </div>
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center space-y-3">
              <input
                type="file"
                multiple
                className="block w-full text-xs text-slate-500 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-slate-600 hover:file:bg-slate-200"
              />
              <p className="text-xs text-slate-500">
                Upload site, policy, equity, or inventory data to begin
              </p>
            </div>
          </div>
        </main>
        <RightSidebarStepper
          runId="preview"
          status="idle"
          steps={stepsVM}
          showRunMeta={false}
          headerTitle="Planning flow"
        />
      </div>
    </div>
  );
};

export default PlanningView;
