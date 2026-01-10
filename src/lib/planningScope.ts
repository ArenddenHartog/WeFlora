const PLANNING_SCOPE_KEY = 'planning_workspace_scope';

const buildScopeId = () => `planning-workspace-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`;

export const getPlanningScopeId = (): string => {
  if (typeof window === 'undefined') {
    return 'planning-workspace-server';
  }
  const existing = window.localStorage.getItem(PLANNING_SCOPE_KEY);
  if (existing) return existing;
  const created = buildScopeId();
  window.localStorage.setItem(PLANNING_SCOPE_KEY, created);
  return created;
};
