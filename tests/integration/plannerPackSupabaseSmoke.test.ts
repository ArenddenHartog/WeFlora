import assert from 'node:assert/strict';
import test from 'node:test';
import { createClient } from '@supabase/supabase-js';

const hasEnv = Boolean(process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_ANON_KEY);

if (!hasEnv) {
  test('planner pack supabase smoke (skipped)', { skip: true }, () => {});
} else {
  test('planner pack supabase smoke', async () => {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
    const url = process.env.VITE_SUPABASE_URL;
    const supabase = createClient(url as string, key as string);
    const storage = await import('../../src/planner-pack/v1/storage/supabase.ts');
    const { inventoryIngest } = await import('../../src/planner-pack/v1/workers/inventoryIngest.ts');
    const { plannerPackCompose } = await import('../../src/planner-pack/v1/workers/plannerPackCompose.ts');

    const scopeId = `planner-pack-test-${Date.now()}`;
    const intervention = await storage.createIntervention(supabase, {
      scopeId,
      name: 'Test Intervention',
      municipality: 'Utrecht',
      interventionType: 'corridor'
    });

    await storage.setGeometry(supabase, intervention.id, {
      kind: 'corridor',
      corridorWidthM: 12,
      geojson: {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] }
      },
      lengthM: 10,
      areaM2: 120
    });

    const source = await storage.addUploadSource(supabase, intervention.id, {
      title: 'inventory.csv',
      fileId: null,
      mimeType: 'text/csv'
    });

    await inventoryIngest({
      supabase,
      interventionId: intervention.id,
      sourceId: source.id,
      fileText: 'species,dbh\nAcer platanoides,20\nQuercus robur,15'
    });

    await plannerPackCompose({
      supabase,
      interventionId: intervention.id,
      municipality: intervention.municipality,
      interventionName: intervention.name,
      geometry: {
        kind: 'corridor',
        corridorWidthM: 12,
        geojson: {
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] }
        },
        lengthM: 10,
        areaM2: 120
      },
      inventorySummary: {
        treesCount: 2,
        speciesCount: 2,
        genusCount: 2,
        missingSpeciesPct: 0,
        missingDbhPct: 0
      },
      sourceIds: [source.id]
    });

    const artifacts = await storage.listArtifacts(supabase, intervention.id);
    const types = new Set(artifacts.map((artifact) => artifact.type));

    assert.ok(types.has('memo'));
    assert.ok(types.has('options'));
    assert.ok(types.has('procurement'));
    assert.ok(types.has('email_draft'));
    assert.ok(types.has('check_report'));
  });
}
