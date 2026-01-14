#!/usr/bin/env node

/**
 * Database Schema Contract Test
 * Verifies that the Supabase database schema matches the SCHEMA_CONTRACT.md
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

// Load environment variables from .env file
config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   SUPABASE_URL:', !!SUPABASE_URL ? '✓' : '✗');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', !!SUPABASE_SERVICE_ROLE_KEY ? '✗' : '✓');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Expected schema per SCHEMA_CONTRACT.md
const EXPECTED_SCHEMA = {
  projects: ['id', 'user_id', 'name', 'status', 'date', 'created_at'],
  matrices: ['id', 'user_id', 'project_id', 'parent_id', 'title', 'description', 'columns', 'rows', 'updated_at'],
  reports: ['id', 'user_id', 'project_id', 'parent_id', 'title', 'content', 'tags', 'updated_at']
};

const FORBIDDEN_TABLES = ['workspaces', 'species', 'tasks', 'comments'];
const FORBIDDEN_COLUMNS = {
  projects: ['workspace_id', 'members']
};

async function testTableExists(tableName) {
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(0);
    
    if (error) {
      console.error(`❌ Table '${tableName}' failed: ${error.message}`);
      return false;
    }
    console.log(`✓ Table '${tableName}' exists`);
    return true;
  } catch (err) {
    console.error(`❌ Table '${tableName}' error: ${err.message}`);
    return false;
  }
}

async function testTableColumns(tableName, expectedColumns) {
  try {
    // Get one row to check columns (or empty result if table is empty)
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(1);
    
    if (error) {
      console.error(`❌ Failed to query ${tableName}: ${error.message}`);
      return false;
    }

    // Try to select specific columns to verify they exist
    for (const col of expectedColumns) {
      const { error: colError } = await supabase
        .from(tableName)
        .select(col)
        .limit(1);
      
      if (colError) {
        console.error(`❌ Column '${tableName}.${col}' not found or inaccessible`);
        return false;
      }
    }
    
    console.log(`✓ All expected columns exist in '${tableName}'`);
    return true;
  } catch (err) {
    console.error(`❌ Error checking columns in '${tableName}': ${err.message}`);
    return false;
  }
}

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

async function grepForbiddenTables(forbidden) {
  const roots = ['src', 'components', 'scripts'].map((p) => path.join(process.cwd(), p));
  const files = [];
  for (const r of roots) {
    try { files.push(...(await walk(r))); } catch { /* ignore missing dirs */ }
  }

  const hits = [];
  for (const f of files) {
    const txt = await readFile(f, 'utf8');
    for (const t of forbidden) {
      // catches supabase-js usage: from('table') or from("table")
      const re = new RegExp(`\\bfrom\\(\\s*['"]${t}['"]\\s*\\)`, 'g');
      if (re.test(txt)) hits.push({ table: t, file: f });
    }
  }
  return hits;
}

async function runTests() {
  console.log('🔍 Running Database Schema Contract Tests\n');
  console.log('Environment:');
  console.log(`  SUPABASE_URL: ${SUPABASE_URL}`);
  console.log(`  Using SERVICE_ROLE_KEY: ✓\n`);
  
  let allPassed = true;

  // Test required tables exist
  console.log('Testing required tables...');
  for (const tableName of Object.keys(EXPECTED_SCHEMA)) {
    const exists = await testTableExists(tableName);
    if (!exists) allPassed = false;
  }
  console.log();

  // Test required columns exist
  console.log('Testing required columns...');
  for (const [tableName, columns] of Object.entries(EXPECTED_SCHEMA)) {
    const columnsOk = await testTableColumns(tableName, columns);
    if (!columnsOk) allPassed = false;
  }
  console.log();

  // Test forbidden tables (client must not reference)
  console.log('Testing forbidden tables (client must not reference)...');
  const forbiddenTables = ['workspaces', 'species', 'tasks', 'comments'];
  const hits = await grepForbiddenTables(forbiddenTables);

  if (hits.length === 0) {
    console.log('✓ No forbidden table references found in client code');
  } else {
    for (const h of hits) console.log(`❌ Forbidden reference: ${h.table} in ${h.file}`);
    allPassed = false;
  }
  console.log();

  // Summary
  if (allPassed) {
    console.log('✅ All database contract tests PASSED');
    process.exit(0);
  } else {
    console.log('❌ Some database contract tests FAILED');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
