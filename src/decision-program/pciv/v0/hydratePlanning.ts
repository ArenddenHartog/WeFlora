import type { ExecutionState } from '../../types.ts';
import type { PcivCommittedContext } from './types.ts';
import { applyPatch } from './context.ts';
import { mapConstraintToPointer } from './map.ts';
import { loadPcivCommit } from './store.ts';
import { buildActionCards } from '../../orchestrator/buildActionCards.ts';
import { listMissingPointersBySeverity } from '../../orchestrator/pointerInputRegistry.ts';
import { FEATURES } from '../../../config/features.ts';

export type PcivPlanningPatch = {
  pointer: string;
  value: unknown;
  op: 'set';
  source: 'pciv';
};

const isEmptyValue = (value: unknown) => value === null || value === undefined || value === '';

export const buildPcivPlanningPatches = (commit: PcivCommittedContext): PcivPlanningPatch[] => {
  const patchesByPointer = new Map<string, PcivPlanningPatch>();

  Object.values(commit.fields).forEach((field) => {
    if (isEmptyValue(field.value)) return;
    patchesByPointer.set(field.pointer, {
      pointer: field.pointer,
      value: field.value,
      op: 'set',
      source: 'pciv'
    });
  });

  commit.constraints.forEach((constraint) => {
    const pointer = mapConstraintToPointer(constraint);
    if (!pointer) return;
    patchesByPointer.set(pointer, {
      pointer,
      value: constraint.value,
      op: 'set',
      source: 'pciv'
    });
  });

  patchesByPointer.set('/context/contextVersionId', {
    pointer: '/context/contextVersionId',
    value: commit.committed_at,
    op: 'set',
    source: 'pciv'
  });

  return Array.from(patchesByPointer.values()).sort((a, b) => a.pointer.localeCompare(b.pointer));
};

export const hydratePlanningStateFromPcivCommit = (
  state: ExecutionState,
  opts: { scopeId: string; userId?: string | null; debug?: boolean }
): ExecutionState => {
  const commit = loadPcivCommit(opts.scopeId, opts.userId);
  const debugEnabled = opts.debug ?? FEATURES.pcivDebug;
  const missingRequiredBefore = debugEnabled
    ? listMissingPointersBySeverity(state, 'required').length
    : 0;

  if (!commit) {
    if (debugEnabled) {
      console.info('pciv_v0_planning_hydrate', {
        scopeId: opts.scopeId,
        commitFound: false,
        appliedPatchCount: 0,
        appliedPointers: [],
        missingRequiredBefore,
        missingRequiredAfter: missingRequiredBefore
      });
    }
    return state;
  }

  const patches = buildPcivPlanningPatches(commit);
  let nextContext = state.context;
  const appliedPointers: string[] = [];

  patches.forEach((patch) => {
    try {
      nextContext = applyPatch(nextContext, { pointer: patch.pointer, value: patch.value });
      appliedPointers.push(patch.pointer);
    } catch (error) {
      console.warn('pciv_v0_planning_patch_failed', {
        pointer: patch.pointer,
        error: (error as Error).message
      });
    }
  });

  const updated = {
    ...state,
    context: nextContext,
    pcivCommittedContext: commit
  };
  const nextState = {
    ...updated,
    actionCards: buildActionCards(updated)
  };

  if (debugEnabled) {
    const missingRequiredAfter = listMissingPointersBySeverity(nextState, 'required').length;
    console.info('pciv_v0_planning_hydrate', {
      scopeId: opts.scopeId,
      commitFound: true,
      appliedPatchCount: appliedPointers.length,
      appliedPointers: appliedPointers.slice(0, 20),
      missingRequiredBefore,
      missingRequiredAfter
    });
  }

  return nextState;
};
