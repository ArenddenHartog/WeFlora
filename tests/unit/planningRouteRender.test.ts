import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { planningRoutePaths } from '../../components/routes/planningRoutePaths.ts';

test('planning route mounts in router without crashing', () => {
  const tree = renderToString(
    React.createElement(
      MemoryRouter,
      { initialEntries: ['/planning'] },
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

  assert.ok(tree.includes('Planning'));
});
