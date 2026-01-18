import type { SupabaseClient } from '@supabase/supabase-js';
import { createRun, finishRun, upsertArtifact } from '../storage/supabase.ts';
import type { PlannerGeometry } from '../schemas.ts';

const now = () => new Date().toISOString();

const formatMetric = (value?: number | null, unit?: string) =>
  value !== null && value !== undefined ? `${Math.round(value)}${unit ?? ''}` : '—';

const defaultAssumptions = [
  'Zoning plan is planner-provided or proxy until official dataset is attached.',
  'Baseline proxy dataset used for existing conditions unless overridden by uploaded sources.',
  'Biodiversity heuristic (Santamour 10-20-30) applied based on available inventory.'
];

const buildEvidence = (args: {
  sourceIds: string[];
  hasInventory: boolean;
  geometryProvided: boolean;
}) => {
  const evidence = [
    {
      kind: 'geometry',
      title: 'Intervention geometry',
      sourceId: null
    },
    {
      kind: 'baseline',
      title: 'Baseline proxy dataset',
      sourceId: null
    },
    {
      kind: 'regulatory',
      title: 'Zoning plan check (Planner-provided / not yet connected)',
      sourceId: null
    }
  ];

  if (args.hasInventory) {
    evidence.push({
      kind: 'source',
      title: 'Existing tree inventory (uploaded dataset)',
      sourceId: args.sourceIds[0] ?? null
    });
  }

  if (!args.geometryProvided) {
    evidence.push({
      kind: 'assumption',
      title: 'Geometry pending; metrics provisional',
      sourceId: null
    });
  }

  return evidence;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const buildMemoHtml = (payload: Record<string, unknown>) => {
  const sections = payload.sections as Array<{ title: string; body: string | string[] }>;
  return `
    <article>
      <h2>Compliance Memo</h2>
      ${sections
        .map((section) => {
          const safeTitle = escapeHtml(section.title);
          const body = Array.isArray(section.body)
            ? `<ul>${section.body.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
            : `<p>${escapeHtml(section.body)}</p>`;
          return `<section><h3>${safeTitle}</h3>${body}</section>`;
        })
        .join('')}
    </article>
  `;
};

export const buildPlannerPackArtifacts = (args: {
  municipality?: string | null;
  interventionName: string;
  geometry?: PlannerGeometry | null;
  inventorySummary?: {
    treesCount: number;
    speciesCount: number;
    genusCount?: number;
    missingSpeciesPct: number;
    missingDbhPct: number;
    speciesDistribution?: { top: Array<{ name: string; pct: number }> };
    genusDistribution?: { top: Array<{ name: string; pct: number }> };
    familyDistribution?: { top: Array<{ name: string; pct: number }> };
    tenTwentyThirtyViolations?: string[];
  } | null;
  sourceIds: string[];
}) => {
  const geometryProvided = Boolean(args.geometry?.geojson);
  const assumptionsDetailed = [
    {
      id: 'zoning-proxy',
      statement: 'Zoning plan is planner-provided or proxy until official dataset is attached.',
      basis: 'proxy',
      how_to_validate: 'Attach official zoning plan dataset when available.',
      confidence: 'Medium'
    },
    {
      id: 'baseline-proxy',
      statement: 'Baseline proxy dataset used for existing conditions unless overridden by uploaded sources.',
      basis: 'proxy',
      how_to_validate: 'Upload or connect authoritative baseline dataset.',
      confidence: 'Medium'
    },
    {
      id: 'biodiversity-heuristic',
      statement: 'Biodiversity heuristic (Santamour 10-20-30) applied based on available inventory.',
      basis: 'heuristic',
      how_to_validate: 'Verify inventory completeness and distribution.',
      confidence: 'Low'
    }
  ];
  const assumptions = assumptionsDetailed.map((item) => item.statement);

  const memoSections = [
    {
      title: 'WeFlora concludes that, under the stated assumptions, the proposed intervention complies with applicable municipal and EU-level greening requirements.',
      body: `Prepared by WeFlora on behalf of ${args.municipality ?? 'Municipality'} · ${now()}`
    },
    {
      title: 'Here is the evidence supporting compliance',
      body: [
        'Zoning plan check (Planner-provided / not yet connected)',
        'Spatial exclusion zones verified (proxy)',
        'Biodiversity heuristic (Santamour 10-20-30) applied',
        args.inventorySummary ? 'Existing tree inventory (uploaded dataset)' : 'Existing tree inventory not yet attached'
      ]
    },
    {
      title: 'Existing conditions summary',
      body: [
        `Geometry type: ${args.geometry?.kind ?? 'Pending'}`,
        `Length: ${formatMetric(args.geometry?.lengthM, ' m')}`,
        `Area: ${formatMetric(args.geometry?.areaM2, ' m²')}`,
        args.inventorySummary
          ? `Inventory mapped: species_count ${args.inventorySummary.speciesCount}, genus_count ${args.inventorySummary.genusCount ?? 0}`
          : 'Inventory mapped: pending upload'
      ]
    },
    {
      title: 'Open assumptions & how to validate',
      body: defaultAssumptions
    }
  ];

  const memoPayload = {
    title: 'Compliance Memo',
    assumptions,
    assumptionsDetailed,
    evidence: buildEvidence({
      sourceIds: args.sourceIds,
      hasInventory: Boolean(args.inventorySummary),
      geometryProvided
    }),
    sections: memoSections
  };

  const optionsPayload = {
    title: 'Option Set',
    assumptions,
    assumptionsDetailed,
    evidence: buildEvidence({
      sourceIds: args.sourceIds,
      hasInventory: Boolean(args.inventorySummary),
      geometryProvided
    }),
    options: [
      {
        title: 'Option A — Native green verge',
        intent: 'Baseline greening with native verge planting.',
        plantingMix: 'Diversified native mix aligned with 10-20-30 heuristic.',
        quantities: 'Per 100 m: ~18 trees, 320 shrubs, 180 m² groundcover',
        capexOpex: 'Capex €€ · Opex €€',
        tradeoffs: 'Balanced canopy and biodiversity; moderate maintenance.',
        whenToChoose: 'When baseline compliance and biodiversity gains are the priority.'
      },
      {
        title: 'Option B — Rain-adaptive verge',
        intent: 'Water buffering with bioswale planting and resilient trees.',
        plantingMix: 'Moisture-tolerant mix with drought resilience.',
        quantities: 'Per 100 m: ~14 trees, 260 shrubs, 220 m² swale planting',
        capexOpex: 'Capex €€€ · Opex €€',
        tradeoffs: 'Higher capex for water capture; improved stormwater performance.',
        whenToChoose: 'When runoff mitigation and cooling are key objectives.'
      },
      {
        title: 'Option C — Low-maintenance verge',
        intent: 'Operations-first, reduced upkeep burden.',
        plantingMix: 'Durable mix with fewer species and slower growth.',
        quantities: 'Per 100 m: ~10 trees, 180 shrubs, 140 m² groundcover',
        capexOpex: 'Capex € · Opex €',
        tradeoffs: 'Lower biodiversity gains; highest operational efficiency.',
        whenToChoose: 'When maintenance capacity is constrained.'
      }
    ]
  };

  const procurementPayload = {
    title: 'Procurement Pack',
    assumptions,
    assumptionsDetailed,
    evidence: buildEvidence({
      sourceIds: args.sourceIds,
      hasInventory: Boolean(args.inventorySummary),
      geometryProvided
    }),
    checklist: [
      'Confirm final geometry and corridor width',
      'Verify municipal zoning references',
      'Confirm inventory coverage and missing DBH fields',
      'Prepare species mix aligned with 10-20-30 heuristic'
    ]
  };

  const emailDraftPayload = {
    title: 'Email Draft',
    assumptions,
    assumptionsDetailed,
    evidence: buildEvidence({
      sourceIds: args.sourceIds,
      hasInventory: Boolean(args.inventorySummary),
      geometryProvided
    }),
    subject: `Submission-ready Planner Pack: ${args.interventionName}`,
    body: `Submitted by WeFlora on behalf of ${args.municipality ?? 'Municipality'}.

