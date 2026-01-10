import assert from 'node:assert/strict';
import test from 'node:test';

const setupEnv = () => {
  process.env.VITE_SUPABASE_URL = 'https://example.supabase.co';
  process.env.VITE_SUPABASE_ANON_KEY = 'test-key';
};

test('planning routing + utils import without circular init errors', async () => {
  setupEnv();
  await assert.doesNotReject(async () => {
    await import('../../components/routes/planningRoutePaths.ts');
    await import('../../components/planning/planningUtils.ts');
  });
});
