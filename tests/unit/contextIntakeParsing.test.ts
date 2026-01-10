import assert from 'node:assert/strict';
import test from 'node:test';
import { parseContextIntakeFocus, parseContextIntakeStage } from '../../components/planning/planningUtils.ts';

test('parseContextIntakeStage defaults to import for invalid values', () => {
  assert.equal(parseContextIntakeStage(null), 'import');
  assert.equal(parseContextIntakeStage('unknown'), 'import');
});

test('parseContextIntakeStage accepts valid stages', () => {
  assert.equal(parseContextIntakeStage('import'), 'import');
  assert.equal(parseContextIntakeStage('map'), 'map');
  assert.equal(parseContextIntakeStage('validate'), 'validate');
});

test('parseContextIntakeFocus returns missingRequired only when specified', () => {
  assert.equal(parseContextIntakeFocus(null), null);
  assert.equal(parseContextIntakeFocus('missingRequired'), 'missingRequired');
  assert.equal(parseContextIntakeFocus('other'), null);
});