Attached is the Planner Pack for ${args.interventionName}. It includes the compliance memo, option set, and procurement notes.

Prepared by WeFlora.`
  };

  const speciesMixPayload = {
    title: 'Species mix (10-20-30)',
    assumptions,
    assumptionsDetailed,
    evidence: buildEvidence({
      sourceIds: args.sourceIds,
      hasInventory: Boolean(args.inventorySummary),
      geometryProvided
    }),
    mode: args.inventorySummary ? 'inventory' : 'baseline',
    baselineNote: args.inventorySummary
      ? 'Inventory distribution analyzed against 10-20-30 heuristic.'
      : 'Baseline heuristic mix (no inventory).',
    distribution: args.inventorySummary
      ? {
          species: args.inventorySummary.speciesDistribution?.top ?? [],
          genus: args.inventorySummary.genusDistribution?.top ?? [],
          family: args.inventorySummary.familyDistribution?.top ?? []
        }
      : null,
    violations: args.inventorySummary?.tenTwentyThirtyViolations ?? [],
    recommendation: args.inventorySummary
      ? 'Reduce dominant species/genus/family to meet 10-20-30 targets.'
      : 'Use diversified template mix across species, genus, and family.'
  };

  const maintenancePayload = {
    title: 'Maintenance & Lifecycle Plan',
    preparedBy: `Prepared by WeFlora on behalf of ${args.municipality ?? 'Municipality'}`,
    assumptions,
    assumptionsDetailed,
    evidence: buildEvidence({
      sourceIds: args.sourceIds,
      hasInventory: Boolean(args.inventorySummary),
      geometryProvided
    }),
    schedule: [
      { phase: 'Year 0–1 Establishment', tasks: ['Weekly watering', 'Monthly health inspection'] },
      { phase: 'Year 2–5 Growth', tasks: ['Seasonal pruning', 'Annual safety inspection'] },
      { phase: 'Year 5+ Steady State', tasks: ['Annual pruning', 'Replacement planning'] }
    ],
    mowingGuidance: ['Native verge: 6–8 cuts/year', 'Rain-adaptive: 4–6 cuts/year', 'Low-maintenance: 2–4 cuts/year'],
    opexBands: ['€12–€18 per m² annually (establishment)', '€6–€10 per m² annually (steady state)']
  };

  return {
    memoPayload,
    optionsPayload,
    procurementPayload,
    emailDraftPayload,
    speciesMixPayload,
    maintenancePayload,
    memoHtml: buildMemoHtml(memoPayload)
  };
};

export const plannerPackCompose = async (args: {
  supabase: SupabaseClient;
  interventionId: string;
  municipality?: string | null;
  interventionName: string;
  geometry?: PlannerGeometry | null;
  inventorySummary?: {
    treesCount: number;
    speciesCount: number;
    genusCount?: number;
    missingSpeciesPct: number;
    missingDbhPct: number;
  } | null;
  sourceIds: string[];
}) => {
  const assumptions = {
    items: defaultAssumptions
  };

  const run = await createRun(args.supabase, args.interventionId, 'planner_pack_compose', assumptions);

  try {
    const {
      memoPayload,
      optionsPayload,
      procurementPayload,
      emailDraftPayload,
      speciesMixPayload,
      maintenancePayload,
      memoHtml
    } =
      buildPlannerPackArtifacts({
        municipality: args.municipality,
        interventionName: args.interventionName,
        geometry: args.geometry,
        inventorySummary: args.inventorySummary,
        sourceIds: args.sourceIds
      });

    await upsertArtifact(args.supabase, args.interventionId, {
      runId: run.id,
      type: 'memo',
      payload: memoPayload,
      renderedHtml: memoHtml
    });

    await upsertArtifact(args.supabase, args.interventionId, {
      runId: run.id,
      type: 'options',
      payload: optionsPayload,
      renderedHtml: null
    });

    await upsertArtifact(args.supabase, args.interventionId, {
      runId: run.id,
      type: 'procurement',
      payload: procurementPayload,
      renderedHtml: null
    });

    await upsertArtifact(args.supabase, args.interventionId, {
      runId: run.id,
      type: 'email_draft',
      payload: emailDraftPayload,
      renderedHtml: null
    });

    await upsertArtifact(args.supabase, args.interventionId, {
      runId: run.id,
      type: 'species_mix',
      payload: speciesMixPayload,
      renderedHtml: null
    });

    await upsertArtifact(args.supabase, args.interventionId, {
      runId: run.id,
      type: 'maintenance',
      payload: maintenancePayload,
      renderedHtml: null
    });

    await finishRun(args.supabase, run.id, 'succeeded');

    return {
      memo: memoPayload,
      options: optionsPayload,
      procurement: procurementPayload,
      emailDraft: emailDraftPayload,
      speciesMix: speciesMixPayload,
      maintenance: maintenancePayload
    };
  } catch (error) {
    await finishRun(args.supabase, run.id, 'failed');
    throw error;
  }
};
