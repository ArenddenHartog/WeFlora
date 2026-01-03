import type { ContextItem, FloraGPTMode } from '../../../types';
import type { EvidencePack } from '../types';
import { floragptTools } from '../tools/index.ts';

const MAX_CHARS = 600;

const buildSelectedHit = (args: {
  sourceId: string;
  sourceType: 'upload' | 'global_kb' | 'policy_manual' | 'project' | 'worksheet' | 'report';
  title?: string;
  scope: string;
  index: number;
}): EvidenceHit => ({
  sourceId: args.sourceId,
  sourceType: args.sourceType,
  title: args.title || 'Selected document',
  locationHint: `selected#${args.index + 1}`,
  snippet: `Selected source: ${args.title || args.sourceId}`,
  scope: args.scope
});

export const buildEvidencePack = async (args: {
  mode: FloraGPTMode;
  projectId: string;
  query: string;
  contextItems: ContextItem[];
  selectedDocs?: { sourceId: string; sourceType: string }[];
  worksheetContextHit?: {
    sourceId: string;
    scope: string;
    sourceType: 'worksheet';
    title: string;
    locationHint: string;
    snippet: string;
  } | null;
  evidencePolicy?: {
    includeProjectEnvelope: boolean;
    includeGlobalKB: boolean;
    includePolicyDocs: 'only_if_selected' | boolean;
  };
}): Promise<EvidencePack> => {
  const { mode, projectId, query, contextItems, selectedDocs, evidencePolicy, worksheetContextHit } = args;
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

  const worksheetHit = worksheetContextHit && worksheetContextHit.scope === scopeProject
    ? [{
      sourceId: worksheetContextHit.sourceId,
      sourceType: worksheetContextHit.sourceType,
      title: worksheetContextHit.title,
      locationHint: worksheetContextHit.locationHint,
      snippet: worksheetContextHit.snippet,
      scope: worksheetContextHit.scope
    }]
    : [];

  const dropped = compressedProject.length + compressedGlobal.length + compressedPolicy.length
    - (scopedProject.length + scopedGlobal.length + scopedPolicy.length);
  if (dropped > 0) {
    console.info('[floragpt:boundary]', {
      projectId,
      dropped
    });
  }

  const selectedProjectDocs = (selectedDocs || [])
    .filter((doc) => doc.scope === scopeProject);
  const selectedHits = selectedProjectDocs
    .filter((doc) => !scopedProject.some((hit) => hit.sourceId === doc.sourceId))
    .map((doc, index) => buildSelectedHit({
      sourceId: doc.sourceId,
      sourceType: doc.sourceType as EvidenceHit['sourceType'],
      title: doc.title,
      scope: doc.scope,
      index
    }));

  const ensuredProjectHits = selectedProjectDocs.length > 0 && scopedProject.length + selectedHits.length === 0
    ? [buildSelectedHit({
      sourceId: selectedProjectDocs[0].sourceId,
      sourceType: selectedProjectDocs[0].sourceType as EvidenceHit['sourceType'],
      title: selectedProjectDocs[0].title,
      scope: scopeProject,
      index: 0
    })]
    : [];

  return {
    globalHits: scopedGlobal,
    projectHits: [...worksheetHit, ...scopedProject, ...selectedHits, ...ensuredProjectHits],
    policyHits: scopedPolicy
  };
};
