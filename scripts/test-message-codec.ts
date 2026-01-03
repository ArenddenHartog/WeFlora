import assert from 'node:assert/strict';
import { decodeMessageFromDb, encodeMessageForDb } from '../src/persistence/messageCodec.ts';

const payload = {
  schemaVersion: 'v0.2',
  meta: {
    schema_version: 'v0.2',
    sources_used: [{ source_id: 'doc-1' }]
  },
  mode: 'general_research',
  responseType: 'answer',
  data: {
    output_label: 'Draft planting shortlist (v2)',
    summary: 'Summary.',
    reasoning_summary: {
      approach: ['Step 1'],
      assumptions: ['Assumption'],
      risks: ['Risk']
    },
    follow_ups: ['Question', 'Suggestion', 'Direction']
  }
};

const message = {
  id: 'msg-1',
  sender: 'ai' as const,
  text: 'Summary.',
  floraGPT: payload,
  createdAt: '2024-01-01T00:00:00Z'
};

const encoded = encodeMessageForDb(message, 'thread-1');
const decoded = decodeMessageFromDb({ id: 'msg-1', ...encoded });

assert.deepEqual(decoded.floraGPT, payload);
assert.equal(decoded.text, message.text);

console.log('messageCodec roundtrip preserved v0.2 payload.');
