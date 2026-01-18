import type { SupabaseClient } from '@supabase/supabase-js';
import { createRun, finishRun, upsertArtifact } from '../storage/supabase.ts';
import type { PlannerGeometry } from '../schemas.ts';

const buildAssumptions = (municipality?: string | null) => [
  {
    id: 'maintenance-baseline',
    statement: 'Maintenance schedule based on standard municipal verge programs.',
    basis: 'proxy',
    how_to_validate: 'Confirm local maintenance contracts and seasonal constraints.',
    confidence: 'Medium'
  },
  {
    id: 'opex-bands',
    statement: 'Opex bands reflect NL municipal averages for green verge maintenance.',
    basis: 'proxy',
    how_to_validate: 'Replace with supplier quotes when procurement starts.',
    confidence: 'Low'
  },
  {
    id: 'municipality-context',
    statement: `Prepared for ${municipality ?? 'Municipality'} default maintenance cadence.`,
    basis: 'context',
    how_to_validate: 'Validate with municipal operations lead.',
    confidence: 'High'
  }
];

export const maintenanceLifecycle = async (args: {
  supabase: SupabaseClient;
  interventionId: string;
  municipality?: string | null;
  geometry?: PlannerGeometry | null;
}) => {
  const assumptions = {
    items: buildAssumptions(args.municipality)
  };

  const run = await createRun(args.supabase, args.interventionId, 'maintenance_lifecycle', assumptions);

  try {
    const area = args.geometry?.areaM2 ?? null;
    const length = args.geometry?.lengthM ?? null;

    const payload = {
      title: 'Maintenance & Lifecycle Plan',
      preparedBy: `Prepared by WeFlora on behalf of ${args.municipality ?? 'Municipality'}`,
      assumptions: assumptions.items.map((item) => item.statement),
      assumptionsDetailed: assumptions.items,
      evidence: [
        { kind: 'geometry', title: 'Intervention geometry', sourceId: null },
        { kind: 'baseline', title: 'Baseline proxy dataset', sourceId: null }
      ],
      scope: {
        areaM2: area,
        lengthM: length
      },
      schedule: [
        {
          phase: 'Year 0–1 Establishment',
          tasks: [
            'Weekly watering during dry periods',
            'Monthly health inspection',
            'Quarterly litter and safety checks'
          ]
        },
        {
          phase: 'Year 2–5 Growth',
          tasks: [
            'Seasonal pruning',
            'Biannual soil amendment as needed',
            'Annual safety inspection'
          ]
        },
        {
          phase: 'Year 5+ Steady State',
          tasks: [
            'Annual pruning',
            'Annual biodiversity check',
            'Replace failed plantings as required'
          ]
        }
      ],
      mowingGuidance: [
        'Native verge: 6–8 cuts per year',
        'Rain-adaptive verge: 4–6 cuts per year',
        'Low-maintenance verge: 2–4 cuts per year'
      ],
      wateringRules: [
        'Establishment watering weekly for first 12 weeks',
        'Reduce to monthly in Year 2 except during drought'
      ],
      inspectionChecklist: [
        'Safety hazards',
        'Litter accumulation',
        'Soil compaction',
        'Drainage performance'
      ],
      replacementAssumptions: [
        'Plant replacement cycle every 5–7 years',
        'Edge/kerb inspection every 3 years',
        'Soil amendment every 3–5 years'
      ],
      opexBands: [
        '€12–€18 per m² annually (establishment)',
        '€6–€10 per m² annually (steady state)'
      ]
    };

    await upsertArtifact(args.supabase, args.interventionId, {
      runId: run.id,
      type: 'maintenance',
      payload
    });

    await finishRun(args.supabase, run.id, 'succeeded');
    return payload;
  } catch (error) {
    await finishRun(args.supabase, run.id, 'failed');
    throw error;
  }
};
