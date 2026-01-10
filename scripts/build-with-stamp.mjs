import { execSync, spawn } from 'node:child_process';
import path from 'node:path';

const resolveViteBin = () => {
  const bin = process.platform === 'win32' ? 'vite.cmd' : 'vite';
  return path.resolve('node_modules', '.bin', bin);
};

const getSha = () => {
  try {
    return execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return 'unknown';
  }
};

const getTime = () => new Date().toISOString();

const viteBin = resolveViteBin();
const env = {
  ...process.env,
  VITE_BUILD_SHA: process.env.VITE_BUILD_SHA ?? getSha(),
  VITE_BUILD_TIME: process.env.VITE_BUILD_TIME ?? getTime()
};

const args = ['build', ...process.argv.slice(2)];
const child = spawn(viteBin, args, { stdio: 'inherit', env });

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
