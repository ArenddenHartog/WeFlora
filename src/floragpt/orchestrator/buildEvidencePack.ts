import type { ContextItem, FloraGPTMode } from '../../../types';
import type { EvidencePack } from '../types';
import { floragptTools } from '../tools/index.ts';

const MAX_CHARS = 600;

export const buildEvidencePack = async (args: {
  mode: FloraGPTMode;
  projectId: string;
  query: string;
  contextItems: ContextItem[];
  selectedDocs?: { sourceId: string; sourceType: string }[];
  evidencePolicy?: {
    includeProjectEnvelope: boolean;
    includeGlobalKB: boolean;
    includePolicyDocs: 'only_if_selected' | boolean;
  };
}): Promise<EvidencePack> => {
  const { mode, projectId, query, contextItems, selectedDocs, evidencePolicy } = args;
  const hasPolicySelection = Boolean(selectedDocs?.some((doc) => doc.sourceType === 'policy_manual'));
  const includePolicy = evidencePolicy?.includePolicyDocs === true ||
    (evidencePolicy?.includePolicyDocs === 'only_if_selected' && hasPolicySelection);
  const includeGlobal = evidencePolicy?.includeGlobalKB ?? true;
  const includeProject = evidencePolicy?.includeProjectEnvelope ?? true;

  const [globalHits, projectHits, policyHits] = await Promise.all([
    includeGlobal ? floragptTools.retrieve.global({ query }) : Promise.resolve([]),
    includeProject ? floragptTools.retrieve.project({ projectId, query, contextItems }) : Promise.resolve([]),
    includePolicy || mode === 'policy_compliance'
      ? floragptTools.retrieve.policy({ projectId, query, contextItems })
      : Promise.resolve([])
  ]);

  const rerankedProject = await floragptTools.rerank({ hits: projectHits, topK: 8 });
  const rerankedGlobal = await floragptTools.rerank({ hits: globalHits, topK: 8 });
  const rerankedPolicy = await floragptTools.rerank({ hits: policyHits, topK: 8 });

  const compressedProject = await floragptTools.compress({ hits: rerankedProject, maxChars: MAX_CHARS });
  const compressedGlobal = await floragptTools.compress({ hits: rerankedGlobal, maxChars: MAX_CHARS });
  const compressedPolicy = await floragptTools.compress({ hits: rerankedPolicy, maxChars: MAX_CHARS });

  const scopeProject = `project:${projectId}`;
  const scopedProject = compressedProject.filter((hit) => hit.scope === scopeProject);
  const scopedGlobal = compressedGlobal.filter((hit) => hit.scope === 'global');
  const scopedPolicy = compressedPolicy.filter((hit) => hit.scope === scopeProject);

  const dropped = compressedProject.length + compressedGlobal.length + compressedPolicy.length
    - (scopedProject.length + scopedGlobal.length + scopedPolicy.length);
  if (dropped > 0) {
    console.info('[floragpt:boundary]', {
      projectId,
      dropped
    });
  }

  return {
    globalHits: scopedGlobal,
    projectHits: scopedProject,
    policyHits: scopedPolicy
  };
};
