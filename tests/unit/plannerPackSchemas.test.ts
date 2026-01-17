import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { PlannerArtifactSchema, PlannerGeometrySchema } from '../../src/planner-pack/v1/schemas.ts';

test('planner geometry schema enforces corridor width', () => {
  const baseGeojson = {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] }
  };

  const corridorMissingWidth = PlannerGeometrySchema.safeParse({
    kind: 'corridor',
    geojson: baseGeojson
  });
  assert.equal(corridorMissingWidth.success, false);

  const corridorWithWidth = PlannerGeometrySchema.safeParse({
    kind: 'corridor',
    geojson: baseGeojson,
    corridorWidthM: 12
  });
  assert.equal(corridorWithWidth.success, true);
});

test('planner artifact schema requires type', () => {
  const result = PlannerArtifactSchema.safeParse({
    id: randomUUID(),
    interventionId: randomUUID(),
    version: 1,
    payload: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  assert.equal(result.success, false);
});
