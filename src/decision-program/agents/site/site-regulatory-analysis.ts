import type { Agent } from '../types.ts';
import { runSiteRegulatoryAnalysis } from '../../skills/siteRegulatoryAnalysis.ts';
import { buildContextPatchesFromDerivedConstraints, buildDerivedInputs } from '../../orchestrator/derivedConstraints.ts';
import { buildRegistryInputs } from '../../orchestrator/pointerInputRegistry.ts';
import {
  buildArtifactNodeId,
  buildClaimNodeId,
  buildConstraintNodeId,
  buildSkillNodeId,
  buildSourceNodeId,
  createEmptyEvidenceGraph,
  mergeEvidenceGraph
} from '../../orchestrator/evidenceGraph.ts';

const pushStepLog = (state: { logs: any[] }, stepId: string, message: string) => {
  state.logs.push({
    level: 'info',
    message,
    data: { stepId },
    timestamp: new Date().toISOString()
  });
};

const getPointerLabels = () => {
  const registryInputs = buildRegistryInputs();
  return registryInputs.reduce<Record<string, string>>((acc, input) => {
    acc[input.pointer] = input.label;
    return acc;
  }, {});
};

export const siteRegulatoryAnalysis: Agent = {
  id: 'site-regulatory-analysis',
  title: 'Strategic site & regulatory analysis',
  phase: 'site',
  requiredPointers: [],
  producesPointers: ['/derivedConstraints', '/context/site/constraints'],
  run: async ({ context, step, state }) => {
    const stepId = step?.id ?? 'site:strategic-site-regulatory-analysis';
    const selectedDocs = context.selectedDocs ?? [];
    const locationHint = (context.site as any)?.geo?.locationHint as string | undefined;

    if (selectedDocs.length === 0 && !locationHint) {
      pushStepLog(state, stepId, 'Awaiting documents or a location hint to begin analysis');
      return { patches: [] };
    }

    const docNames = selectedDocs
      .map((doc) => doc.title ?? (doc as any).name ?? doc.id)
      .filter(Boolean)
      .slice(0, 4)
      .join(', ');
    pushStepLog(
      state,
      stepId,
      `Reading documents${docNames ? `: ${docNames}` : ''}…`
    );
    const analysis = await runSiteRegulatoryAnalysis({
      fileRefs: selectedDocs,
      locationHint
    });

    pushStepLog(state, stepId, `Extracting constraints from ${analysis.evidenceSources.length} sources…`);
    const derivedInputs = buildDerivedInputs(analysis.derivedConstraints, analysis.evidenceByPointer, analysis.timelineEntry.id);
    const pointerLabels = getPointerLabels();

    pushStepLog(state, stepId, 'Linking citations to timeline evidence…');
    const evidenceRefs = analysis.evidenceItems.map((item) => ({
      sourceId: item.citations[0]?.sourceId ?? item.id,
      claim: item.claim,
      citations: item.citations,
      evidenceItemId: item.id
    }));

    const contextPatches = buildContextPatchesFromDerivedConstraints(analysis.derivedConstraints);
    const evidenceGraph = createEmptyEvidenceGraph();
    const skillNodeId = buildSkillNodeId('site-regulatory-analysis');
    const artifactNodeId = buildArtifactNodeId('artifact-constraints');

    evidenceGraph.nodes.push({
      id: skillNodeId,
      type: 'skill',
      label: 'site_regulatory_analysis',
      description: 'Extracts regulatory and site constraints from evidence sources.'
    });
    evidenceGraph.nodes.push({
      id: artifactNodeId,
      type: 'artifact',
      label: 'Constraints object',
      metadata: { href: '#planning-constraints' }
    });
    evidenceGraph.edges.push({ from: skillNodeId, to: artifactNodeId, type: 'produced_by' });

    analysis.evidenceSources.forEach((source) => {
      evidenceGraph.nodes.push({
        id: buildSourceNodeId(source.id),
        type: 'source',
        label: source.title,
        metadata: { sourceId: source.id }
      });
    });

    analysis.evidenceItems.forEach((item) => {
      const claimNodeId = buildClaimNodeId(item.id);
      evidenceGraph.nodes.push({
        id: claimNodeId,
        type: 'claim',
        label: item.claim,
        metadata: {
          evidenceItemId: item.id,
          citations: item.citations,
          timelineEntryId: analysis.timelineEntry.id
        }
      });
      item.citations.forEach((citation) => {
        evidenceGraph.edges.push({
          from: buildSourceNodeId(citation.sourceId),
          to: claimNodeId,
          type: 'supports',
          confidence: citation.confidence
        });
      });
    });

    Object.values(derivedInputs).forEach((input) => {
      const constraintNodeId = buildConstraintNodeId(input.pointer);
      evidenceGraph.nodes.push({
        id: constraintNodeId,
        type: 'constraint',
        label: pointerLabels[input.pointer] ?? input.pointer,
        description: `Value: ${String(input.value)}`,
        metadata: {
          pointer: input.pointer,
          value: input.value,
          confidence: input.confidence,
          timelineEntryId: analysis.timelineEntry.id
        }
      });
      (input.evidenceItemIds ?? []).forEach((evidenceItemId) => {
        evidenceGraph.edges.push({
          from: buildClaimNodeId(evidenceItemId),
          to: constraintNodeId,
          type: 'derived_from',
          confidence: input.confidence
        });
      });
    });

    return {
      patches: [
        ...contextPatches,
        {
          pointer: '/derivedConstraints',
          value: analysis.derivedConstraints
        },
        {
          pointer: '/evidenceSources',
          value: analysis.evidenceSources
        },
        {
          pointer: '/evidenceItems',
          value: analysis.evidenceItems
        },
        {
          pointer: '/timelineEntries',
          value: [...(state.timelineEntries ?? []), analysis.timelineEntry]
        },
        {
          pointer: '/derivedInputs',
          value: derivedInputs
        },
        {
          pointer: '/evidenceGraph',
          value: mergeEvidenceGraph(state.evidenceGraph, evidenceGraph)
        },
        {
          pointer: `/evidenceIndex/${stepId}`,
          value: evidenceRefs
        },
        {
          pointer: '/context/site/constraints',
          value: {
            source: 'strategic_analysis',
            summary: analysis.timelineEntry.summary
          }
        }
      ]
    };
  }
};
