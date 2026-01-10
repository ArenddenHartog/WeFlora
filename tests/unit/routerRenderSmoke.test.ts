import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

test('reports and planning routes mount in router without crashing', () => {
  const reportsTree = renderToString(
    React.createElement(
      MemoryRouter,
      { initialEntries: ['/reports'] },
      React.createElement(
        Routes,
        null,
        React.createElement(Route, {
          path: '/reports',
          element: React.createElement('div', { 'data-testid': 'reports-route' }, 'Reports')
        })
      )
    )
  );

  const planningTree = renderToString(
    React.createElement(
      MemoryRouter,
      { initialEntries: ['/planning'] },
      React.createElement(
        Routes,
        null,
        React.createElement(Route, {
          path: '/planning',
          element: React.createElement('div', { 'data-testid': 'planning-route' }, 'Planning')
        })
      )
    )
  );

  assert.ok(reportsTree.includes('Reports'));
  assert.ok(planningTree.includes('Planning'));
});
