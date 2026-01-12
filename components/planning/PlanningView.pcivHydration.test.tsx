import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { buildProgram } from '../../src/decision-program/orchestrator/buildProgram.ts';
import { planRun } from '../../src/decision-program/orchestrator/planRun.ts';
import { listMissingPointersBySeverity } from '../../src/decision-program/orchestrator/pointerInputRegistry.ts';
import { hydratePlanningStateFromPcivCommit } from '../../src/decision-program/pciv/v0/hydratePlanning.ts';
import { savePcivRun } from '../../src/decision-program/pciv/v0/store.ts';
import type { PcivCommittedContext, PcivContextIntakeRun, PcivField } from '../../src/decision-program/pciv/v0/types.ts';
import PlanningRunnerView from './PlanningRunnerView';

class LocalStorageMock {
  private store = new Map<string, string>();

  getItem(key: string) {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
}

const makeField = (pointer: string, value: PcivField['value']): PcivField => ({
  pointer,
  label: pointer,
  group: 'site',
  required: true,
  type: 'text',
  value,
  provenance: 'user-entered'
});

const makeCommit = (projectId: string, fields: Record<string, PcivField>): PcivCommittedContext => ({
  status: 'committed',
  committed_at: '2024-01-01T00:00:00.000Z',
  allow_partial: false,
  projectId,
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

test('planning route uses committed PCIV to label the CTA', async () => {
  process.env.VITE_SUPABASE_URL = 'https://example.supabase.co';
  process.env.VITE_SUPABASE_ANON_KEY = 'test-key';

  const localStorage = new LocalStorageMock();
  (globalThis as typeof globalThis & { window?: { localStorage: LocalStorageMock } }).window = {
    localStorage
  };

  const commit = makeCommit('planning-workspace-TEST', {
    '/context/site/geo/locationHint': makeField('/context/site/geo/locationHint', 'Utrecht')
  });
  localStorage.setItem('planning_workspace_scope', commit.projectId);
  const run: PcivContextIntakeRun = {
    id: 'pciv-1',
    projectId: commit.projectId,
    userId: commit.userId ?? null,
    runId: null,
    status: commit.status,
    draft: {
      projectId: commit.projectId,
      runId: null,
      userId: commit.userId ?? null,
      locationHint: '',
      sources: [],
      fields: commit.fields,
      constraints: commit.constraints,
      errors: []
    },
    commit,
    metrics: commit.metrics,
    createdAt: commit.committed_at,
    updatedAt: commit.committed_at
  };
  savePcivRun(run);

  const { UIProvider } = await import('../../contexts/UIContext');
  const { AuthProvider } = await import('../../contexts/AuthContext');
  const { ProjectProvider } = await import('../../contexts/ProjectContext');
  const { ChatProvider } = await import('../../contexts/ChatContext');
  const { default: PlanningView } = await import('./PlanningView');

  const tree = renderToString(
    React.createElement(
      MemoryRouter,
      { initialEntries: ['/planning'] },
      React.createElement(
        Routes,
        null,
        React.createElement(Route, {
          path: '/planning',
          element: React.createElement(
            AuthProvider,
            null,
            React.createElement(
              UIProvider,
              null,
              React.createElement(
                ProjectProvider,
                null,
                React.createElement(ChatProvider, null, React.createElement(PlanningView))
              )
            )
          )
        })
      )
    )
  );

  assert.ok(tree.includes('Start Planning'));
  assert.ok(!tree.includes('Start Context Intake'));
});

test('planning runner shows missing-required count after hydration', async () => {
  const localStorage = new LocalStorageMock();
  (globalThis as typeof globalThis & { window?: { localStorage: LocalStorageMock } }).window = {
    localStorage
  };

  const program = buildProgram();
  const baseContext = {
    site: {},
    regulatory: {},
    equity: {},
    species: {},
    supply: {},
    selectedDocs: [] as any[]
  };
  const baseState = planRun(program, baseContext);
  const initialMissing = listMissingPointersBySeverity(baseState, 'required').length;

  const commit = makeCommit('planning-workspace-TEST', {
    '/context/site/geo/locationHint': makeField('/context/site/geo/locationHint', 'Utrecht')
  });
  const run: PcivContextIntakeRun = {
    id: 'pciv-2',
    projectId: commit.projectId,
    userId: commit.userId ?? null,
    runId: null,
    status: commit.status,
    draft: {
      projectId: commit.projectId,
      runId: null,
      userId: commit.userId ?? null,
      locationHint: '',
      sources: [],
      fields: commit.fields,
      constraints: commit.constraints,
      errors: []
    },
    commit,
    metrics: commit.metrics,
    createdAt: commit.committed_at,
    updatedAt: commit.committed_at
  };
  savePcivRun(run);

  const hydrated = hydratePlanningStateFromPcivCommit(baseState, { scopeId: commit.projectId, userId: null });
  const hydratedMissing = listMissingPointersBySeverity(hydrated, 'required').length;

  assert.ok(hydratedMissing < initialMissing);

  const { UIProvider } = await import('../../contexts/UIContext');

  const tree = renderToString(
    React.createElement(
      MemoryRouter,
      { initialEntries: ['/planning'] },
      React.createElement(
        UIProvider,
        null,
        React.createElement(PlanningRunnerView, {
          program,
          state: hydrated,
          stepsVM: [],
          onStartRun: () => {},
          onSubmitCard: async () => {},
          hideMissingInputs: false
        })
      )
    )
  );

  assert.ok(tree.includes('missing-required-count'));
});
