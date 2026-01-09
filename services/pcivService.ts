import type { Claim, Constraint, EvidenceGraphSnapshot, EvidenceItem, Source } from '../src/decision-program/pciv/types.ts';
import { addSource, confirmConstraints, createContextVersion, extractContext, getConstraints, getGraph, updateClaim } from '../src/decision-program/pciv/store.ts';

export const createPlanningContext = async () => createContextVersion();

export const registerSource = async (
  contextVersionId: string,
  source: Omit<Source, 'contextVersionId' | 'createdAt' | 'sourceId'>
): Promise<Source> => addSource(contextVersionId, source);

export const runExtraction = async (
  contextVersionId: string
): Promise<{ evidenceItems: EvidenceItem[]; claims: Claim[] }> => extractContext(contextVersionId);

export const reviewClaim = async (
  contextVersionId: string,
  claimId: string,
  payload: { status: Claim['status']; correctedValue?: unknown; correctedUnit?: string }
): Promise<void> => {
  updateClaim(contextVersionId, claimId, payload);
};

export const lockConstraints = async (contextVersionId: string): Promise<Constraint[]> =>
  confirmConstraints(contextVersionId);

export const fetchGraph = async (contextVersionId: string): Promise<EvidenceGraphSnapshot> => getGraph(contextVersionId);

export const fetchConstraints = async (contextVersionId: string): Promise<Constraint[]> =>
  getConstraints(contextVersionId);
