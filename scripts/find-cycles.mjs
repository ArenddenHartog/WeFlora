import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(process.cwd());
const TARGET_DIRS = ['src', 'components', 'contexts', 'services', 'utils'];
const FILE_REGEX = /\.(ts|tsx)$/;
const IMPORT_REGEX = /(?:import|export)\s+(?:[^'"]+from\s+)?['"](\.{1,2}\/[^'"]+)['"]/g;

const collectFiles = async (dir) => {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
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

const resolveImport = (fromFile, spec) => {
  const base = path.dirname(fromFile);
  const candidate = path.resolve(base, spec);
  const variants = [
    candidate,
    `${candidate}.ts`,
    `${candidate}.tsx`,
    path.join(candidate, 'index.ts'),
    path.join(candidate, 'index.tsx')
  ];
  return variants.find((entry) => entry && entry.startsWith(ROOT) && entry.match(FILE_REGEX)) || null;
};

const main = async () => {
  const files = [];
  for (const dir of TARGET_DIRS) {
    files.push(...(await collectFiles(path.join(ROOT, dir))));
  }

  const graph = new Map();
  for (const file of files) {
    const content = await readFile(file, 'utf8');
    const deps = new Set();
    for (const match of content.matchAll(IMPORT_REGEX)) {
      const resolved = resolveImport(file, match[1]);
      if (resolved) {
        deps.add(resolved);
      }
    }
    graph.set(file, Array.from(deps));
  }

  const visited = new Set();
  const stack = new Set();
  const cycles = [];

  const dfs = (node, pathStack) => {
    if (stack.has(node)) {
      const cycleStart = pathStack.indexOf(node);
      if (cycleStart >= 0) {
        cycles.push(pathStack.slice(cycleStart).concat(node));
      }
      return;
    }
    if (visited.has(node)) return;
    visited.add(node);
    stack.add(node);
    const deps = graph.get(node) || [];
    for (const dep of deps) {
      dfs(dep, [...pathStack, dep]);
    }
    stack.delete(node);
  };

  for (const node of graph.keys()) {
    dfs(node, [node]);
  }

  if (cycles.length === 0) {
    console.log('No cycles detected.');
    return;
  }

  const uniqueCycles = cycles.map((cycle) => cycle.join(' -> '));
  console.log('Cycles detected:');
  uniqueCycles.forEach((cycle) => console.log(`- ${cycle}`));
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
