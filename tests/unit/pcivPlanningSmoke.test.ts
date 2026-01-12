import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getContextIntakeUrl,
  getPlanningBackTarget,
  getPlanningStartLabel,
  getResolveInputsUrl
} from '../../components/planning/planningUtils.ts';

test('pciv planning smoke test', () => {
  assert.equal(getPlanningStartLabel(true, null), 'Start Planning');
  assert.equal(
    getContextIntakeUrl('import'),
    '/planning/context-intake?stage=import'
  );
  assert.equal(
    getResolveInputsUrl('validate'),
    '/planning/context-intake?stage=validate&focus=missingRequired'
  );
  assert.equal(
    getPlanningBackTarget({ planningProjectId: 'project-1' }),
    '/project/project-1'
  );
});
