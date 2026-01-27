import assert from 'node:assert/strict';
import test from 'node:test';

test('planner pack composer emits memo/options/procurement/email/species mix/maintenance with required phrases', async () => {
  process.env.VITE_SUPABASE_URL ??= 'http://localhost';
  process.env.VITE_SUPABASE_ANON_KEY ??= 'anon';
  const { buildPlannerPackArtifacts } = await import('../../src/planner-pack/v1/workers/plannerPackCompose.ts');
  const {
    memoPayload,
    optionsPayload,
    procurementPayload,
    emailDraftPayload,
    speciesMixPayload,
    maintenancePayload
  } = buildPlannerPackArtifacts({
    municipality: 'Utrecht',
    interventionName: 'Kanaalstraat corridor vergroening',
    geometry: {
      kind: 'corridor',
      corridorWidthM: 12,
      geojson: { type: 'Feature', geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] } },
      areaM2: 100,
      lengthM: 10
    },
    inventorySummary: {
      treesCount: 10,
      speciesCount: 4,
      genusCount: 2,
      missingSpeciesPct: 0.1,
      missingDbhPct: 0.2
    },
    sourceIds: []
  });

  const memoSections = memoPayload.sections.map((section: any) => section.title).join(' ');
  assert.ok(memoSections.includes('WeFlora concludes that, under the stated assumptions'));
  assert.ok(memoSections.includes('Here is the evidence supporting compliance'));

  for (const payload of [
    memoPayload,
    optionsPayload,
    procurementPayload,
    emailDraftPayload,
    speciesMixPayload,
    maintenancePayload
  ]) {
    assert.ok(Array.isArray(payload.assumptions));
    assert.ok(Array.isArray(payload.assumptionsDetailed));
    assert.ok(Array.isArray(payload.evidence));
  }

  const assumption = memoPayload.assumptionsDetailed[0];
  assert.ok(assumption.claim);
  assert.ok(assumption.howToValidate || assumption.how_to_validate);
  assert.ok(assumption.owner);

  assert.ok(Array.isArray(maintenancePayload.phases));
  assert.ok(maintenancePayload.phases.length >= 3);
  assert.ok(Array.isArray(maintenancePayload.summary));
});
