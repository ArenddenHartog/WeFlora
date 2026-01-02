import assert from 'node:assert/strict';
import { encodeMessageForDb, decodeMessageFromDb } from '../src/persistence/messageCodec.ts';
import type { ChatMessage, FloraGPTResponseEnvelope } from '../types.ts';

const floraPayload: FloraGPTResponseEnvelope = {
  schemaVersion: 'v0.2',
  meta: { schema_version: 'v0.2', sources_used: [{ source_id: 'doc-1' }] },
  mode: 'general_research',
  responseType: 'answer',
  data: {
    output_label: 'Draft planting shortlist (v1)',
    summary: 'Summary',
    reasoning_summary: {
      approach: ['Step 1'],
      assumptions: [],
      risks: []
    },
    follow_ups: ['Q1', 'Q2', 'Q3']
  },
  tables: [{ columns: ['Species'], rows: [['Quercus robur']] }]
};

const message: ChatMessage = {
  id: 'msg-1',
  sender: 'ai',
  text: 'Summary',
  floraGPT: floraPayload,
  citations: [{ source: 'Doc 1', text: 'Doc 1', type: 'project_file', sourceId: 'doc-1' }],
  createdAt: new Date().toISOString()
};

const encoded = encodeMessageForDb(message, 'thread-1');
const decoded = decodeMessageFromDb({
  id: 'msg-1',
  sender: encoded.sender,
  text: encoded.text,
  floragpt_payload: encoded.floragpt_payload,
  citations: encoded.citations,
  context_snapshot: encoded.context_snapshot,
  grounding: encoded.grounding,
  suggested_actions: encoded.suggested_actions,
  created_at: encoded.created_at
});

assert.ok(decoded.floraGPT);
assert.equal(decoded.floraGPT?.meta?.schema_version, 'v0.2');
assert.ok(decoded.floraGPT?.data?.reasoning_summary);
assert.equal(decoded.floraGPT?.data?.follow_ups?.length, 3);
assert.equal(decoded.floraGPT?.meta?.sources_used?.length, 1);
assert.ok(decoded.citations || decoded.floraGPT?.meta?.sources_used);
assert.equal(Boolean(decoded.floraGPT), true);

const minimalMessage: ChatMessage = {
  id: 'msg-2',
  sender: 'ai',
  text: 'Summary',
  floraGPT: floraPayload
};
const minimalEncoded = encodeMessageForDb(minimalMessage, 'thread-2');
const minimalDecoded = decodeMessageFromDb({
  id: 'msg-2',
  sender: minimalEncoded.sender,
  text: minimalEncoded.text,
  floragpt_payload: minimalEncoded.floragpt_payload,
  citations: minimalEncoded.citations,
  context_snapshot: minimalEncoded.context_snapshot,
  grounding: minimalEncoded.grounding,
  suggested_actions: minimalEncoded.suggested_actions,
  created_at: minimalEncoded.created_at
});
assert.ok(minimalDecoded.floraGPT);

console.info('Message persistence codec test passed.');
