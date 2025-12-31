import type { ContextItem, FloraGPTMode } from '../../../types';
import type { EvidencePack } from '../types';
import { floragptTools } from '../tools';

const MAX_CHARS = 600;

export const buildEvidencePack = async (args: {
  mode: FloraGPTMode;
  projectId: string;
  query: string;
  contextItems: ContextItem[];
}): Promise<EvidencePack> => {
  const { mode, projectId, query, contextItems } = args;

  const [globalHits, projectHits, policyHits] = await Promise.all([
    floragptTools.retrieve.global({ query }),
    floragptTools.retrieve.project({ projectId, query, contextItems }),
    mode === 'policy_compliance'
      ? floragptTools.retrieve.policy({ projectId, query, contextItems })
      : Promise.resolve([])
  ]);

  const rerankedProject = await floragptTools.rerank({ hits: projectHits, topK: 8 });
  const rerankedGlobal = await floragptTools.rerank({ hits: globalHits, topK: 8 });
  const rerankedPolicy = await floragptTools.rerank({ hits: policyHits, topK: 8 });

  const compressedProject = await floragptTools.compress({ hits: rerankedProject, maxChars: MAX_CHARS });
  const compressedGlobal = await floragptTools.compress({ hits: rerankedGlobal, maxChars: MAX_CHARS });
  const compressedPolicy = await floragptTools.compress({ hits: rerankedPolicy, maxChars: MAX_CHARS });

  return {
    globalHits: compressedGlobal,
    projectHits: compressedProject,
    policyHits: compressedPolicy
  };
};
