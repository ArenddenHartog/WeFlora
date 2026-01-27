import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToString } from 'react-dom/server';
import RunTimeline from '../../components/agentic/RunTimeline.tsx';
import type { EventRecord } from '../../src/agentic/contracts/ledger.ts';

const baseEvent = (eventId: string, at: string, seq: number) => ({
  event_id: eventId,
  scope_id: 'scope-1',
  session_id: 'session-1',
  run_id: 'session-1',
  at,
  by: { kind: 'system' } as const,
  seq,
  event_version: '1.0.0' as const
});

test('RunTimeline de-duplicates step blocks by step_id', () => {
  const stepId = 'step-1';
  const events: EventRecord[] = [
    {
      ...baseEvent('step-start-1', '2026-01-22T00:00:00.000Z', 1),
      type: 'step.started',
      payload: {
        step_id: stepId,
        step_index: 1,
        agent_id: 'skill-1',
        title: 'Step One',
        inputs: {}
      }
    },
    {
      ...baseEvent('step-start-duplicate', '2026-01-22T00:00:01.000Z', 2),
      type: 'step.started',
      payload: {
        step_id: stepId,
        step_index: 1,
        agent_id: 'skill-1',
        title: 'Step One',
        inputs: {}
      }
    },
    {
      ...baseEvent('step-complete-1', '2026-01-22T00:00:02.000Z', 3),
      type: 'step.completed',
      payload: {
        step_id: stepId,
        step_index: 1,
        agent_id: 'skill-1',
        status: 'ok',
        summary: 'Completed step',
        mutations: []
      }
    }
  ];

  const html = renderToString(React.createElement(RunTimeline, { events }));
  const occurrences = html.split('Step One').length - 1;
  assert.equal(occurrences, 1);
});
