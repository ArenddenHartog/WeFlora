import assert from 'node:assert/strict';
import test from 'node:test';
import type { PcivCommittedContext } from '../../src/decision-program/pciv/v0/types';
import {
  getPlanningBackTarget,
  getPlanningStartAction,
  getResolveInputsAction,
  getResolveInputsUrl
} from '../../components/planning/planningUtils.ts';

const committedContext: PcivCommittedContext = {
  status: 'committed',
  committed_at: '2024-01-01T00:00:00.000Z',
  allow_partial: false,
  projectId: 'project-1',
  runId: 'run-1',
  userId: null,
  sources: [],
  fields: {},
  constraints: [],
  metrics: {
    sources_count: 0,
    sources_ready_count: 0,
    fields_total: 0,
    fields_filled_count: 0,
    required_unresolved_count: 0,
    constraints_count: 0,
    confidence_overall: 0
  }
};

test('planning actions derive from pciv state', () => {
  assert.equal(getPlanningStartAction(true, null), 'pciv-import');
  assert.equal(getPlanningStartAction(true, committedContext), 'start-planning');
  assert.equal(getPlanningStartAction(false, null), 'start-planning');

  assert.equal(getResolveInputsAction(true), 'pciv-map');
  assert.equal(getResolveInputsAction(false), 'legacy');
});

test('resolve inputs URL uses validate stage and missing-required focus', () => {
  assert.equal(
    getResolveInputsUrl('project-1', 'validate'),
    '/project/project-1/context-intake?stage=validate&focus=missingRequired'
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
