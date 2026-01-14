import type { PcivCommittedContext, PcivContextIntakeRun, PcivDraft, PcivSource } from './types.ts';
import { buildPcivFields } from './map.ts';
import { computePcivMetrics } from './metrics.ts';
import { FEATURES } from '../../../config/features.ts';

const STORAGE_PREFIX = 'pciv_v0_context';
const MAX_STORAGE_CHARS = 2_000_000;

const now = () => new Date().toISOString();

const buildId = () => `pciv-${crypto.randomUUID()}`;

const storageKey = (projectId: string) => `${STORAGE_PREFIX}:${projectId}`;

const sanitizeSourceForStorage = (source: PcivSource): PcivSource => ({
  id: source.id,
  type: source.type,
  name: source.name,
  mimeType: source.mimeType,
  size: source.size,
  status: source.status,
  createdAt: source.createdAt,
  error: source.error
});

const sanitizeDraftForStorage = (draft: PcivDraft): PcivDraft => ({
  ...draft,
  sources: draft.sources.map(sanitizeSourceForStorage)
});

const sanitizeCommitForStorage = (commit: PcivCommittedContext): PcivCommittedContext => ({
  ...commit,
  sources: commit.sources.map(sanitizeSourceForStorage)
});

const sanitizePcivRun = (run: PcivContextIntakeRun): PcivContextIntakeRun => ({
  ...run,
  draft: sanitizeDraftForStorage(run.draft),
  commit: run.commit ? sanitizeCommitForStorage(run.commit) : run.commit
});

const compactPcivRun = (run: PcivContextIntakeRun): PcivContextIntakeRun => {
  const sourcesLimit = 50;
  return {
    ...run,
    draft: {
      ...run.draft,
      sources: run.draft.sources.slice(0, sourcesLimit),
      errors: []
    },
    commit: run.commit
      ? {
          ...run.commit,
          sources: run.commit.sources.slice(0, sourcesLimit)
        }
      : run.commit
  };
};

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
  // PCIV v1.2 kill-switch: block v0 localStorage access when fallback disabled
  if (!FEATURES.pcivV0Fallback) {
    console.warn('pciv_v0_access_blocked: v0 fallback disabled, returning fresh draft');
    return defaultRun(projectId, userId);
  }
  
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
  // PCIV v1.2 kill-switch: block v0 localStorage writes when fallback disabled
  if (!FEATURES.pcivV0Fallback) {
    console.warn('pciv_v0_write_blocked: v0 fallback disabled, skipping localStorage write');
    return;
  }
  
  const sanitized = sanitizePcivRun(run);
  let serialized = JSON.stringify(sanitized);
  if (serialized.length > MAX_STORAGE_CHARS) {
    console.warn('pciv_v0_storage_compact', { size: serialized.length });
    const compacted = compactPcivRun(sanitized);
    serialized = JSON.stringify(compacted);
  }
  window.localStorage.setItem(storageKey(run.projectId), serialized);
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
