#!/usr/bin/env node
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

function readAllowlist() {
  const p = path.resolve(process.cwd(), 'src/config/aiPresence.ts');
  const src = fs.readFileSync(p, 'utf8');
  const m = src.match(/ALLOWLIST_ASK_SURFACES\s*=\s*\[([\s\S]*?)\]\s*as const/);
  if (!m) return [];
  const body = m[1];
  const items = [];
  const re = /'([^']+)'/g;
  let mm;
  while ((mm = re.exec(body))) items.push(mm[1]);
  return items;
}

function getDiff(baseRef) {
  const mergeBase = execSync(`git merge-base ${baseRef} HEAD`, { encoding: 'utf8' }).trim();
  // Compare merge-base -> working tree (so local runs include uncommitted changes).
  return execSync(`git diff --unified=0 ${mergeBase}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function main() {
  const baseRef = process.env.UX_LINT_BASE || 'origin/main';
  const allowAsk = new Set(readAllowlist());

  const diff = getDiff(baseRef);
  const lines = diff.split('\n');

  const purpleRe = /\b(?:bg|text|border|ring)-purple-(?:\d{2,3})\b/;
  const askStringRe = /\bAsk FloraGPT\b/;

  // Only enforce against new additions in components/ by default.
  const purpleScopeRe = /^components\//;
  const askScopeRe = /^components\//;

  const errors = [];
  let currentFile = null;

  for (const line of lines) {
    if (line.startsWith('+++ b/')) {
      currentFile = line.slice('+++ b/'.length).trim();
      continue;
    }
    if (!currentFile) continue;

    // Only added lines, ignore file headers.
    if (!line.startsWith('+') || line.startsWith('+++')) continue;

    const added = line.slice(1);

    if (purpleScopeRe.test(currentFile) && purpleRe.test(added)) {
      errors.push(`[AI purple token violation] ${currentFile}: ${added.trim()}`);
    }

    if (askScopeRe.test(currentFile) && askStringRe.test(added) && !allowAsk.has(currentFile)) {
      errors.push(`[Ask surface violation] ${currentFile}: ${added.trim()}`);
    }
  }

  if (errors.length > 0) {
    console.error(`ux-lint failed against base '${baseRef}':\n`);
    for (const e of errors) console.error(`- ${e}`);
    console.error('\nFix the violations or update allowlists in src/config/aiPresence.ts.');
    process.exit(1);
  }

  console.log(`ux-lint passed (base: ${baseRef})`);
}

main();

