import type { EventRecord, Session } from '../contracts/ledger';
import type { RunContext } from '../contracts/run_context';

export interface StoredSession {
  session: Session;
  runContext: RunContext;
  events: EventRecord[];
}

const STORAGE_KEY = 'weflora.sessions.v1';

export const loadStoredSessions = (): StoredSession[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredSession[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const saveStoredSessions = (sessions: StoredSession[]) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
};

export const addStoredSession = (session: StoredSession) => {
  const existing = loadStoredSessions();
  const filtered = existing.filter((item) => item.session.session_id !== session.session_id);
  saveStoredSessions([session, ...filtered]);
};

export const findStoredSession = (sessionId: string) => {
  return loadStoredSessions().find((item) => item.session.session_id === sessionId);
};
