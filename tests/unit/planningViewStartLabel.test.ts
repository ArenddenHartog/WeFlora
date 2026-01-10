import assert from 'node:assert/strict';
import test from 'node:test';
import type { PcivCommittedContext } from '../../src/decision-program/pciv/v0/types';
import { getPlanningStartLabel } from '../../components/planning/planningUtils.ts';

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

test('getPlanningStartLabel gates CTA copy', () => {
  assert.equal(getPlanningStartLabel(true, null), 'Start Context Intake');
  assert.equal(getPlanningStartLabel(true, committedContext), 'Start Planning');
  assert.equal(getPlanningStartLabel(false, null), 'Start Planning');
});
