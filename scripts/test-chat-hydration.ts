import assert from 'node:assert/strict';
import { decodeMessageFromDb } from '../src/persistence/messageCodec.ts';

const payload = {
  schemaVersion: 'v0.2',
  meta: { schema_version: 'v0.2', sources_used: [{ source_id: 'doc-99' }] },
  mode: 'general_research',
  responseType: 'answer',
  data: { summary: 'Restored payload.' }
};

const decoded = decodeMessageFromDb({
  id: 'msg-123',
  sender: 'ai',
  text: 'Restored payload.',
  floragpt_payload: payload,
  created_at: '2024-01-01T00:00:00Z'
});

assert.ok(decoded.floraGPT);
assert.deepEqual(decoded.floraGPT, payload);

console.log('Hydration restores floragpt_payload.');
