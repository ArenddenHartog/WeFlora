import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getContextIntakeUrl,
  getPlanningBackTarget,
  getPlanningStartLabel,
  getResolveInputsUrl
} from '../../components/planning/planningUtils.ts';

test('pciv planning smoke test', () => {
  assert.equal(getPlanningStartLabel(true, null), 'Start Context Intake');
  assert.equal(
    getContextIntakeUrl('project-1', 'import'),
    '/project/project-1/context-intake?stage=import'
  );
  assert.equal(
    getResolveInputsUrl('project-1', 'validate'),
    '/project/project-1/context-intake?stage=validate&focus=missingRequired'
  );
  assert.equal(
    getPlanningBackTarget({ planningProjectId: 'project-1' }),
    '/project/project-1'
  );
});
