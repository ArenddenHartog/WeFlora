#!/usr/bin/env node

/**
 * Planning Contract Guard
 *
 * Ensures runtime code does not directly access the planning_runs table.
 * Planning persistence must go through the PCIV adapter.
 *
 * Exemptions:
 * - tests/ directory (for testing DB migration/cleanup)
 * - scripts/ directory (for historical audits only)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

// Patterns that indicate forbidden planning_runs usage
const FORBIDDEN_PATTERNS = [
  /\.from\(\s*['"]planning_runs['"]\s*\)/g,
  /\/rest\/v1\/planning_runs/g,
];

// Exempted paths
const EXEMPTIONS = [
  /^tests\//,
  /^scripts\//,
];

function isExempt(filePath) {
  const relativePath = path.relative(ROOT, filePath);
  return EXEMPTIONS.some((pattern) => pattern.test(relativePath));
}

function* findSourceFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    // Skip node_modules, .git, dist, etc.
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

function checkFile(filePath) {
  if (isExempt(filePath)) {
    return [];
  }
  
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
        pattern: pattern.source,
      });
    }
  }
  
  return violations;
}

function main() {
  console.log('🔍 Running Planning Contract Guard\n');
  
  let allViolations = [];
  
  // Check all source files
  for (const filePath of findSourceFiles(ROOT)) {
    const violations = checkFile(filePath);
    allViolations.push(...violations);
  }
  
  if (allViolations.length > 0) {
    console.error('❌ Planning contract violations found:\n');
    for (const violation of allViolations) {
      console.error(`  ${violation.file}:${violation.line}`);
      console.error(`    Pattern: ${violation.pattern}\n`);
    }
    console.error('Runtime code must not access planning_runs table directly.');
    console.error('Use src/decision-program/planning/storage/planningPcivAdapter.ts instead.\n');
    process.exit(1);
  }
  
  console.log('✅ No forbidden planning_runs usage found');
  console.log('✅ Planning contract checks passed\n');
}

main();
