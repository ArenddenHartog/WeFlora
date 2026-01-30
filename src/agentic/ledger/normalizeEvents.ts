import type { EventRecord } from '../contracts/ledger';

export const normalizeEvents = (events: EventRecord[]): EventRecord[] => {
  const seen = new Set<string>();
  const deduped: EventRecord[] = [];

  events.forEach((event) => {
    const key = event.event_id ?? `${event.run_id}:${event.seq}`;
    if (seen.has(key)) return;
    seen.add(key);
    deduped.push(event);
  });

  return [...deduped].sort((a, b) => {
    if (a.seq !== b.seq) return a.seq - b.seq;
    return new Date(a.at).getTime() - new Date(b.at).getTime();
  });
};
