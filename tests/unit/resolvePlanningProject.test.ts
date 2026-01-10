import assert from 'node:assert/strict';
import test from 'node:test';
import { resolvePlanningProject } from '../../src/lib/projects/resolvePlanningProject.ts';

const buildClient = (projects: Array<{ id: string; created_at: string }>) => ({
  auth: {
    getUser: async () => ({ data: { user: { id: 'user-1' } } })
  },
  from: () => ({
    select: () => ({
      eq: () => ({
        order: () => ({
          limit: async () => ({ data: projects, error: null })
        })
      })
    }),
    insert: () => ({
      select: () => ({
        single: async () => ({ data: { id: 'new-project' }, error: null })
      })
    })
  })
});

test('resolvePlanningProject creates a project when none exist', async () => {
  const clientWithNone = buildClient([]);
  const created = await resolvePlanningProject({ client: clientWithNone as any, now: () => '2024-01-01T00:00:00.000Z' });
  assert.ok(created);
  assert.equal(created?.projectId, 'new-project');
});

test('resolvePlanningProject returns latest existing project', async () => {
  const clientWithExisting = buildClient([{ id: 'existing-project', created_at: '2024-03-01T00:00:00.000Z' }]);
  const resolved = await resolvePlanningProject({ client: clientWithExisting as any });
  assert.ok(resolved);
  assert.equal(resolved?.projectId, 'existing-project');
});
