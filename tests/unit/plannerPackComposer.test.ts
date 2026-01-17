import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPlannerPackArtifacts } from '../../src/planner-pack/v1/workers/plannerPackCompose.ts';

test('planner pack composer emits memo/options/procurement/email with required phrases', () => {
  const { memoPayload, optionsPayload, procurementPayload, emailDraftPayload } = buildPlannerPackArtifacts({
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

  for (const payload of [memoPayload, optionsPayload, procurementPayload, emailDraftPayload]) {
    assert.ok(Array.isArray(payload.assumptions));
    assert.ok(Array.isArray(payload.evidence));
  }
});
