import type { AgentProfile } from '../../decision-program/contracts/types';
import type { ComputeReadinessArgs, SkillReadinessResult } from './types';
import { computeSkillReadiness } from './computeSkillReadiness';
import type { VaultIndex } from '../vault/vaultIndex';
import type { VaultRecord } from './types';

export type SelectionState = Partial<ComputeReadinessArgs['existingBindings']>;

const cache = new Map<string, SkillReadinessResult>();

const buildSelectionHash = (selection?: SelectionState) => {
  if (!selection) return 'none';
  return JSON.stringify(selection);
};

const buildKey = (args: { indexUpdatedAt: number; profile: AgentProfile; selection?: SelectionState }) => {
  const selectionHash = buildSelectionHash(args.selection);
  return `${args.indexUpdatedAt}:${args.profile.id}:${args.profile.spec_version}:${selectionHash}`;
};

export const computeReadiness = (
  index: VaultIndex,
  profile: AgentProfile,
  selection?: SelectionState,
  opts?: ComputeReadinessArgs['opts']
): SkillReadinessResult => {
  const key = buildKey({ indexUpdatedAt: index.updatedAt, profile, selection });
  const existing = cache.get(key);
  if (existing) return existing;

  const vault: VaultRecord[] = Array.from(index.byId.values());
  const result = computeSkillReadiness({ profile, vault, existingBindings: selection, opts });
  cache.set(key, result);
  return result;
};

export const clearReadinessCache = () => {
  cache.clear();
};
