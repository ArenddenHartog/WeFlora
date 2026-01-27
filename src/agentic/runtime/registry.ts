import type { AgentProfile } from '../contracts/zod.ts';
import { agentProfiles } from '../registry/agents.ts';

const registry = new Map<string, AgentProfile[]>();

agentProfiles.forEach((profile) => {
  const list = registry.get(profile.agent_id) ?? [];
  list.push(profile);
  registry.set(profile.agent_id, list);
});

export const listAgentProfiles = (): AgentProfile[] =>
  Array.from(registry.values()).flat();

export const getAgentProfile = (agentId: string, version?: string): AgentProfile | undefined => {
  const entries = registry.get(agentId) ?? [];
  if (!version) return entries[0];
  return entries.find((profile) => profile.spec_version === version);
};
