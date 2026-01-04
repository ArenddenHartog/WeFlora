import assert from 'node:assert/strict';
import { decodeMessageFromDb, encodeMessageForDb } from '../src/persistence/messageCodec.ts';

const payload = {
  schemaVersion: 'v0.2',
  meta: { schema_version: 'v0.2', sources_used: [] },
  mode: 'general_research',
  responseType: 'answer',
  data: {
    summary: 'Summary.',
    reasoning_summary: { approach: [], assumptions: [], risks: [] },
    follow_ups: {
      deepen: 'Deepen question',
      refine: 'Refine constraint',
      next_step: 'Next step'
    }
  }
};

const message = {
  id: 'msg-typed',
  sender: 'ai' as const,
  text: 'Summary.',
  floraGPT: payload
};

const encoded = encodeMessageForDb(message, 'thread-1');
const decoded = decodeMessageFromDb({ id: 'msg-typed', ...encoded });
const followUps = decoded.floraGPT?.data?.follow_ups;

assert.equal(typeof followUps?.deepen, 'string');
assert.equal(typeof followUps?.refine, 'string');
assert.equal(typeof followUps?.next_step, 'string');

console.log('Typed follow-ups roundtrip preserved.');
