import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSessionIntent } from '../../src/agentic/intents/sessionIntent';

describe('session intent parsing', () => {
  test('parses skill intent', () => {
    assert.deepEqual(parseSessionIntent('skill:compliance.policy_grounded'), {
      kind: 'skill',
      id: 'compliance.policy_grounded'
    });
  });

  test('parses flow intent', () => {
    assert.deepEqual(parseSessionIntent('flow:flow.planner_pack_ppp'), {
      kind: 'flow',
      id: 'flow.planner_pack_ppp'
    });
  });

  test('handles invalid intent', () => {
    assert.deepEqual(parseSessionIntent('invalid'), { kind: null, id: null });
    assert.deepEqual(parseSessionIntent(null), { kind: null, id: null });
  });
});
