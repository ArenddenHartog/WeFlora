type TelemetryEvent = {
  name: string;
  payload?: Record<string, unknown>;
  at: string;
};

const MAX_EVENTS = 200;
const STORAGE_KEY = 'weflora.telemetry.events';
const ENABLED_KEY = 'weflora.telemetry.enabled';

const buffer: TelemetryEvent[] = [];

const isEnabled = () => {
  if (typeof window === 'undefined') return false;
  const stored = window.localStorage.getItem(ENABLED_KEY);
  return stored === '1' || (import.meta as any).env?.DEV === true;
};

const persist = () => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(buffer));
};

export const track = (name: string, payload?: Record<string, unknown>) => {
  if (!isEnabled()) return;
  buffer.unshift({ name, payload, at: new Date().toISOString() });
  if (buffer.length > MAX_EVENTS) buffer.pop();
  persist();
};

export const getTelemetryEvents = (): TelemetryEvent[] => {
  if (buffer.length > 0) return [...buffer];
  if (typeof window === 'undefined') return [];
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as TelemetryEvent[];
    if (Array.isArray(parsed)) {
      buffer.push(...parsed);
      return [...buffer];
    }
  } catch {
    return [];
  }
  return [];
};

export const enableTelemetry = () => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ENABLED_KEY, '1');
};

export const disableTelemetry = () => {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(ENABLED_KEY);
};
