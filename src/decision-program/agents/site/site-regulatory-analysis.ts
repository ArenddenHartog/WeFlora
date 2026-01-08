import type { Agent } from '../types.ts';
import { runSiteRegulatoryAnalysis } from '../../skills/siteRegulatoryAnalysis.ts';
import { buildContextPatchesFromDerivedConstraints, buildDerivedInputs } from '../../orchestrator/derivedConstraints.ts';

const pushStepLog = (state: { logs: any[] }, stepId: string, message: string) => {
  state.logs.push({
    level: 'info',
    message,
    data: { stepId },
    timestamp: new Date().toISOString()
  });
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

    pushStepLog(state, stepId, 'Linking citations to timeline evidence…');
    const evidenceRefs = analysis.evidenceItems.map((item) => ({
      sourceId: item.citations[0]?.sourceId ?? item.id,
      claim: item.claim,
      citations: item.citations,
      evidenceItemId: item.id
    }));

    const contextPatches = buildContextPatchesFromDerivedConstraints(analysis.derivedConstraints);

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
