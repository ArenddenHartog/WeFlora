import type { SupabaseClient } from '@supabase/supabase-js';
import { createRun, finishRun, updateSourceParseStatus, upsertArtifact } from '../storage/supabase.ts';

const parseCsv = (text: string) => {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [] as Record<string, string>[];
  const headers = lines[0].split(',').map((cell) => cell.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(',').map((cell) => cell.trim());
    return headers.reduce<Record<string, string>>((acc, header, index) => {
      acc[header] = cells[index] ?? '';
      return acc;
    }, {});
  });
};

const titleCase = (value: string) =>
  value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(' ');

const normalizeSpecies = (value: string) => titleCase(value.trim());

const columnKey = (header: string) => header.toLowerCase().replace(/[^a-z0-9]/g, '');

const resolveColumn = (headers: string[], candidates: string[]) => {
  const normalized = headers.map((header) => ({ header, key: columnKey(header) }));
  const candidateKeys = candidates.map((candidate) => columnKey(candidate));
  const match = normalized.find((entry) => candidateKeys.includes(entry.key));
  return match?.header ?? null;
};

const computeDistribution = (values: string[]) => {
  const total = values.length;
  const counts = values.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
  const top = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count, pct: total ? count / total : 0 }));
  return { total, top };
};

const computeTenTwentyThirty = (distribution: { top: Array<{ name: string; pct: number }> }) => {
  const violations: string[] = [];
  distribution.top.forEach((entry) => {
    if (entry.pct > 0.1) violations.push(`Species ${entry.name} exceeds 10% (${Math.round(entry.pct * 100)}%)`);
  });
  return violations;
};

export const parseInventoryCsv = (fileText: string) => {
  const rows = parseCsv(fileText);
  if (!rows.length) {
    return {
      rows: [],
      parseReport: { error: 'No rows detected', rows: 0 },
      summary: null
    };
  }

  const headers = Object.keys(rows[0]);
  const speciesHeader = resolveColumn(headers, ['species', 'species_name', 'tree_species']);
  const genusHeader = resolveColumn(headers, ['genus']);
  const familyHeader = resolveColumn(headers, ['family']);
  const dbhHeader = resolveColumn(headers, ['dbh', 'diameter', 'diameter_cm', 'dbh_cm']);

  let missingSpecies = 0;
  let missingDbh = 0;
  const speciesSet = new Set<string>();
  const genusSet = new Set<string>();
  const familySet = new Set<string>();

  const speciesValues: string[] = [];
  const genusValues: string[] = [];
  const familyValues: string[] = [];

  rows.forEach((row) => {
    const species = speciesHeader ? row[speciesHeader] ?? '' : '';
    const genus = genusHeader ? row[genusHeader] ?? '' : '';
    const family = familyHeader ? row[familyHeader] ?? '' : '';
    const dbh = dbhHeader ? row[dbhHeader] ?? '' : '';

    if (!species?.trim()) {
      missingSpecies += 1;
    } else {
      const normalized = normalizeSpecies(species);
      speciesSet.add(normalized);
      speciesValues.push(normalized);
    }

    if (!dbh?.trim()) {
      missingDbh += 1;
    }

    if (genus?.trim()) {
      const normalized = titleCase(genus);
      genusSet.add(normalized);
      genusValues.push(normalized);
    }
    if (family?.trim()) {
      const normalized = titleCase(family);
      familySet.add(normalized);
      familyValues.push(normalized);
    }
  });

  const treesCount = rows.length;
  const missingSpeciesPct = treesCount ? missingSpecies / treesCount : 1;
  const missingDbhPct = treesCount ? missingDbh / treesCount : 1;

  const qualityFlags: string[] = [];
  if (!speciesHeader) qualityFlags.push('No species column detected');
  if (missingSpeciesPct > 0.25) qualityFlags.push('High missing species rate');
  if (missingDbhPct > 0.25) qualityFlags.push('High missing DBH rate');

  const speciesDistribution = computeDistribution(speciesValues);
  const genusDistribution = computeDistribution(genusValues);
  const familyDistribution = computeDistribution(familyValues);
  const tenTwentyThirtyViolations = [
    ...computeTenTwentyThirty(speciesDistribution),
    ...genusDistribution.top
      .filter((entry) => entry.pct > 0.2)
      .map((entry) => `Genus ${entry.name} exceeds 20% (${Math.round(entry.pct * 100)}%)`),
    ...familyDistribution.top
      .filter((entry) => entry.pct > 0.3)
      .map((entry) => `Family ${entry.name} exceeds 30% (${Math.round(entry.pct * 100)}%)`)
  ];

  const parseReport = {
    rows: treesCount,
    speciesHeader,
    genusHeader,
    familyHeader,
    dbhHeader,
    speciesCount: speciesSet.size,
    genusCount: genusSet.size,
    familyCount: familySet.size,
    missingSpeciesPct,
    missingDbhPct,
    qualityFlags,
    speciesDistribution,
    genusDistribution,
    familyDistribution,
    tenTwentyThirtyViolations
  };

  const summary = {
    treesCount,
    speciesCount: speciesSet.size,
    genusCount: genusSet.size,
    missingSpeciesPct,
    missingDbhPct,
    speciesDistribution,
    genusDistribution,
    familyDistribution,
    tenTwentyThirtyViolations
  };

  return { rows, parseReport, summary };
};

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
