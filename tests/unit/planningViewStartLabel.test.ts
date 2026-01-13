import assert from 'node:assert/strict';
import test from 'node:test';
import { getPlanningStartLabel } from '../../components/planning/planningUtils.ts';

test('getPlanningStartLabel gates CTA copy', () => {
  assert.equal(getPlanningStartLabel(true, false), 'Start Planning');
  assert.equal(getPlanningStartLabel(true, true), 'Start Planning');
  assert.equal(getPlanningStartLabel(false, false), 'Start Planning');
});
