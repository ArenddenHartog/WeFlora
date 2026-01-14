#!/usr/bin/env node

/**
 * Apply PCIV v1.1 migration to Supabase database
 * 
 * This script executes the migration SQL using a simple approach:
 * It copies the SQL content and asks you to paste it in the Supabase SQL Editor.
 */

import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   SUPABASE_URL:', !!SUPABASE_URL ? '✓' : '✗');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', !!SUPABASE_SERVICE_ROLE_KEY ? '✓' : '✗');
  process.exit(1);
}

async function applyMigration() {
  console.log('📦 PCIV v1.1 Invariants Migration\n');
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  // Read the migration file
  const migrationSQL = await readFile('supabase/migrations/20260113000000_pciv_v1_1_invariants.sql', 'utf8');
  
  console.log('Migration file contents:\n');
  console.log('─'.repeat(80));
  console.log(migrationSQL);
  console.log('─'.repeat(80));
  console.log('\n📋 To apply this migration:');
  console.log(`\n1. Open: ${SUPABASE_URL.replace('//', '//supabase.com/dashboard/project/')}/sql/new`);
  console.log('2. Copy the SQL above');
  console.log('3. Paste it into the SQL Editor');
  console.log('4. Click "Run"');
  console.log('\n⏳ After applying, press Enter to verify the constraints...');
  
  // Wait for user confirmation
  await new Promise((resolve) => {
    process.stdin.once('data', resolve);
  });
  
  console.log('\n🔍 Verifying constraints...\n');
  
  // Verify the constraints exist
  const { data, error } = await supabase.rpc('pciv_introspect');
  
  if (error) {
    console.error('❌ Failed to verify constraints:', error.message);
    console.log('\nNote: If pciv_introspect RPC doesn\'t exist, the constraints may still be applied.');
    console.log('You can verify manually in the Supabase dashboard.');
    process.exit(1);
  }
  
  const constraints = JSON.stringify(data || {});
  const requiredConstraints = [
    'pciv_inputs_value_columns_match_kind_check',
    'pciv_constraints_value_columns_match_kind_check',
    'pciv_runs_committed_at_matches_status_check'
  ];
  
  const missing = [];
  for (const constraint of requiredConstraints) {
    if (constraints.includes(constraint)) {
      console.log(`✓ ${constraint}`);
    } else {
      console.log(`✗ ${constraint}`);
      missing.push(constraint);
    }
  }
  
  if (missing.length > 0) {
    console.error('\n❌ Some constraints are missing. Migration may not have been applied yet.');
    process.exit(1);
  }
  
  console.log('\n✅ All constraints verified!');
  console.log('\nYou can now run:');
  console.log('  npm run pciv:db:audit -- --scopeId pciv-audit-smoke');
  console.log('  NODE_ENV=test node --test tests/integration/pcivSupabaseInvariants.test.ts');
}

applyMigration().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
