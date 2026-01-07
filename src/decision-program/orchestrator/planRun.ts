import type { DecisionProgram, ExecutionState } from '../types.ts';
import { createExecutionState } from '../runtime/engine.ts';
import { buildDefaultPatchesForPointers, buildDefaultsLogEntry, getPointersBySeverity } from './pointerInputRegistry.ts';
import { setByPointer } from '../runtime/pointers.ts';

export const planRun = (program: DecisionProgram, initialContext?: Partial<ExecutionState['context']>) => {
  const state = createExecutionState(program, initialContext);
  const recommended = getPointersBySeverity('recommended');
  const { patches, appliedPointers } = buildDefaultPatchesForPointers(state, recommended);
  patches.forEach((patch) => {
    try {
      setByPointer(state, patch.pointer, patch.value);
    } catch (error) {
      console.error('planning_program_default_patch_failed', {
        runId: state.runId,
        pointer: patch.pointer,
        error: (error as Error).message
      });
    }
  });
  if (appliedPointers.length > 0) {
    state.logs.push(buildDefaultsLogEntry({ runId: state.runId, pointers: appliedPointers }));
  }
  return state;
};
