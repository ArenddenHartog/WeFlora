#!/usr/bin/env node

/**
 * Planner Pack Contract Guard
 *
 * Ensures runtime code does not directly access planner_* tables
 * outside the Planner Pack adapter.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const FORBIDDEN_PATTERNS = [
  /\.from\(\s*['"]planner_[^'"]+['"]\s*\)/g,
  /\/rest\/v1\/planner_[^\s"']+/g
];

const EXEMPTIONS = [
  /^tests\//,
  /^scripts\//,
  /^src\/planner-pack\/v1\/storage\/supabase\.ts$/
];

const isExempt = (filePath) => {
  const relativePath = path.relative(ROOT, filePath);
  return EXEMPTIONS.some((pattern) => pattern.test(relativePath));
};

function* findSourceFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === 'build') {
      continue;
    }

    if (entry.isDirectory()) {
      yield* findSourceFiles(fullPath);
    } else if (entry.isFile() && /\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      yield fullPath;
    }
  }
}

const checkFile = (filePath) => {
  if (isExempt(filePath)) return [];

  const content = fs.readFileSync(filePath, 'utf-8');
  const violations = [];

  for (const pattern of FORBIDDEN_PATTERNS) {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      const lines = content.slice(0, match.index).split('\n');
      const lineNumber = lines.length;
      violations.push({
        file: path.relative(ROOT, filePath),
        line: lineNumber,
        pattern: pattern.source
      });
    }
  }

  return violations;
};

function main() {
  console.log('🔍 Running Planner Pack Contract Guard\n');

  let allViolations = [];

  for (const filePath of findSourceFiles(ROOT)) {
    const violations = checkFile(filePath);
    allViolations = allViolations.concat(violations);
  }

  if (allViolations.length > 0) {
    console.error('❌ Planner Pack contract violations found:\n');
    for (const violation of allViolations) {
      console.error(`  ${violation.file}:${violation.line}`);
      console.error(`    Pattern: ${violation.pattern}\n`);
    }
    console.error('Runtime code must not access planner_* tables directly.');
    console.error('Use src/planner-pack/v1/storage/supabase.ts instead.\n');
    process.exit(1);
  }

  console.log('✅ No forbidden planner_* usage found');
  console.log('✅ Planner Pack contract checks passed\n');
}

main();
