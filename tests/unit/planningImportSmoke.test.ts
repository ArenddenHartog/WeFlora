import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

test('planning route bundle builds without throwing', async () => {
  setupEnv();
  const { build } = await import('esbuild');
  const entryPoint = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../components/routes/PlanningRoute.ts'
  );
  await build({
    entryPoints: [entryPoint],
    bundle: true,
    platform: 'node',
    format: 'esm',
    write: false,
    logLevel: 'silent'
  });
});
