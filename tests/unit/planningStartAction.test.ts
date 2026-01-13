import assert from 'node:assert/strict';
import test from 'node:test';
import { getPlanningStartAction, getContextIntakeUrl } from '../../components/planning/planningUtils.ts';

test('planning start action gates to PCIV import when no commit exists', () => {
  assert.equal(getPlanningStartAction(true, false), 'pciv-import');
  assert.equal(getPlanningStartAction(true, true), 'start-planning');
});

test('context intake url points to planning intake route', () => {
  const url = getContextIntakeUrl('import');
  assert.ok(url.startsWith('/planning/context-intake'));
});
