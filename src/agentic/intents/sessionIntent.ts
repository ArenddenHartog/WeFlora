export type SessionIntent =
  | { kind: 'skill'; id: string }
  | { kind: 'flow'; id: string }
  | { kind: null; id: null };

export const parseSessionIntent = (raw: string | null): SessionIntent => {
  if (!raw) return { kind: null, id: null };
  const trimmed = raw.trim();
  if (!trimmed) return { kind: null, id: null };

  const [kind, id] = trimmed.split(':');
  if (!id) return { kind: null, id: null };

  if (kind === 'skill') return { kind: 'skill', id };
  if (kind === 'flow') return { kind: 'flow', id };
  return { kind: null, id: null };
};
