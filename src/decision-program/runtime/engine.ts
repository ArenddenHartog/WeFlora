import type { DecisionProgram, ExecutionState, StepState } from '../types.ts';
import type { AgentRegistry } from '../agents/types.ts';
import { listMissingPointers, setByPointer } from './pointers.ts';

const now = () => new Date().toISOString();

const ensureContextSlots = (context?: Partial<ExecutionState['context']>): ExecutionState['context'] => ({
  site: context?.site ?? {},
  regulatory: context?.regulatory ?? {},
  equity: context?.equity ?? {},
  species: context?.species ?? {},
  supply: context?.supply ?? {},
  selectedDocs: context?.selectedDocs ?? []
});

const cloneState = (state: ExecutionState): ExecutionState => ({
  ...state,
  steps: state.steps.map((step) => ({ ...step })),
  context: { ...state.context },
  logs: [...state.logs]
});

const pushLog = (state: ExecutionState, entry: { level: 'info' | 'warn' | 'error'; message: string; data?: Record<string, unknown> }) => {
  state.logs.push({
    ...entry,
    timestamp: now()
  });
};

export const createExecutionState = (
  program: DecisionProgram,
  initialContext?: Partial<ExecutionState['context']>
): ExecutionState => {
  const start = now();
  return {
    runId: `run-${Date.now()}`,
    programId: program.id,
    status: 'idle',
    startedAt: start,
    steps: program.steps.map((step) => ({
      stepId: step.id,
      status: 'queued'
    })),
    context: ensureContextSlots(initialContext),
    actionCards: [],
    logs: [
      {
        level: 'info',
        message: 'Execution state created',
        data: { programId: program.id },
        timestamp: start
      }
    ]
  };
};

const getStepRequiredPointers = (program: DecisionProgram, stepId: string, agentRegistry: AgentRegistry) => {
  const step = program.steps.find((candidate) => candidate.id === stepId);
  const agent = step?.agentRef ? agentRegistry.get(step.agentRef) : undefined;
  return agent?.requiredPointers ?? step?.requiredPointers ?? [];
};

const getStepProducesPointers = (program: DecisionProgram, stepId: string, agentRegistry: AgentRegistry) => {
  const step = program.steps.find((candidate) => candidate.id === stepId);
  const agent = step?.agentRef ? agentRegistry.get(step.agentRef) : undefined;
  return agent?.producesPointers ?? step?.producesPointers ?? [];
};

const findNextRunnable = (
  state: ExecutionState,
  program: DecisionProgram,
  agentRegistry: AgentRegistry
): { step: StepState; missing: string[] } | null => {
  for (const step of state.steps) {
    if (step.status !== 'queued' && step.status !== 'blocked') continue;
    const required = getStepRequiredPointers(program, step.stepId, agentRegistry);
    const missing = listMissingPointers(state, required);
    if (missing.length === 0) return { step, missing };
  }
  return null;
};

const markBlocked = (state: ExecutionState, program: DecisionProgram, agentRegistry: AgentRegistry) => {
  let blocked = false;
  for (const step of state.steps) {
    if (step.status !== 'queued' && step.status !== 'blocked') continue;
    const required = getStepRequiredPointers(program, step.stepId, agentRegistry);
    const missing = listMissingPointers(state, required);
    if (missing.length > 0) {
      step.status = 'blocked';
      step.blockingMissingInputs = missing;
      blocked = true;
      pushLog(state, {
        level: 'warn',
        message: 'Step blocked due to missing inputs',
        data: { stepId: step.stepId, missing }
      });
      console.warn('decision_program_blocked', {
        runId: state.runId,
        stepId: step.stepId,
        missing
      });
    }
  }
  return blocked;
};

const finalizeRunStatus = (state: ExecutionState) => {
  if (state.steps.some((step) => step.status === 'error')) {
    state.status = 'error';
    state.endedAt = now();
    return;
  }
  if (state.steps.every((step) => step.status === 'done' || step.status === 'skipped')) {
    state.status = 'done';
    state.endedAt = now();
    return;
  }
  if (state.steps.some((step) => step.status === 'blocked')) {
    state.status = 'blocked';
    return;
  }
  state.status = 'running';
};

export const stepExecution = async (
  state: ExecutionState,
  program: DecisionProgram,
  agentRegistry: AgentRegistry
): Promise<ExecutionState> => {
  const nextState = cloneState(state);
  nextState.status = 'running';

  let runnable = findNextRunnable(nextState, program, agentRegistry);
  while (runnable) {
    const { step } = runnable;
    const stepDef = program.steps.find((candidate) => candidate.id === step.stepId);
    nextState.currentStepId = step.stepId;
    step.status = 'running';
    step.startedAt = now();
    step.blockingMissingInputs = undefined;

    const agent = stepDef?.agentRef ? agentRegistry.get(stepDef.agentRef) : undefined;
    if (!agent) {
      step.status = 'error';
      step.endedAt = now();
      step.error = { message: `Missing agent for step ${step.stepId}` };
      pushLog(nextState, {
        level: 'error',
        message: 'Agent not found',
        data: { stepId: step.stepId, agentRef: stepDef?.agentRef }
      });
      console.error('decision_program_agent_missing', {
        runId: nextState.runId,
        stepId: step.stepId,
        agentRef: stepDef?.agentRef
      });
      break;
    }

    try {
      const result = await agent.run({
        context: nextState.context,
        step: stepDef,
        program,
        state: nextState
      });
      const produces = getStepProducesPointers(program, step.stepId, agentRegistry);
      for (const patch of result.patches) {
        try {
          setByPointer(nextState, patch.pointer, patch.value);
        } catch (error) {
          pushLog(nextState, {
            level: 'error',
            message: 'Failed to apply patch',
            data: { stepId: step.stepId, pointer: patch.pointer, error: (error as Error).message }
          });
          console.error('decision_program_patch_failed', {
            runId: nextState.runId,
            stepId: step.stepId,
            pointer: patch.pointer,
            error: (error as Error).message
          });
          step.status = 'error';
          step.error = { message: `Failed to apply patch ${patch.pointer}` };
          break;
        }
      }
      pushLog(nextState, {
        level: 'info',
        message: 'Agent completed',
        data: { stepId: step.stepId, agentId: agent.id, producesPointers: produces }
      });
      step.status = 'done';
      step.endedAt = now();
    } catch (error) {
      step.status = 'error';
      step.endedAt = now();
      step.error = { message: (error as Error).message };
      pushLog(nextState, {
        level: 'error',
        message: 'Agent error',
        data: { stepId: step.stepId, agentId: agent.id, error: (error as Error).message }
      });
      console.error('decision_program_agent_error', {
        runId: nextState.runId,
        stepId: step.stepId,
        agentId: agent.id,
        error: (error as Error).message
      });
      break;
    }

    runnable = findNextRunnable(nextState, program, agentRegistry);
  }

  if (!runnable) {
    const blocked = markBlocked(nextState, program, agentRegistry);
    if (!blocked) {
      finalizeRunStatus(nextState);
    }
  }

  finalizeRunStatus(nextState);
  return nextState;
};
