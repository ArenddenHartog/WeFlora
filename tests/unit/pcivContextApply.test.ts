import assert from 'node:assert/strict';
import test from 'node:test';
import { getByPointer } from '../../src/decision-program/runtime/pointers.ts';
import { applyCommittedContext } from '../../src/decision-program/pciv/v0/context.ts';
import type { PcivCommittedContext, PcivField } from '../../src/decision-program/pciv/v0/types.ts';

const makeField = (pointer: string, value: PcivField['value']): PcivField => ({
  pointer,
  label: pointer,
  group: 'site',
  required: true,
  type: 'text',
  value,
  provenance: 'user-entered'
});

const makeCommit = (fields: Record<string, PcivField>): PcivCommittedContext => ({
  status: 'committed',
  committed_at: '2024-01-01T00:00:00.000Z',
  allow_partial: false,
  projectId: 'planning-workspace',
  runId: null,
  userId: null,
  sources: [],
  fields,
  constraints: [],
  metrics: {
    sources_count: 0,
    sources_ready_count: 0,
    fields_total: Object.keys(fields).length,
    fields_filled_count: Object.values(fields).filter((field) => field.value !== null && field.value !== undefined && field.value !== '').length,
    required_unresolved_count: 0,
    constraints_count: 0,
    confidence_overall: 100
  }
});

test('applyCommittedContext applies committed field values', () => {
  const baseContext = {
    site: {},
    regulatory: {},
    equity: {},
    species: {},
    supply: {},
    selectedDocs: [] as any[]
  };
  const commit = makeCommit({
    '/context/site/geo/locationHint': makeField('/context/site/geo/locationHint', 'Utrecht'),
    '/context/site/soil/type': makeField('/context/site/soil/type', 'loam')
  });

  const nextContext = applyCommittedContext(baseContext, commit);

  assert.equal(
    getByPointer({ context: nextContext }, '/context/site/geo/locationHint'),
    'Utrecht'
  );
  assert.equal(
    getByPointer({ context: nextContext }, '/context/site/soil/type'),
    'loam'
  );
});

test('applyCommittedContext skips null or empty values', () => {
  const baseContext = {
    site: { geo: { locationHint: 'Existing' } },
    regulatory: {},
    equity: {},
    species: {},
    supply: {},
    selectedDocs: [] as any[]
  };
  const commit = makeCommit({
    '/context/site/geo/locationHint': makeField('/context/site/geo/locationHint', '')
  });

  const nextContext = applyCommittedContext(baseContext, commit);

  assert.equal(
    getByPointer({ context: nextContext }, '/context/site/geo/locationHint'),
    'Existing'
  );
});

test('applyCommittedContext is idempotent for identical commits', () => {
  const baseContext = {
    site: {},
    regulatory: {},
    equity: {},
    species: {},
    supply: {},
    selectedDocs: [] as any[]
  };
  const commit = makeCommit({
    '/context/site/geo/locationHint': makeField('/context/site/geo/locationHint', 'Utrecht')
  });

  const once = applyCommittedContext(baseContext, commit);
  const twice = applyCommittedContext(once, commit);

  assert.deepEqual(twice, once);
});
