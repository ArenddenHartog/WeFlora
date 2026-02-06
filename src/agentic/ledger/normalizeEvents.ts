import type { EventRecord } from '../contracts/ledger';
import { isDev } from '@/utils/env';

/**
 * Normalize and deduplicate ledger events.
 *
 * Dedup strategy (Deliverable F3):
 * 1. Primary: event_id uniqueness
 * 2. Fallback composite key: (run_id, step_id, agent_id, event_type, created_at bucket)
 * 3. Shows "duplicates suppressed" only in dev mode
 */
export const normalizeEvents = (events: EventRecord[]): EventRecord[] => {
  const seenIds = new Set<string>();
  const seenCompositeKeys = new Set<string>();
  const deduped: EventRecord[] = [];
  let suppressedCount = 0;

  events.forEach((event) => {
    // Primary dedup by event_id
    const primaryKey = event.event_id ?? `${event.run_id}:${event.seq}`;
    if (seenIds.has(primaryKey)) {
      suppressedCount++;
      return;
    }
    seenIds.add(primaryKey);

    // Fallback composite key dedup: (run_id, step_id, agent_id, event_type, created_at bucket)
    const stepId = (event.payload as any)?.step_id ?? '';
    const agentId = (event.payload as any)?.agent_id ?? '';
    const atBucket = event.at ? event.at.slice(0, 16) : ''; // minute-level bucket
    const compositeKey = `${event.run_id}:${stepId}:${agentId}:${event.type}:${atBucket}`;

    if (seenCompositeKeys.has(compositeKey)) {
      suppressedCount++;
      return;
    }
    seenCompositeKeys.add(compositeKey);

    deduped.push(event);
  });

  if (suppressedCount > 0 && isDev) {
    console.info(`[normalizeEvents] duplicates suppressed: ${suppressedCount}`);
  }

  return [...deduped].sort((a, b) => {
    if (a.seq !== b.seq) return a.seq - b.seq;
    return new Date(a.at).getTime() - new Date(b.at).getTime();
  });
};
