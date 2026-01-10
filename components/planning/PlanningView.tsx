import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import type { ExecutionState } from '../../src/decision-program/types';
import PlanningRunnerView from './PlanningRunnerView';
import PCIVModal from './pciv/PCIVModal';
import { buildProgram } from '../../src/decision-program/orchestrator/buildProgram';
import { buildActionCards } from '../../src/decision-program/orchestrator/buildActionCards';
import {
  buildDefaultPatchesForPointers,
  buildDefaultsLogEntry,
  getInputSpec
} from '../../src/decision-program/orchestrator/pointerInputRegistry';
import { planRun } from '../../src/decision-program/orchestrator/planRun';
import { runAgentStep } from '../../src/decision-program/orchestrator/runAgentStep';
import { getImpactedStepIds } from '../../src/decision-program/orchestrator/impactAnalysis';
import { buildAgentRegistry } from '../../src/decision-program/agents/registry';
import { getByPointer, setByPointer, unsetByPointer } from '../../src/decision-program/runtime/pointers';
import { buildRouteLogEntry, handleRouteAction } from '../../src/decision-program/ui/decision-accelerator/routeHandlers';
import { promoteDraftMatrixToWorksheet } from '../../utils/draftMatrixPromotion';
import RightSidebarStepper from '../../src/decision-program/ui/decision-accelerator/RightSidebarStepper';
import { FEATURES } from '../../src/config/features';
import { useUI } from '../../contexts/UIContext';
import { useChat } from '../../contexts/ChatContext';
import { useProject } from '../../contexts/ProjectContext';
import { useAuth } from '../../contexts/AuthContext';
import { ChevronRightIcon, FlowerIcon } from '../icons';
import type { PcivCommittedContext } from '../../src/decision-program/pciv/v0/types';
import { applyCommittedContext } from '../../src/decision-program/pciv/v0/context';
import { loadPcivCommit, loadPcivRun, updatePcivRunId } from '../../src/decision-program/pciv/v0/store';
import usePcivController from './pciv/usePcivController';
import { resolvePlanningProject } from '../../src/lib/projects/resolvePlanningProject';
import { getPlanningStartAction, getPlanningStartLabel, getResolveInputsAction } from './planningUtils';

