import type { ExecutionState, PointerPatch } from '../../types.ts';
import { setByPointer } from '../../runtime/pointers.ts';
import type { PcivCommittedContext } from './types';
import { mapConstraintToPointer } from './map.ts';

export const applyPatch = (
  baseContext: ExecutionState['context'],
  patch: PointerPatch
): ExecutionState['context'] => {
  const nextContext = { ...baseContext };
  const wrapper = { context: nextContext } as { context: ExecutionState['context'] };
  setByPointer(wrapper, patch.pointer, patch.value);
  return nextContext;
};

export const applyCommittedContext = (
  baseContext: ExecutionState['context'],
  committed: PcivCommittedContext
): ExecutionState['context'] => {
  let nextContext = baseContext;
  const appliedFieldPointers: string[] = [];
  const appliedConstraintPointers: string[] = [];

  const orderedFields = Object.values(committed.fields).sort((a, b) =>
    a.pointer.localeCompare(b.pointer)
  );
  orderedFields.forEach((field) => {
    if (field.value === null || field.value === undefined || field.value === '') return;
    try {
      nextContext = applyPatch(nextContext, { pointer: field.pointer, value: field.value });
      appliedFieldPointers.push(field.pointer);
    } catch (error) {
      console.warn('pciv_v0_field_apply_failed', { pointer: field.pointer, error: (error as Error).message });
    }
  });

  committed.constraints.forEach((constraint) => {
    const pointer = mapConstraintToPointer(constraint);
    if (!pointer) return;
    try {
      nextContext = applyPatch(nextContext, { pointer, value: constraint.value });
      appliedConstraintPointers.push(pointer);
    } catch (error) {
      console.warn('pciv_v0_constraint_apply_failed', { pointer, error: (error as Error).message });
    }
  });

  if (import.meta.env?.DEV) {
    console.info('pciv_v0_commit_applied', {
      appliedFieldCount: appliedFieldPointers.length,
      appliedFieldPointers: appliedFieldPointers.slice(0, 3),
      appliedConstraintCount: appliedConstraintPointers.length,
      appliedConstraintPointers: appliedConstraintPointers.slice(0, 3)
    });
  }

  return nextContext;
};
