import type { AgentRegistry } from './types.ts';
import { deriveSiteConstraints } from './site/derive-site-constraints.ts';
import { siteRegulatoryAnalysis } from './site/site-regulatory-analysis.ts';
import { generateCandidates } from './species/generate-candidates.ts';
import { scoreCandidates } from './species/score-candidates.ts';
import { diversityCheck } from './species/diversity-check.ts';
import { availabilityReconcile } from './supply/availability-reconcile.ts';

export const buildAgentRegistry = (): AgentRegistry => {
  const registry: AgentRegistry = new Map();
  [
    siteRegulatoryAnalysis,
    deriveSiteConstraints,
    generateCandidates,
    scoreCandidates,
    diversityCheck,
    availabilityReconcile
  ].forEach((agent) => registry.set(agent.id, agent));
  return registry;
};
