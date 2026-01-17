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

const buildMemoHtml = (payload: Record<string, unknown>) => {
  const sections = payload.sections as Array<{ title: string; body: string | string[] }>;
  return `
    <article>
      <h2>Compliance Memo</h2>
      ${sections
        .map((section) => {
          const body = Array.isArray(section.body)
            ? `<ul>${section.body.map((item) => `<li>${item}</li>`).join('')}</ul>`
            : `<p>${section.body}</p>`;
          return `<section><h3>${section.title}</h3>${body}</section>`;
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
  } | null;
  sourceIds: string[];
}) => {
  const geometryProvided = Boolean(args.geometry?.geojson);
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
    assumptions: defaultAssumptions,
    evidence: buildEvidence({
      sourceIds: args.sourceIds,
      hasInventory: Boolean(args.inventorySummary),
      geometryProvided
    }),
    sections: memoSections
  };

  const optionsPayload = {
    title: 'Option Set',
    assumptions: defaultAssumptions,
    evidence: buildEvidence({
      sourceIds: args.sourceIds,
      hasInventory: Boolean(args.inventorySummary),
      geometryProvided
    }),
    options: [
      {
        title: 'Shade-first street trees',
        summary: 'Prioritize canopy coverage with resilient native street trees.'
      },
      {
        title: 'Water-first bioswale + trees',
        summary: 'Integrate bioswales with tree rows for cooling and stormwater control.'
      },
      {
        title: 'Biodiversity-first pocket habitats',
        summary: 'Introduce habitat pockets and diverse species mix for resilience.'
      }
    ]
  };

  const procurementPayload = {
    title: 'Procurement Pack',
    assumptions: defaultAssumptions,
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
    assumptions: defaultAssumptions,
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

  return {
    memoPayload,
    optionsPayload,
    procurementPayload,
    emailDraftPayload,
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
    const { memoPayload, optionsPayload, procurementPayload, emailDraftPayload, memoHtml } =
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

    await finishRun(args.supabase, run.id, 'succeeded');

    return {
      memo: memoPayload,
      options: optionsPayload,
      procurement: procurementPayload,
      emailDraft: emailDraftPayload
    };
  } catch (error) {
    await finishRun(args.supabase, run.id, 'failed');
    throw error;
  }
};
