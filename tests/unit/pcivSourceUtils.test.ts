import assert from 'node:assert/strict';
import test from 'node:test';
import { getPcivSourceStatus, isPcivFileSupported } from '../../src/decision-program/pciv/v0/sourceUtils.ts';

test('pciv source utils mark PDFs as unsupported', () => {
  const file = { name: 'policy.pdf', type: 'application/pdf', size: 1200 };
  assert.equal(isPcivFileSupported(file), false);
  const status = getPcivSourceStatus(file);
  assert.equal(status.status, 'unsupported');
  assert.ok(status.error);
});

test('pciv source utils accept text-like files', () => {
  const file = { name: 'notes.txt', type: 'text/plain', size: 1200 };
  assert.equal(isPcivFileSupported(file), true);
  const status = getPcivSourceStatus(file);
  assert.equal(status.status, 'pending');
});
