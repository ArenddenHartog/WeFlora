import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import SkillsIndex from '../../components/agentic/SkillsIndex.tsx';

test('SkillsIndex uses worksheet-style container classes', () => {
  const html = renderToString(
    React.createElement(MemoryRouter, null, React.createElement(SkillsIndex))
  );
  assert.ok(html.includes('w-full bg-white p-4 md:p-8'));
});
