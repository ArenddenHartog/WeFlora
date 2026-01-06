import type { DecisionProgram, ExecutionState } from '../types.ts';
import { createExecutionState } from '../runtime/engine.ts';

export const planRun = (program: DecisionProgram, initialContext?: Partial<ExecutionState['context']>) =>
  createExecutionState(program, initialContext);
