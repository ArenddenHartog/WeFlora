import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { buildProgram } from '../../src/decision-program/orchestrator/buildProgram.ts';
import { planRun } from '../../src/decision-program/orchestrator/planRun.ts';
import { listMissingPointersBySeverity } from '../../src/decision-program/orchestrator/pointerInputRegistry.ts';
import { applyContextViewToPlanningState } from '../../components/planning/planningUtils.ts';
import { PcivContextViewV1Schema } from '../../src/decision-program/pciv/v1/schemas.ts';
const loadContextResolvers = async () => {
  process.env.VITE_SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? 'https://example.supabase.co';
  process.env.VITE_SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? 'test-key';
  const cacheBust = `?cache=${Date.now()}-${Math.random()}`;
  const { resolveContextView } = await import(`../../src/decision-program/pciv/v1/resolveContextView.ts${cacheBust}`);
  const { getContextViewForSkill } = await import(`../../src/decision-program/skills/context/getContextView.ts${cacheBust}`);
  return { resolveContextView, getContextViewForSkill };
};

const buildFixtureView = () => {
  const runId = '11111111-1111-4111-8111-111111111111';
  const committedAt = '2025-01-02T03:04:05.000Z';
  return PcivContextViewV1Schema.parse({
    run: {
      id: runId,
      scopeId: 'project-123',
      userId: null,
      status: 'committed',
      allowPartial: false,
      committedAt,
      createdAt: committedAt,
      updatedAt: committedAt
    },
    sourcesById: {
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa': {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        runId,
        kind: 'file',
        title: 'Site report',
        uri: 's3://example/site-report.pdf',
        fileId: null,
        mimeType: 'application/pdf',
        sizeBytes: 5120,
        parseStatus: 'parsed',
        excerpt: 'Site report excerpt',
        rawMeta: {},
        createdAt: committedAt
      }
    },
    inputsByPointer: {
      '/context/site/geo/locationHint': {
        id: '33333333-3333-4333-8333-333333333333',
        runId,
        pointer: '/context/site/geo/locationHint',
        label: 'Location hint',
        domain: 'site',
        required: true,
        fieldType: 'text',
        options: null,
        valueKind: 'string',
        valueString: 'Utrecht',
        valueNumber: null,
        valueBoolean: null,
        valueEnum: null,
        valueJson: null,
        provenance: 'user-entered',
        updatedBy: 'user',
        updatedAt: committedAt,
        evidenceSnippet: null,
        sourceIds: []
      }
    },
    constraints: [
      {
        id: '44444444-4444-4444-8444-444444444444',
        runId,
        key: 'regulatory.setting',
        domain: 'regulatory',
        label: 'Setting',
        valueKind: 'string',
        valueString: 'Urban core',
        valueNumber: null,
        valueBoolean: null,
        valueEnum: null,
        valueJson: null,
        provenance: 'source-backed',
        sourceId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        snippet: null,
        createdAt: committedAt
      }
    ],
    artifactsByType: {}
  });
};

test('Resolver returns validated ContextView', async () => {
  const view = buildFixtureView();
  const run = view.run;

  const { resolveContextView } = await loadContextResolvers();
  const deps = {
    listRunsForScope: async () => [run],
    fetchContextViewByRunId: async () => view
  };

  const resolved = await resolveContextView({ scopeId: run.scopeId, userId: run.userId }, deps);
  assert.deepEqual(resolved, PcivContextViewV1Schema.parse(resolved));
});

test('Resolver passes scopeId to adapter', async () => {
  const view = buildFixtureView();
  const run = view.run;
  const scopeId = 'scope-xyz';
  let receivedScopeId: string | null = null;

  const { resolveContextView } = await loadContextResolvers();
  const deps = {
    listRunsForScope: async (incomingScopeId: string) => {
      receivedScopeId = incomingScopeId;
      return [{ ...run, scopeId }];
    },
    fetchContextViewByRunId: async () => ({ ...view, run: { ...view.run, scopeId } })
  };

  await resolveContextView({ scopeId }, deps);
  assert.equal(receivedScopeId, scopeId);
});

test('Planning and Skill consume the same ContextView', async () => {
  const view = buildFixtureView();
  const run = view.run;

  const { resolveContextView, getContextViewForSkill } = await loadContextResolvers();
  const deps = {
    listRunsForScope: async () => [run],
    fetchContextViewByRunId: async () => view
  };

  const planningView = await resolveContextView({ scopeId: run.scopeId, userId: run.userId }, deps);
  const skillsView = await getContextViewForSkill({ scopeId: run.scopeId, userId: run.userId }, deps);

  assert.deepEqual(planningView.inputsByPointer, skillsView.inputsByPointer);
  assert.deepEqual(planningView.constraints, skillsView.constraints);
  assert.equal(planningView.run.id, skillsView.run.id);
  assert.equal(planningView.run.committedAt, skillsView.run.committedAt);
});

test('Planning application shrinks missing required inputs', () => {
  const program = buildProgram();
  const baseState = planRun(program, {
    site: {},
    regulatory: {},
    equity: {},
    species: {},
    supply: {},
    selectedDocs: []
  });
  const initialMissing = listMissingPointersBySeverity(baseState, 'required').length;

  const view = buildFixtureView();
  const hydrated = applyContextViewToPlanningState(baseState, view);
  const hydratedMissing = listMissingPointersBySeverity(hydrated, 'required').length;

  assert.ok(hydratedMissing < initialMissing);
});

test('No v0/localStorage dependency in resolver + planning + skills entry points', () => {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const files = [
    'components/planning/PlanningView.tsx',
    'components/planning/planningUtils.ts',
    'src/decision-program/pciv/v1/resolveContextView.ts',
    'src/decision-program/skills/context/getContextView.ts'
  ];

  files.forEach((relativePath) => {
    const contents = fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
    assert.ok(!contents.includes('pciv/v0'), `${relativePath} should not reference pciv/v0`);
    assert.ok(!contents.includes('localStorage'), `${relativePath} should not reference localStorage`);
  });
});
