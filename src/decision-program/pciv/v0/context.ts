import type { ExecutionState } from '../../types';
import { setByPointer } from '../../runtime/pointers';
import type { PcivCommittedContext } from './types';
import { mapConstraintToPointer } from './map';

export const applyCommittedContext = (
  baseContext: ExecutionState['context'],
  committed: PcivCommittedContext
): ExecutionState['context'] => {
  const nextContext = { ...baseContext };
  const wrapper = { context: nextContext } as { context: ExecutionState['context'] };

  Object.values(committed.fields).forEach((field) => {
    if (field.value === null || field.value === undefined || field.value === '') return;
    try {
      setByPointer(wrapper, field.pointer, field.value);
    } catch (error) {
      console.warn('pciv_v0_field_apply_failed', { pointer: field.pointer, error: (error as Error).message });
    }
  });

  committed.constraints.forEach((constraint) => {
    const pointer = mapConstraintToPointer(constraint);
    if (!pointer) return;
    try {
      setByPointer(wrapper, pointer, constraint.value);
    } catch (error) {
      console.warn('pciv_v0_constraint_apply_failed', { pointer, error: (error as Error).message });
    }
  });

  return nextContext;
};
