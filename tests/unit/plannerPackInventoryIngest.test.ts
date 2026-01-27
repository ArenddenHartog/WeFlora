import assert from 'node:assert/strict';
import test from 'node:test';
import { parseInventoryCsv } from '../../src/planner-pack/v1/workers/inventoryParse.ts';

test('inventory ingest parses CSV and computes missing rates', () => {
  const csv = `species,dbh,genus\nAcer platanoides,20,Acer\n,15,\nQuercus robur,,Quercus`;
  const result = parseInventoryCsv(csv);

  assert.equal(result.rows.length, 3);
  assert.ok(result.summary);
  assert.equal(result.summary?.treesCount, 3);
  assert.equal(result.summary?.speciesCount, 2);
  assert.equal(result.summary?.genusCount, 2);
  assert.ok(result.summary?.missingSpeciesPct && result.summary.missingSpeciesPct > 0);
  assert.ok(result.summary?.missingDbhPct && result.summary.missingDbhPct > 0);
});

test('inventory ingest flags missing species column', () => {
  const csv = `dbh\n20\n15`;
  const result = parseInventoryCsv(csv);
  assert.ok(result.parseReport.qualityFlags?.includes('No species column detected'));
});
