import assert from 'node:assert/strict';
import test from 'node:test';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();

const readViteConfig = async () => {
  const configPath = path.join(ROOT, 'vite.config.ts');
  const contents = await readFile(configPath, 'utf8');
  return contents;
};

const getSourcemapSetting = async () => {
  const contents = await readViteConfig();
  if (/sourcemap:\s*['"]inline['"]/.test(contents)) {
    return 'inline';
  }
  if (/sourcemap:\s*true/.test(contents)) {
    return true;
  }
  return false;
};

test('build output includes sourcemaps when enabled', async () => {
  if (process.env.RUN_BUILD_ASSERTS !== '1') {
    assert.ok(true);
    return;
  }
  const sourcemapSetting = await getSourcemapSetting();
  if (sourcemapSetting !== true) {
    assert.ok(true);
    return;
  }

  const assetsDir = path.join(ROOT, 'dist', 'assets');
  const exists = await stat(assetsDir).then(() => true).catch(() => false);
  assert.ok(exists, 'dist/assets does not exist; run the build before tests.');

  const entries = await readdir(assetsDir);
  const maps = entries.filter((entry) => entry.endsWith('.map'));
  assert.ok(maps.length > 0, 'No sourcemap files found in dist/assets.');
});
