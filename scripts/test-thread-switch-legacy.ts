import assert from 'node:assert/strict';
import { applyThreadHydrationGuard } from '../src/persistence/threadHydrationGuard.ts';

const structuredMessages = [
  { id: 'msg-1', sender: 'ai', text: 'Structured', floraGPT: { mode: 'general_research' } }
] as any;
const legacyMessages = [
  { id: 'msg-2', sender: 'ai', text: 'Legacy text only' }
] as any;

const firstPass = applyThreadHydrationGuard({
  prevMessages: structuredMessages,
  incomingMessages: structuredMessages,
  lastHydratedThreadId: 'thread-1',
  threadId: 'thread-1'
});

const switchPass = applyThreadHydrationGuard({
  prevMessages: firstPass.nextMessages,
  incomingMessages: legacyMessages,
  lastHydratedThreadId: firstPass.nextHydratedThreadId,
  threadId: 'thread-2'
});

const messageIds = switchPass.nextMessages.map((msg) => msg.id);
assert.deepEqual(messageIds, ['msg-2']);
assert.ok(!messageIds.includes('msg-1'));

console.log('Thread switch shows legacy thread messages.');
