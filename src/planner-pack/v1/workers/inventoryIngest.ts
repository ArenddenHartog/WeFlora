import type { SupabaseClient } from '@supabase/supabase-js';
import { parseInventoryCsv } from './inventoryParse.ts';
import { createRun, finishRun, updateSourceParseStatus, upsertArtifact } from '../storage/supabase.ts';

export { parseInventoryCsv } from './inventoryParse.ts';

export const inventoryIngest = async (args: {
  supabase: SupabaseClient;
  interventionId: string;
  sourceId: string;
  fileText: string;
  geometryId?: string | null;
}) => {
  const assumptions = {
    note: 'Inventory provided by user upload; column mappings inferred.'
  };

  const run = await createRun(args.supabase, args.interventionId, 'inventory_ingest', assumptions);

  try {
    const { rows, parseReport, summary } = parseInventoryCsv(args.fileText);
    if (!rows.length || !summary) {
      await updateSourceParseStatus(args.supabase, args.sourceId, {
        parseStatus: 'failed',
        parseReport
      });
      await finishRun(args.supabase, run.id, 'failed');
      return null;
    }

    const missingSpeciesPct = summary.missingSpeciesPct;
    const parseStatus = missingSpeciesPct > 0.5 ? 'partial' : 'parsed';

    await updateSourceParseStatus(args.supabase, args.sourceId, {
      parseStatus,
      parseReport
    });

    const artifactPayload = {
      assumptions: [assumptions.note],
      evidence: [
        {
          kind: 'source',
          sourceId: args.sourceId,
          title: 'Uploaded tree inventory'
        }
      ],
      inventorySummary: {
        treesCount: summary.treesCount,
        speciesCount: summary.speciesCount,
        genusCount: summary.genusCount,
        missingSpeciesPct: summary.missingSpeciesPct,
        missingDbhPct: summary.missingDbhPct
      },
      qualityFlags: 'qualityFlags' in parseReport ? parseReport.qualityFlags ?? [] : [],
      speciesMix: {
        mode: 'inventory',
        speciesDistribution: summary.speciesDistribution,
        genusDistribution: summary.genusDistribution,
        familyDistribution: summary.familyDistribution,
        violations: summary.tenTwentyThirtyViolations
      }
    };

    await upsertArtifact(args.supabase, args.interventionId, {
      runId: run.id,
      type: 'check_report',
      payload: artifactPayload
    });

    await finishRun(args.supabase, run.id, 'succeeded');

    return artifactPayload;
  } catch (error) {
    await updateSourceParseStatus(args.supabase, args.sourceId, {
      parseStatus: 'failed',
      parseReport: { error: (error as Error).message }
    });
    await finishRun(args.supabase, run.id, 'failed');
    throw error;
  }
};
