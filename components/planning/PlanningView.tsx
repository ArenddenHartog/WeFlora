import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import type { ExecutionState } from '../../src/decision-program/types';
import PlanningRunnerView from './PlanningRunnerView';
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
import type { PcivCommittedContext, PcivStage } from '../../src/decision-program/pciv/v0/types';
import { loadPcivCommit, loadPcivRun, updatePcivRunId } from '../../src/decision-program/pciv/v0/store';
import { hydratePlanningStateFromPcivCommit } from '../../src/decision-program/pciv/v0/hydratePlanning';
import { getPlanningScopeId } from '../../src/lib/planningScope';
import { resolvePlanningProject } from '../../src/lib/projects/resolvePlanningProject';
import {
  getContextIntakeUrl,
  getPlanningStartAction,
  getPlanningStartLabel,
  getResolveInputsAction,
  getResolveInputsUrl,
  hasCommittedPciv
} from './planningUtils';

const PlanningView: React.FC = () => {
  const navigate = useNavigate();
  const params = useParams();
  const program = useMemo(() => buildProgram(), []);
  const location = useLocation();
  const agentRegistry = useMemo(() => buildAgentRegistry(), []);
  const { showNotification } = useUI();
  const { planningRuns, setPlanningRuns, upsertPlanningRun } = useChat();
  const { createMatrix, files } = useProject();
  const { user } = useAuth();
  const planningRunId = params.runId;
  const routeProjectId = params.projectId ?? null;
  const [resolvedProjectId, setResolvedProjectId] = useState<string | null>(null);
  const planningProjectId = routeProjectId ?? resolvedProjectId;
  const fallbackScopeId = useMemo(() => getPlanningScopeId(), []);
  const planningScopeId = useMemo(
    () => planningProjectId ?? fallbackScopeId,
    [fallbackScopeId, planningProjectId]
  );
  const contextIntakeState = location.state as
    | { pcivCommittedAt?: string; pcivAutoStart?: boolean }
    | null;
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
  const [pcivCommittedContext, setPcivCommittedContext] = useState<PcivCommittedContext | null>(null);
  const [inputChangeNotice, setInputChangeNotice] = useState<{
    changedInputs: string[];
    impactedSteps: string[];
    impactedStepIds: string[];
  } | null>(null);

  const withActionCards = useCallback((state: ExecutionState) => ({
    ...state,
    actionCards: buildActionCards(state)
  }), []);

  const startPlanningRun = useCallback(async (targetProjectId?: string | null) => {
    setIsStarting(true);
    const activeProjectId = targetProjectId ?? planningProjectId;
    const selectedDocs = await buildSelectedDocs(activeProjectId);
    const baseContext = {
      ...defaultPlanningContext,
      selectedDocs
    };
    const baseState = planRun(program, baseContext);
    const hydrated = hydratePlanningStateFromPcivCommit(baseState, {
      scopeId: planningScopeId,
      userId: user?.email ?? null,
      debug: FEATURES.pcivDebug
    });
    const planned = withActionCards(hydrated);
    setPlanningState(planned);
    setInputChangeNotice(null);
    navigate(`/planning/${planned.runId}`);
    if (planned.pcivCommittedContext) {
      const existingRun = loadPcivRun(planningScopeId, user?.email ?? null);
      updatePcivRunId(existingRun, planned.runId);
    }
    const stepped = await runAgentStep(planned, program, agentRegistry);
    setPlanningState(withActionCards(stepped));
    setIsStarting(false);
  }, [agentRegistry, buildSelectedDocs, defaultPlanningContext, program, withActionCards, navigate, planningProjectId, planningScopeId, user?.email]);

  useEffect(() => {
    if (routeProjectId) {
      setResolvedProjectId(null);
      return;
    }
    let isCancelled = false;
    resolvePlanningProject()
      .then((result) => {
        if (isCancelled) return;
        if (result?.projectId) {
          setResolvedProjectId(result.projectId);
        }
      })
      .catch(() => {
        if (isCancelled) return;
        setResolvedProjectId(null);
      });
    return () => {
      isCancelled = true;
    };
  }, [routeProjectId]);

  useEffect(() => {
    if (!planningRunId) return;
    const existing = planningRuns.find((run) => run.runId === planningRunId);
    if (existing?.executionState) {
      const hydrated = hydratePlanningStateFromPcivCommit(existing.executionState, {
        scopeId: planningScopeId,
        userId: user?.email ?? null,
        debug: FEATURES.pcivDebug
      });
      setPlanningState(hydrated);
      if (hydrated.pcivCommittedContext) {
        setPcivCommittedContext(hydrated.pcivCommittedContext);
      }
    }
  }, [planningRunId, planningRuns, planningScopeId, user?.email]);

  useEffect(() => {
    if (!planningScopeId || !pcivEnabled) return;
    const commit = loadPcivCommit(planningScopeId, user?.email ?? null);
    if (commit) {
      setPcivCommittedContext(commit);
    }
  }, [pcivEnabled, planningScopeId, user?.email]);

  const pcivCommitSignature = useMemo(() => {
    if (!pcivCommittedContext) return null;
    return [
      pcivCommittedContext.status,
      pcivCommittedContext.committed_at,
      pcivCommittedContext.metrics.fields_filled_count,
      pcivCommittedContext.metrics.constraints_count
    ].join(':');
  }, [pcivCommittedContext]);

  useEffect(() => {
    if (!pcivCommitSignature) return;
    setPlanningState((prev) => {
      if (!prev) return prev;
      return hydratePlanningStateFromPcivCommit(prev, {
        scopeId: planningScopeId,
        userId: user?.email ?? null,
        debug: FEATURES.pcivDebug
      });
    });
  }, [pcivCommitSignature, planningScopeId, user?.email]);

  useEffect(() => {
    if (!contextIntakeState?.pcivAutoStart) return;
    if (!pcivCommitSignature) return;
    if (!pcivEnabled) return;
    startPlanningRun(planningProjectId);
  }, [contextIntakeState?.pcivAutoStart, pcivCommitSignature, pcivEnabled, planningProjectId, startPlanningRun]);

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
        setPcivCommittedContext(parsed.pcivCommittedContext);
      }
    } catch {
      // noop
    }
  }, []);

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

  const openContextIntake = useCallback(
    async (stage: PcivStage, options?: { focus?: 'missingRequired' | null; autoStart?: boolean }) => {
      navigate(getContextIntakeUrl(stage, { focus: options?.focus ?? null }), {
        state: {
          returnTo: location.pathname,
          autoStart: options?.autoStart ?? false
        }
      });
    },
    [location.pathname, navigate]
  );

  const handleStartFlow = useCallback(async () => {
    const hasCommit = pcivEnabled && hasCommittedPciv(planningScopeId, user?.email ?? null);
    const committedContext = hasCommit ? loadPcivCommit(planningScopeId, user?.email ?? null) : null;
    const action = getPlanningStartAction(pcivEnabled, committedContext);
    if (action === 'pciv-import') {
      await openContextIntake('import', { autoStart: true });
      return;
    }
    startPlanningRun(planningProjectId ?? null);
  }, [openContextIntake, pcivCommittedContext, pcivEnabled, planningProjectId, planningScopeId, startPlanningRun, user?.email]);

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

  const handleResetPlanning = useCallback(() => {
    setPlanningState(null);
    setInputChangeNotice(null);
    setIsStarting(false);
    setPlanningRuns((prev) =>
      prev.filter(
        (run) =>
          run.projectId !== planningProjectId &&
          run.runId !== planningState?.runId
      )
    );
    navigate('/planning', { replace: true });
  }, [navigate, planningProjectId, planningState?.runId, setPlanningRuns]);

  const showBackButton = Boolean(routeProjectId) || location.key !== 'default';
  const backTarget = routeProjectId ? `/project/${routeProjectId}` : null;
  const hasPcivCommit = Boolean(pcivCommittedContext);
  const committedContextForCta = hasPcivCommit
    ? pcivCommittedContext
    : null;
  const startLabel = getPlanningStartLabel(pcivEnabled, committedContextForCta);
  const startAction = getPlanningStartAction(pcivEnabled, committedContextForCta);
  const startDestination =
    startAction === 'pciv-import'
      ? getContextIntakeUrl('import')
      : '/planning/run';
  const missingRequiredCount = useMemo(() => {
    if (!planningState) return 0;
    const refineCard = planningState.actionCards.find((card) => card.type === 'refine');
    if (!refineCard?.inputs) return 0;
    return refineCard.inputs.filter((input) => input.severity === 'required' || input.required).length;
  }, [planningState]);
  const buildStamp = useMemo(
    () => ({
      sha: __BUILD_SHA__,
      time: __BUILD_TIME__,
      mode: import.meta.env.MODE
    }),
    []
  );
  const debugEnabled = import.meta.env.DEV || import.meta.env.VITE_DEBUG_PLANNING === '1';
  const debugFooter = debugEnabled ? (
    <div className="border-t border-dashed border-slate-200 bg-white px-4 py-2 text-[11px] text-slate-500">
      <div>pathname: {location.pathname}</div>
      <div>planningScopeId: {planningScopeId}</div>
      <div>pcivCommitted: {pcivCommittedContext ? 'true' : 'false'}</div>
      <div>primaryCtaLabel: {startLabel}</div>
      <div>primaryCtaDestination: {startDestination}</div>
      <div>contextIntakeUrl: {getContextIntakeUrl(pcivCommittedContext ? 'validate' : 'import')}</div>
      <div>resolveInputsUrl: {getResolveInputsUrl('validate')}</div>
      <div>missingRequiredCount: {missingRequiredCount}</div>
      <div>pcivConstraints: {pcivCommittedContext?.constraints?.length ?? 0}</div>
    </div>
  ) : null;
  const buildFooter = (
    <div className="border-t border-slate-200 bg-white px-4 py-2 text-[11px] text-slate-500">
      Build: {buildStamp.sha} · {buildStamp.time} · {buildStamp.mode}
    </div>
  );

  if (planningState) {
    return (
      <div className="flex h-full flex-col bg-slate-50">
        <header className="flex-none h-16 bg-white border-b border-slate-200 px-4 flex items-center justify-between z-30">
          <div className="flex items-center gap-3">
            {showBackButton && (
              <button
                onClick={() => (backTarget ? navigate(backTarget) : navigate(-1))}
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
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => openContextIntake('import', { autoStart: false })}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              {hasPcivCommit ? 'Update Context' : 'Context intake'}
            </button>
            <button
              type="button"
              onClick={handleResetPlanning}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              Reset Planning
            </button>
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
                ? () => {
                    openContextIntake('validate', { focus: 'missingRequired', autoStart: true });
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
            hideMissingInputs={false}
          />
        </div>
        {debugFooter}
        {buildFooter}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-slate-50">
      <header className="flex-none h-16 bg-white border-b border-slate-200 px-4 flex items-center justify-between z-30">
        <div className="flex items-center gap-3">
            {showBackButton && (
              <button
                onClick={() => (backTarget ? navigate(backTarget) : navigate(-1))}
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
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => openContextIntake('import', { autoStart: false })}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            {hasPcivCommit ? 'Update Context' : 'Context intake'}
          </button>
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
              {hasPcivCommit && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openContextIntake('import', { autoStart: false })}
                    className="flex-1 min-w-[160px] px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    Update Context
                  </button>
                  <button
                    type="button"
                    onClick={handleResetPlanning}
                    className="flex-1 min-w-[160px] px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    Reset Planning
                  </button>
                </div>
              )}
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
      {debugFooter}
      {buildFooter}
    </div>
  );
};

export default PlanningView;
