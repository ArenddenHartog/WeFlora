import type { PcivContextViewV1, PcivScopeId, ResolveContextViewArgs } from '../../pciv/v1/schemas.ts';
import { resolveContextView } from '../../pciv/v1/resolveContextView.ts';

export const getContextViewForSkill = async (
  args: ResolveContextViewArgs & { scopeId: PcivScopeId },
  deps?: Parameters<typeof resolveContextView>[1]
): Promise<PcivContextViewV1> => {
  return resolveContextView({ ...args, prefer: 'latest_commit' }, deps);
};