const PlanningView: React.FC = () => {
  const navigate = useNavigate();
  const params = useParams();
  const program = useMemo(() => buildProgram(), []);
  const location = useLocation();
  const agentRegistry = useMemo(() => buildAgentRegistry(), []);
  const { showNotification } = useUI();
  const { planningRuns, upsertPlanningRun } = useChat();
  const { createMatrix, files } = useProject();
  const { user } = useAuth();
  const planningRunId = params.runId;
  const routeProjectId = params.projectId ?? null;
  const [resolvedProjectId, setResolvedProjectId] = useState<string | null>(routeProjectId);
  const planningProjectId = routeProjectId ?? resolvedProjectId;
  const pcivEnabled = FEATURES.pciv;
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

  const buildSelectedDocs = useCallback(async (targetProjectId?: string | null) => {
    const activeProjectId = targetProjectId ?? planningProjectId;
    if (!activeProjectId) return [] as any[];
    const projectFiles = files?.[activeProjectId] ?? [];
    const selectedDocs = await Promise.all(
      projectFiles.map(async (file) => {
        const content =
          file.file &&
          (file.file.type.includes('text') ||
            file.file.type.includes('csv') ||
            file.file.type.includes('json') ||
            file.name.endsWith('.txt') ||
            file.name.endsWith('.csv') ||
            file.name.endsWith('.json'))
            ? await file.file.text()
            : undefined;
        return {
          id: file.id,
          title: file.name,
          fileId: file.id,
          file: file.file,
          content
        };
      })
    );
    return selectedDocs;
  }, [files, planningProjectId]);
  const [planningState, setPlanningState] = useState<ExecutionState | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const pcivController = usePcivController();
  const pcivCommittedContext = pcivController.committedContext;
  const [inputChangeNotice, setInputChangeNotice] = useState<{
    changedInputs: string[];
    impactedSteps: string[];
    impactedStepIds: string[];
  } | null>(null);

  useEffect(() => {
    setResolvedProjectId(routeProjectId ?? null);
  }, [routeProjectId]);

  useEffect(() => {
    if (!pcivEnabled || planningProjectId) return;
    let active = true;
    resolvePlanningProject().then((resolved) => {
      if (!active || !resolved) return;
      setResolvedProjectId(resolved.projectId);
      if (!routeProjectId && !planningRunId) {
        navigate(`/project/${resolved.projectId}/planning`, { replace: true });
      }
    });
    return () => {
      active = false;
    };
  }, [navigate, pcivEnabled, planningProjectId, planningRunId, routeProjectId]);

  useEffect(() => {
    if (!planningRunId) return;
    const existing = planningRuns.find((run) => run.runId === planningRunId);
    if (existing?.executionState) {
      setPlanningState(existing.executionState);
      if (existing.executionState.pcivCommittedContext) {
        pcivController.setCommittedContext(existing.executionState.pcivCommittedContext);
      }
    }
  }, [pcivController, planningRunId, planningRuns]);

  useEffect(() => {
    if (!planningProjectId || !pcivEnabled) return;
    const commit = loadPcivCommit(planningProjectId, user?.email ?? null);
    if (commit) {
      pcivController.setCommittedContext(commit);
    }
  }, [pcivController, pcivEnabled, planningProjectId, user?.email]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (!params.has('pcivTest')) return;
    const raw = window.localStorage.getItem('pciv_test_planning_state');
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as ExecutionState;
      setPlanningState(parsed);
      if (parsed.pcivCommittedContext) {
        pcivController.setCommittedContext(parsed.pcivCommittedContext);
      }
    } catch {
      // noop
    }
  }, [pcivController]);

  useEffect(() => {
    if (!planningState) return;
    const timeout = window.setTimeout(() => {
      upsertPlanningRun({
        runId: planningState.runId,
        programId: planningState.programId,
        executionState: planningState,
        status: planningState.status,
        projectId: planningProjectId ?? null
      });
    }, 600);
    return () => window.clearTimeout(timeout);
  }, [planningProjectId, planningState, upsertPlanningRun]);

  const withActionCards = useCallback((state: ExecutionState) => ({
    ...state,
    actionCards: buildActionCards(state)
  }), []);

  const startPlanningRun = useCallback(async (committedContext?: PcivCommittedContext, targetProjectId?: string | null) => {
    setIsStarting(true);
    const activeProjectId = targetProjectId ?? planningProjectId;
    const selectedDocs = await buildSelectedDocs(activeProjectId);
    const baseContext = {
      ...defaultPlanningContext,
      selectedDocs,
      contextVersionId: committedContext?.committed_at ?? undefined
    };
    const resolvedContext = committedContext ? applyCommittedContext(baseContext, committedContext) : baseContext;
    if (committedContext && import.meta.env.DEV) {
      console.info('PCIV: using committed context');
    }
    const planned = withActionCards(planRun(program, resolvedContext));
    planned.pcivCommittedContext = committedContext ?? undefined;
    setPlanningState(planned);
    setInputChangeNotice(null);
    navigate(`/planning/${planned.runId}`);
    if (committedContext && activeProjectId) {
      const existingRun = loadPcivRun(activeProjectId, user?.email ?? null);
      updatePcivRunId(existingRun, planned.runId);
    }
    const stepped = await runAgentStep(planned, program, agentRegistry);
    setPlanningState(withActionCards(stepped));
    setIsStarting(false);
  }, [agentRegistry, buildSelectedDocs, defaultPlanningContext, program, withActionCards, navigate, planningProjectId, user?.email]);

  const ensurePlanningProject = useCallback(async () => {
    if (planningProjectId) return planningProjectId;
    const resolved = await resolvePlanningProject();
    if (!resolved) return null;
    setResolvedProjectId(resolved.projectId);
    if (!routeProjectId && !planningRunId) {
      navigate(`/project/${resolved.projectId}/planning`, { replace: true });
    }
    return resolved.projectId;
  }, [navigate, planningProjectId, planningRunId, routeProjectId]);

  const handleStartFlow = useCallback(async () => {
    const resolvedProject = await ensurePlanningProject();
    const action = getPlanningStartAction(pcivEnabled, pcivCommittedContext);
    if (action === 'pciv-import') {
      if (resolvedProject) {
        pcivController.open('import');
      }
      return;
    }
    startPlanningRun(pcivCommittedContext ?? undefined, resolvedProject);
  }, [ensurePlanningProject, pcivCommittedContext, pcivController, pcivEnabled, startPlanningRun]);

  const stepsVM = useMemo(() => {
    const evidenceIndex = planningState?.evidenceIndex ?? {};
    if (!planningState || planningState.status === 'idle') {
      return [];
    }

    const lastActiveIndex = program.steps.reduce((acc, step, index) => {
      const stepState = planningState.steps.find((candidate) => candidate.stepId === step.id);
      if (!stepState) return acc;
      if (stepState.status !== 'queued') return index;
      if (planningState.currentStepId === step.id) return index;
      return acc;
    }, -1);

    const visibleSteps =
      planningState.status === 'done'
        ? program.steps
        : program.steps.slice(0, lastActiveIndex + 1);

    const baseSteps = visibleSteps.map(step => {
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
        phase: step.phase,
        agentRef: step.agentRef,
        status: (stepState?.status ?? 'queued') as any,
        startedAt,
        endedAt,
        durationMs,
        blockingMissingInputs: stepState?.blockingMissingInputs,
        error: stepState?.error,
        summary,
        reasoningSummary: stepState?.reasoningSummary,
        evidenceCount: evidenceIndex[step.id]?.length ?? 0,
        producesPointers: step.producesPointers
      };
    });
    if (pcivCommittedContext) {
      return [
        {
          stepId: 'context-intake',
          title: 'Context intake',
          kind: 'agent',
          phase: 'site',
          status: 'done' as const,
          summary: 'Committed context intake for planning.',
          reasoningSummary: ['Captured sources, fields, and constraints from intake.'],
          evidenceCount: pcivCommittedContext.sources.length,
          producesPointers: ['/derivedConstraints']
        },
        ...baseSteps
      ];
    }
    return baseSteps;
  }, [planningState, pcivCommittedContext, program.steps]);

  const promoteToWorksheet = useCallback(async () => {
    if (!planningState?.draftMatrix) return;
    const hasEvidence = planningState.draftMatrix.rows.some((row) =>
      row.cells.some((cell) => (cell.evidence ?? []).length > 0)
    );
    const includeCitations = hasEvidence ? window.confirm('Include citations column?') : false;
    const { columns: worksheetColumns, rows: worksheetRows } = promoteDraftMatrixToWorksheet(
      planningState.draftMatrix,
      { includeCitations }
    );
    const created = await createMatrix({
      id: `mtx-${Date.now()}`,
      title: planningState.draftMatrix.title ?? 'Draft Matrix',
      description: 'Planning matrix promotion',
      columns: worksheetColumns,
      rows: worksheetRows,
      projectId: planningProjectId ?? undefined
    });
    if (!created?.id) {
      showNotification('Worksheet creation not implemented', 'error');
      return;
    }
    showNotification('Worksheet created', 'success');
    navigate(`/worksheets/${created.id}`);
  }, [createMatrix, navigate, planningProjectId, planningState?.draftMatrix, showNotification]);

  const handleApplyDerivedInput = useCallback(
    (args: { pointer: string; value?: unknown; mode: 'accept' | 'ignore' | 'edit' }) => {
      setPlanningState((prev) => {
        if (!prev) return prev;
        const next = {
          ...prev,
          context: { ...prev.context },
          derivedInputs: { ...prev.derivedInputs }
        };
        if (args.mode === 'accept' || args.mode === 'edit') {
          if (args.value !== undefined) {
            setByPointer(next, args.pointer, args.value);
          }
        }
        if (args.mode === 'ignore') {
          unsetByPointer(next, args.pointer);
        }
        const existing = next.derivedInputs?.[args.pointer];
        if (existing) {
          next.derivedInputs = {
            ...next.derivedInputs,
            [args.pointer]: {
              ...existing,
              value: args.value ?? existing.value,
              status: args.mode === 'ignore' ? 'ignored' : 'accepted'
            }
          };
        }
        return next;
      });
    },
    []
  );

  const handleSubmitActionCard = useCallback(
    async ({ cardId, cardType, input }: { cardId: string; cardType: 'deepen' | 'refine' | 'next_step'; input?: Record<string, unknown> }) => {
      const action = typeof (input as any)?.action === 'string' ? ((input as any).action as string) : null;
      const resumeRequested = Boolean((input as any)?.resume);
      let patches = Array.isArray((input as any)?.patches)
        ? ((input as any).patches as Array<{ pointer: string; value: unknown }>)
        : [];
      const contextPatch = input && (input as any).context && typeof (input as any).context === 'object'
        ? ((input as any).context as any)
        : null;

      let handledRoute = false;
      let nextStateSnapshot: ExecutionState | null = null;
      let changedPointers: string[] = [];
      let impactedStepIds: string[] = [];
      let impactedStepTitles: string[] = [];
      let changedInputs: string[] = [];

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
            const existing = getByPointer(nextState, patch.pointer);
            if (existing !== patch.value) {
              changedPointers.push(patch.pointer);
            }
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

        if (changedPointers.length > 0) {
          impactedStepIds = getImpactedStepIds(program, changedPointers);
          impactedStepTitles = impactedStepIds
            .map((stepId) => program.steps.find((step) => step.id === stepId)?.title)
            .filter(Boolean) as string[];
          changedInputs = changedPointers.map(
            (pointer) => getInputSpec(pointer)?.input.label ?? pointer
          );
        }

      nextStateSnapshot = nextState;
      return withActionCards(nextState);
    });

      if (handledRoute) {
        return;
      }
      if (nextStateSnapshot) {
        const shouldResume =
          cardType === 'refine' &&
          (resumeRequested || action === 'refine:continue' || action === 'refine:apply-defaults');
        if (!shouldResume) {
          if (changedPointers.length > 0 && impactedStepTitles.length > 0) {
            setInputChangeNotice({
              changedInputs,
              impactedSteps: impactedStepTitles,
              impactedStepIds
            });
          }
          return;
        }

        const resumeStateBase =
          nextStateSnapshot.status === 'done'
            ? {
                ...nextStateSnapshot,
                status: 'running',
                steps: nextStateSnapshot.steps.map((step) => ({ ...step }))
              }
            : nextStateSnapshot;

        const resumeState =
          impactedStepIds.length > 0
            ? {
                ...resumeStateBase,
                status: 'running',
                steps: resumeStateBase.steps.map((step) =>
                  impactedStepIds.includes(step.stepId)
                    ? {
                        ...step,
                        status: 'queued',
                        startedAt: undefined,
                        endedAt: undefined,
                        error: undefined
                      }
                    : step
                )
              }
            : resumeStateBase;

        setInputChangeNotice(null);
        const stepped = await runAgentStep(resumeState, program, agentRegistry);
        setPlanningState(withActionCards(stepped));
        return;
      }
    },
    [agentRegistry, program, promoteToWorksheet, showNotification, withActionCards]
  );

  const handleRerunImpactedSteps = useCallback(async () => {
    if (!planningState || !inputChangeNotice) return;
    const impactedStepIds = inputChangeNotice.impactedStepIds;
    const resumeState = {
      ...planningState,
      status: 'running',
      steps: planningState.steps.map((step) =>
        impactedStepIds.includes(step.stepId)
          ? {
              ...step,
              status: 'queued',
              startedAt: undefined,
              endedAt: undefined,
              error: undefined
            }
          : step
      )
    };
    setInputChangeNotice(null);
    setPlanningState(withActionCards(resumeState));
    const stepped = await runAgentStep(resumeState, program, agentRegistry);
    setPlanningState(withActionCards(stepped));
  }, [agentRegistry, inputChangeNotice, planningState, program, withActionCards]);

  const handleKeepResults = useCallback(() => {
    setInputChangeNotice(null);
  }, []);

  const showBackButton = Boolean(planningProjectId) || location.key !== 'default';
  const startLabel = getPlanningStartLabel(pcivEnabled, pcivCommittedContext);

  if (planningState) {
    return (
      <div className="flex h-full flex-col bg-slate-50">
        <header className="flex-none h-16 bg-white border-b border-slate-200 px-4 flex items-center justify-between z-30">
          <div className="flex items-center gap-3">
            {showBackButton && (
              <button
                onClick={() => (planningProjectId ? navigate(`/project/${planningProjectId}`) : navigate(-1))}
                className="flex items-center gap-1 text-slate-500 hover:text-slate-800 text-sm font-medium"
                title="Back"
              >
                <ChevronRightIcon className="h-4 w-4 rotate-180" />
                Back
              </button>
            )}
            {showBackButton && <div className="h-6 w-px bg-slate-200 mx-2"></div>}
            <div className="h-8 w-8 bg-weflora-mint/20 rounded-lg flex items-center justify-center text-weflora-teal">
              <FlowerIcon className="h-5 w-5 text-weflora-teal" />
            </div>
            <h1 className="text-lg font-bold text-slate-900">Planning</h1>
          </div>
        </header>
        <div className="flex-1 min-h-0">
          <PlanningRunnerView
            program={program}
            state={planningState}
            stepsVM={stepsVM}
            onStartRun={handleStartFlow}
            onSubmitCard={handleSubmitActionCard}
            onApplyDerivedInput={handleApplyDerivedInput}
            onOpenContextIntake={
              getResolveInputsAction(pcivEnabled) === 'pciv-map'
                ? async () => {
                    const resolvedProject = await ensurePlanningProject();
                    if (resolvedProject) {
                      pcivController.open('map');
                    }
                  }
                : undefined
            }
            inputChangeNotice={
              inputChangeNotice
                ? { changedInputs: inputChangeNotice.changedInputs, impactedSteps: inputChangeNotice.impactedSteps }
                : null
            }
            onRerunImpactedSteps={handleRerunImpactedSteps}
            onKeepCurrentResults={handleKeepResults}
            startLabel={startLabel}
            pcivConstraints={pcivCommittedContext?.constraints?.length ? pcivCommittedContext.constraints : undefined}
            hideMissingInputs={pcivEnabled}
          />
        </div>
        <PCIVModal
          isOpen={pcivController.isOpen}
          projectId={planningProjectId}
          userId={user?.email ?? null}
          initialStage={pcivController.stage}
          onClose={pcivController.close}
          onComplete={(commit) => {
            pcivController.commit(commit);
            startPlanningRun(commit, planningProjectId);
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-slate-50">
      <header className="flex-none h-16 bg-white border-b border-slate-200 px-4 flex items-center justify-between z-30">
        <div className="flex items-center gap-3">
          {showBackButton && (
            <button
              onClick={() => (planningProjectId ? navigate(`/project/${planningProjectId}`) : navigate(-1))}
              className="flex items-center gap-1 text-slate-500 hover:text-slate-800 text-sm font-medium"
              title="Back"
            >
              <ChevronRightIcon className="h-4 w-4 rotate-180" />
              Back
            </button>
          )}
          {showBackButton && <div className="h-6 w-px bg-slate-200 mx-2"></div>}
          <div className="h-8 w-8 bg-weflora-mint/20 rounded-lg flex items-center justify-center text-weflora-teal">
            <FlowerIcon className="h-5 w-5 text-weflora-teal" />
          </div>
          <h1 className="text-lg font-bold text-slate-900">Planning</h1>
        </div>
      </header>
      <div className="flex flex-1 min-h-0">
        <main className="flex-1 flex items-center justify-center px-6 py-10">
          <div className="w-full max-w-xl space-y-8">
            <div className="space-y-4">
              {pcivCommittedContext && (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  Context committed · {pcivCommittedContext.metrics.sources_count} sources ·{' '}
                  {pcivCommittedContext.metrics.fields_filled_count}/{pcivCommittedContext.metrics.fields_total} fields
                  mapped
                </div>
              )}
              <button
                onClick={handleStartFlow}
                disabled={isStarting}
                className="w-full px-5 py-3 bg-weflora-teal text-white rounded-xl font-semibold text-sm shadow-sm hover:bg-weflora-dark transition-colors disabled:opacity-70"
              >
                {isStarting
                  ? 'Starting Planning...'
                  : startLabel}
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
      <PCIVModal
        isOpen={pcivController.isOpen}
        projectId={planningProjectId}
        userId={user?.email ?? null}
        initialStage={pcivController.stage}
        onClose={pcivController.close}
        onComplete={(commit) => {
          pcivController.commit(commit);
          startPlanningRun(commit, planningProjectId);
        }}
      />
    </div>
  );
};

export default PlanningView;
