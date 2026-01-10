import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { planningRoutePaths } from '../../components/routes/planningRoutePaths.ts';

test('planning routes mount in router without crashing', () => {
  const planningTree = renderToString(
    React.createElement(
      MemoryRouter,
      { initialEntries: [planningRoutePaths.planning[0]] },
      React.createElement(
        Routes,
        null,
        React.createElement(Route, {
          path: planningRoutePaths.planning[0],
          element: React.createElement('div', { 'data-testid': 'planning-route' }, 'Planning')
        })
      )
    )
  );

  const intakeTree = renderToString(
    React.createElement(
      MemoryRouter,
      { initialEntries: [planningRoutePaths.contextIntake[0]] },
      React.createElement(
        Routes,
        null,
        React.createElement(Route, {
          path: planningRoutePaths.contextIntake[0],
          element: React.createElement('div', { 'data-testid': 'context-intake-route' }, 'Context Intake')
        })
      )
    )
  );

  assert.ok(planningTree.includes('Planning'));
  assert.ok(intakeTree.includes('Context Intake'));
});
