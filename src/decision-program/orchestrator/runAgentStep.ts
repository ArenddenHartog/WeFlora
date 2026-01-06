import type { DecisionProgram, ExecutionState } from '../types.ts';
import type { AgentRegistry } from '../agents/types.ts';
import { stepExecution } from '../runtime/engine.ts';

export const runAgentStep = async (
  state: ExecutionState,
  program: DecisionProgram,
  registry: AgentRegistry
): Promise<ExecutionState> => stepExecution(state, program, registry);
