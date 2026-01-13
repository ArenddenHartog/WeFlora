import {
  PcivContextViewV1Schema,
  type PcivContextViewV1,
  type ResolveContextViewArgs
} from './schemas.ts';
import * as storage from './storage/supabase.ts';

const toTimestamp = (value?: string | null) => (value ? new Date(value).getTime() : 0);

const pickLatestCommittedRun = (runs: Array<{ id: string; status: string; committedAt: string | null; updatedAt: string }>) => {
  const committed = runs.filter((run) => run.status === 'committed' || run.status === 'partial_committed');
  if (committed.length === 0) return null;
  const sorted = [...committed].sort((a, b) => {
    const committedDiff = toTimestamp(b.committedAt) - toTimestamp(a.committedAt);
    if (committedDiff !== 0) return committedDiff;
    const updatedDiff = toTimestamp(b.updatedAt) - toTimestamp(a.updatedAt);
    if (updatedDiff !== 0) return updatedDiff;
    return a.id.localeCompare(b.id);
  });
  return sorted[0];
};

const normalizeContextView = (view: PcivContextViewV1): PcivContextViewV1 => {
  const constraints = [...view.constraints].sort((a, b) => {
    const keyDiff = a.key.localeCompare(b.key);
    if (keyDiff !== 0) return keyDiff;
    return a.id.localeCompare(b.id);
  });

  const artifactsByType = Object.keys(view.artifactsByType)
    .sort((a, b) => a.localeCompare(b))
    .reduce<Record<string, PcivContextViewV1['artifactsByType'][string]>>((acc, type) => {
      const sortedArtifacts = [...(view.artifactsByType[type] ?? [])].sort((a, b) => {
        const createdDiff = toTimestamp(a.createdAt) - toTimestamp(b.createdAt);
        if (createdDiff !== 0) return createdDiff;
        return a.id.localeCompare(b.id);
      });
      acc[type] = sortedArtifacts;
      return acc;
    }, {});

  const sourcesById = Object.keys(view.sourcesById)
    .sort((a, b) => a.localeCompare(b))
    .reduce<Record<string, PcivContextViewV1['sourcesById'][string]>>((acc, id) => {
      acc[id] = view.sourcesById[id];
      return acc;
    }, {});

  const inputsByPointer = Object.keys(view.inputsByPointer)
    .sort((a, b) => a.localeCompare(b))
    .reduce<Record<string, PcivContextViewV1['inputsByPointer'][string]>>((acc, pointer) => {
      acc[pointer] = view.inputsByPointer[pointer];
      return acc;
    }, {});

  return {
    ...view,
    constraints,
    artifactsByType,
    sourcesById,
    inputsByPointer
  };
};

export type { ResolveContextViewArgs } from './schemas.ts';

export const resolveContextView = async (
  args: ResolveContextViewArgs,
  deps: Pick<typeof storage, 'listRunsForScope' | 'fetchContextViewByRunId'> = storage
): Promise<PcivContextViewV1> => {
  const prefer = args.prefer ?? 'latest_commit';
  let runId = args.runId ?? null;

  if (prefer === 'latest_commit' || !runId) {
    const runs = await deps.listRunsForScope(args.scopeId, args.userId ?? undefined);
    const latest = pickLatestCommittedRun(runs);
    runId = latest?.id ?? null;
  }

  if (!runId) {
    throw new Error('No committed PCIV v1 context found.');
  }

  const view = await deps.fetchContextViewByRunId(runId);
  const normalized = normalizeContextView(view);
  return PcivContextViewV1Schema.parse(normalized);
};
