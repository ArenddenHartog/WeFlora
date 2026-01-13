import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getContextIntakeUrl,
  getPlanningBackTarget,
  getPlanningStartAction,
  getResolveInputsAction,
  getResolveInputsUrl
} from '../../components/planning/planningUtils.ts';

test('planning actions derive from pciv state', () => {
  assert.equal(getPlanningStartAction(true, false), 'pciv-import');
  assert.equal(getPlanningStartAction(true, true), 'start-planning');
  assert.equal(getPlanningStartAction(false, false), 'start-planning');

  assert.equal(getResolveInputsAction(true), 'pciv-map');
  assert.equal(getResolveInputsAction(false), 'legacy');
});

test('resolve inputs URL uses validate stage and missing-required focus', () => {
  assert.equal(
    getResolveInputsUrl('validate'),
    '/planning/context-intake?stage=validate&focus=missingRequired'
  );
});

test('context intake URL is global and preserves stage', () => {
  assert.equal(
    getContextIntakeUrl('import'),
    '/planning/context-intake?stage=import'
  );
});

test('planning back target prefers project id', () => {
  assert.equal(
    getPlanningBackTarget({ planningProjectId: 'project-1' }),
    '/project/project-1'
  );
  assert.equal(
    getPlanningBackTarget({ resolvedProjectId: 'project-2' }),
    '/project/project-2'
  );
  assert.equal(
    getPlanningBackTarget({ fallbackPath: '/projects' }),
    '/projects'
  );
  assert.equal(
    getPlanningBackTarget({}),
    null
  );
});
