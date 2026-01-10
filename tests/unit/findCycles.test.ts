import assert from 'node:assert/strict';
import test from 'node:test';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const runScript = (scriptPath: string) =>
  new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    execFile(process.execPath, [scriptPath], { cwd: process.cwd() }, (error, stdout, stderr) => {
      if (error) {
        reject({ error, stdout, stderr });
        return;
      }
      resolve({ stdout, stderr });
    });
  });

test('find-cycles reports no cycles', async () => {
  const scriptPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../scripts/find-cycles.mjs'
  );
  const result = await runScript(scriptPath);
  assert.match(result.stdout, /No cycles detected/);
});
