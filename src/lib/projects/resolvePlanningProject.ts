import type { SupabaseClient } from '@supabase/supabase-js';

const LOCAL_PROJECT_STORAGE_KEY = 'pciv_local_projects';
const LOCAL_PROJECT_ACTIVE_KEY = 'pciv_local_project_active';

interface LocalProject {
  id: string;
  createdAt: string;
  name: string;
}

export interface ResolvePlanningProjectResult {
  projectId: string;
  didCreate: boolean;
  isLocal?: boolean;
}

export interface ResolvePlanningProjectOptions {
  client?: SupabaseClient;
  defaultName?: string;
  now?: () => string;
}

const getLocalProjects = (): LocalProject[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_PROJECT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LocalProject[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveLocalProjects = (projects: LocalProject[]) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LOCAL_PROJECT_STORAGE_KEY, JSON.stringify(projects));
};

const resolveLocalProject = (defaultName: string, now: () => string): ResolvePlanningProjectResult => {
  if (typeof window === 'undefined') {
    return { projectId: 'local-project', didCreate: true, isLocal: true };
  }
  const existing = getLocalProjects().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (existing.length > 0) {
    window.localStorage.setItem(LOCAL_PROJECT_ACTIVE_KEY, existing[0].id);
    return { projectId: existing[0].id, didCreate: false, isLocal: true };
  }
  const created: LocalProject = {
    id: `local-project-${crypto.randomUUID()}`,
    createdAt: now(),
    name: defaultName
  };
  saveLocalProjects([created]);
  window.localStorage.setItem(LOCAL_PROJECT_ACTIVE_KEY, created.id);
  return { projectId: created.id, didCreate: true, isLocal: true };
};

export const resolvePlanningProject = async (
  options: ResolvePlanningProjectOptions = {}
): Promise<ResolvePlanningProjectResult | null> => {
  const client =
    options.client ??
    (await import('../../../services/supabaseClient.ts')).supabase;
  const defaultName = options.defaultName ?? 'My first project';
  const now = options.now ?? (() => new Date().toISOString());

  const { data: authData } = await client.auth.getUser();
  const userId = authData.user?.id;

  if (!userId) {
    return resolveLocalProject(defaultName, now);
  }

  const { data: projects, error } = await client
    .from('projects')
    .select('id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (!error && projects && projects.length > 0) {
    return { projectId: projects[0].id as string, didCreate: false };
  }

  const { data: created, error: createError } = await client
    .from('projects')
    .insert({
      name: defaultName,
      status: 'Active',
      date: new Date().toISOString(),
      user_id: userId
    })
    .select('id')
    .single();

  if (createError || !created) {
    return null;
  }

  return { projectId: created.id as string, didCreate: true };
};
