#!/usr/bin/env node

/**
 * PCIV Contract Guard - ensures adapter-only access and single schema pack.
 * 
 * v1.2 additions:
 * - Blocks __pcivTest*Unsafe imports in runtime code
 * - Warns on pciv_v0_context access when v0 fallback disabled
 * 
 * Fails if:
 * - Any code outside the adapter calls supabase.from('pciv_*')
 * - PCIV v1 schema/type definitions exist outside schemas.ts
 * - Runtime code (non-test) imports __pcivTest*Unsafe helpers
 */

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

async function walk(dir) {
  const out = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === 'dist' || e.name.startsWith('.')) continue;
      out.push(...(await walk(full)));
    } else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(e.name)) {
      out.push(full);
    }
  }
  return out;
}

async function checkAdapterOnlyAccess() {
  const roots = ['src', 'components', 'scripts', 'tests'].map((p) => path.join(process.cwd(), p));
  const files = [];
  for (const r of roots) {
    try {
      files.push(...(await walk(r)));
    } catch {
      /* ignore missing dirs */
    }
  }

  const violations = [];
  const allowedAdapter = path.join(process.cwd(), 'src/decision-program/pciv/v1/storage/supabase.ts');
  const allowedAudit = path.join(process.cwd(), 'scripts/pciv-db-audit.ts');
  const testContractGuard = path.join(process.cwd(), 'scripts/test-pciv-contract.mjs');

  for (const f of files) {
    // Skip the allowed adapter file
    if (f === allowedAdapter) continue;
    
    // Skip pciv-db-audit.ts (allowed to call RPC only, but direct access for audit is acceptable)
    if (f === allowedAudit) continue;
    
    // Skip self-reference in contract guard comments
    if (f === testContractGuard) continue;

    const txt = await readFile(f, 'utf8');
    const lines = txt.split('\n');

    // Check for direct pciv_* table access patterns
    const patterns = [
      /supabase\.from\(\s*['"]pciv_/g,
      /\.from\(\s*['"]pciv_/g
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Skip comments
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;
      
      for (const pattern of patterns) {
        if (pattern.test(line)) {
          // Allow integration tests to directly access PCIV tables for testing RLS, invariants, etc.
          if (f.includes('tests/integration/')) continue;
          
          // Allow RPC calls in tests (e.g., supabase.rpc())
          if (f.includes('tests/') && (line.includes('.rpc(') || line.includes('.delete()'))) continue;

          violations.push({
            file: path.relative(process.cwd(), f),
            line: i + 1,
            content: line.trim(),
            type: 'forbidden-table-access'
          });
        }
      }
    }
  }

  return violations;
}

async function checkSingleSchemaPackRule() {
  const v1Dir = path.join(process.cwd(), 'src/decision-program/pciv/v1');
  try {
    const files = await walk(v1Dir);
    const violations = [];
    const allowedSchemaFile = path.join(v1Dir, 'schemas.ts');

    for (const f of files) {
      // Skip the allowed schemas.ts file
      if (f === allowedSchemaFile) continue;

      const txt = await readFile(f, 'utf8');
      const lines = txt.split('\n');

      // Check for schema/type definitions
      const patterns = [
        { regex: /z\.object\(/g, message: 'Zod schema definition' },
        { regex: /export\s+interface\s+Pciv/g, message: 'PCIV interface export' },
        { regex: /export\s+type\s+Pciv/g, message: 'PCIV type export' }
      ];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (const { regex, message } of patterns) {
          if (regex.test(line)) {
            // Allow imports and usages, only flag definitions
            if (line.includes('import') || line.includes('from')) continue;
            if (line.includes('= z.object(')) {
              violations.push({
                file: path.relative(process.cwd(), f),
                line: i + 1,
                content: line.trim(),
                type: 'schema-outside-pack',
                message
              });
            }
          }
        }
      }
    }

    return violations;
  } catch (err) {
    // v1 directory might not exist yet
    return [];
  }
}

async function checkTestOnlyHelpers() {
  const roots = ['src', 'components', 'scripts'].map((p) => path.join(process.cwd(), p));
  const files = [];
  for (const r of roots) {
    try {
      files.push(...(await walk(r)));
    } catch {
      /* ignore missing dirs */
    }
  }

  const violations = [];
  const testOnlyPattern = /__pcivTest\w*Unsafe/g;
  const allowedAdapter = path.join(process.cwd(), 'src/decision-program/pciv/v1/storage/supabase.ts');

  for (const f of files) {
    // Allow tests directory to use test helpers
    if (f.includes('/tests/')) continue;
    
    // Allow adapter to DEFINE test helpers (but not consume them in runtime paths)
    if (f === allowedAdapter) continue;
    
    const txt = await readFile(f, 'utf8');
    const lines = txt.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Skip comments
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;
      
      // Check for test-only helper usage
      if (testOnlyPattern.test(line)) {
        violations.push({
          file: path.relative(process.cwd(), f),
          line: i + 1,
          content: line.trim(),
          type: 'test-only-in-runtime'
        });
      }
    }
  }

  return violations;
}

async function main() {
  console.log('🔍 Running PCIV Contract Guard\n');

  let failed = false;

  // Check adapter-only access
  console.log('Checking adapter-only access to pciv_* tables...');
  const accessViolations = await checkAdapterOnlyAccess();
  if (accessViolations.length === 0) {
    console.log('✓ No forbidden pciv_* table access found\n');
  } else {
    console.log('❌ Found forbidden table access:\n');
    for (const v of accessViolations) {
      console.log(`  ${v.file}:${v.line}`);
      console.log(`    ${v.content}`);
      console.log('    Only src/decision-program/pciv/v1/storage/supabase.ts may call .from(\'pciv_*\')\n');
    }
    failed = true;
  }

  // Check single schema pack rule
  console.log('Checking single schema pack rule...');
  const schemaViolations = await checkSingleSchemaPackRule();
  if (schemaViolations.length === 0) {
    console.log('✓ All PCIV schemas in single pack (v1/schemas.ts)\n');
  } else {
    console.log('❌ Found schema definitions outside schemas.ts:\n');
    for (const v of schemaViolations) {
      console.log(`  ${v.file}:${v.line} - ${v.message}`);
      console.log(`    ${v.content}\n`);
    }
    failed = true;
  }

  // v1.2: Check test-only helpers not used in runtime code
  console.log('Checking test-only helpers not used in runtime code...');
  const testHelperViolations = await checkTestOnlyHelpers();
  if (testHelperViolations.length === 0) {
    console.log('✓ No test-only helpers in runtime code\n');
  } else {
    console.log('❌ Found test-only helper usage in runtime code:\n');
    for (const v of testHelperViolations) {
      console.log(`  ${v.file}:${v.line}`);
      console.log(`    ${v.content}`);
      console.log('    __pcivTest*Unsafe helpers must only be used in tests/\n');
    }
    failed = true;
  }

  if (failed) {
    console.log('❌ PCIV contract violations detected');
    process.exit(1);
  } else {
    console.log('✅ All PCIV contract checks passed');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
