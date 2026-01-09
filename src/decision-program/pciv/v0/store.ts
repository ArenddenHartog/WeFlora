import type { PcivCommittedContext, PcivContextIntakeRun, PcivDraft } from './types';
import { buildPcivFields } from './map';
import { computePcivMetrics } from './metrics';

const STORAGE_PREFIX = 'pciv_v0_context';

const now = () => new Date().toISOString();

const buildId = () => `pciv-${crypto.randomUUID()}`;

const storageKey = (projectId: string) => `${STORAGE_PREFIX}:${projectId}`;

const defaultDraft = (projectId: string, userId?: string | null): PcivDraft => ({
  projectId,
  runId: null,
  userId: userId ?? null,
  locationHint: '',
  sources: [],
  fields: buildPcivFields(),
  constraints: [],
  errors: []
});

const defaultRun = (projectId: string, userId?: string | null): PcivContextIntakeRun => {
  const draft = defaultDraft(projectId, userId);
  return {
    id: buildId(),
    projectId,
    userId: userId ?? null,
    runId: null,
    status: 'draft',
    draft,
    commit: null,
    metrics: computePcivMetrics(draft),
    createdAt: now(),
    updatedAt: now()
  };
};

export const loadPcivRun = (projectId: string, userId?: string | null): PcivContextIntakeRun => {
  const raw = window.localStorage.getItem(storageKey(projectId));
  if (!raw) return defaultRun(projectId, userId);
  try {
    const parsed = JSON.parse(raw) as PcivContextIntakeRun;
    if (!parsed?.draft?.fields) {
      return defaultRun(projectId, userId);
    }
    const mergedFields = { ...buildPcivFields(), ...parsed.draft.fields };
    const draft = { ...parsed.draft, fields: mergedFields };
    const metrics = computePcivMetrics(draft);
    return {
      ...parsed,
      draft,
      metrics
    };
  } catch (error) {
    console.warn('pciv_v0_load_failed', error);
    return defaultRun(projectId, userId);
  }
};

export const loadPcivCommit = (projectId: string, userId?: string | null) => {
  const run = loadPcivRun(projectId, userId);
  return run.commit ?? null;
};

export const savePcivRun = (run: PcivContextIntakeRun) => {
  window.localStorage.setItem(storageKey(run.projectId), JSON.stringify(run));
};

export const updatePcivDraft = (run: PcivContextIntakeRun, draft: PcivDraft): PcivContextIntakeRun => {
  const metrics = computePcivMetrics(draft);
  const next: PcivContextIntakeRun = {
    ...run,
    status: 'draft',
    draft,
    metrics,
    updatedAt: now()
  };
  savePcivRun(next);
  return next;
};

export const commitPcivDraft = (
  run: PcivContextIntakeRun,
  allowPartial: boolean
): { run: PcivContextIntakeRun; commit: PcivCommittedContext } => {
  const metrics = computePcivMetrics(run.draft);
  const commit: PcivCommittedContext = {
    status: allowPartial ? 'partial_committed' : 'committed',
    committed_at: now(),
    allow_partial: allowPartial,
    projectId: run.projectId,
    runId: run.runId ?? null,
    userId: run.userId ?? null,
    sources: run.draft.sources,
    fields: run.draft.fields,
    constraints: run.draft.constraints,
    metrics
  };
  const next: PcivContextIntakeRun = {
    ...run,
    status: commit.status,
    commit,
    metrics,
    updatedAt: now()
  };
  savePcivRun(next);
  return { run: next, commit };
};

export const updatePcivRunId = (run: PcivContextIntakeRun, runId: string) => {
  if (!run) return run;
  const next = {
    ...run,
    runId,
    draft: { ...run.draft, runId },
    commit: run.commit ? { ...run.commit, runId } : run.commit,
    updatedAt: now()
  };
  savePcivRun(next);
  return next;
};
