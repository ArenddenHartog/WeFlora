import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT_DIR = path.resolve(process.cwd());
const TARGET_DIRS = ['src', 'components', 'contexts', 'services', 'utils'];
const FILE_REGEX = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
const ENV_REGEX = /import\.meta\.env\.(VITE_[A-Z0-9_]+)/g;

const collectFiles = async (dir: string): Promise<string[]> => {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(fullPath)));
      continue;
    }
    if (FILE_REGEX.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
};

const main = async () => {
  const envVars = new Set<string>();
  for (const dir of TARGET_DIRS) {
    const fullDir = path.join(ROOT_DIR, dir);
    const files = await collectFiles(fullDir);
    for (const file of files) {
      const contents = await readFile(file, 'utf8');
      for (const match of contents.matchAll(ENV_REGEX)) {
        envVars.add(match[1]);
      }
    }
  }

  const sorted = Array.from(envVars).sort();
  if (sorted.length === 0) {
    console.log('No VITE_* env vars referenced.');
    return;
  }

  console.log('VITE_* env vars referenced:');
  sorted.forEach((name) => console.log(`- ${name}`));
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
