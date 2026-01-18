#!/usr/bin/env node
/**
 * PCIV v1.2 Production Smoke Test
 * 
 * Tests real adapter + DB workflow without unsafe test helpers.
 * Must run against live Supabase with proper env vars.
 */

import { createClient } from '@supabase/supabase-js';
import * as adapter from '../src/decision-program/pciv/v1/storage/supabase.ts';
import { resolveContextView } from '../src/decision-program/pciv/v1/resolveContextView.ts';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required env vars: VITE_SUPABASE_URL/SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const scopeId = `pciv-smoke-${Date.now()}`;
let runId: string | null = null;

const cleanup = async () => {
  if (runId) {
    try {
      await adapter.deleteRun(runId);
      console.log(`✅ Cleaned up run: ${runId}`);
    } catch (err) {
      console.warn(`⚠️  Cleanup failed: ${err.message}`);
    }
  }
};

const main = async () => {
  console.log('🧪 PCIV v1.2 Production Smoke Test');
  console.log(`   Scope ID: ${scopeId}`);
  console.log(`   Supabase: ${SUPABASE_URL}`);
  console.log('');

  try {
    // Step 1: Create draft run
    console.log('1️⃣  Creating draft run...');
    const run = await adapter.createDraftRun(scopeId);
    runId = run.id;
    console.log(`   ✓ Run ID: ${run.id}`);
    console.log(`   ✓ Status: ${run.status}`);

    // Step 2: Upsert sources
    console.log('2️⃣  Upserting sources...');
    const sources = [
      {
        id: crypto.randomUUID(),
        runId: run.id,
        kind: 'manual' as const,
        title: 'Smoke Test Source 1',
        uri: 'smoke:test:source-1',
        fileId: null,
        mimeType: null,
        sizeBytes: null,
        parseStatus: 'parsed' as const,
        excerpt: 'Test source for smoke test',
        rawMeta: { test: true },
        createdAt: new Date().toISOString()
      }
    ];
    await adapter.upsertSources(run.id, sources);
    console.log(`   ✓ Upserted ${sources.length} source(s)`);

    // Step 3: Upsert inputs
    console.log('3️⃣  Upserting inputs...');
    const inputs = [
      {
        id: crypto.randomUUID(),
        runId: run.id,
        pointer: 'test_input_1',
        label: 'Test Input 1',
        domain: 'site' as const,
        required: true,
        fieldType: 'text' as const,
        options: null,
        valueKind: 'string' as const,
        valueString: 'smoke test value',
        valueNumber: null,
        valueBoolean: null,
        valueEnum: null,
        valueJson: null,
        provenance: 'source-backed' as const,
        updatedBy: 'system' as const,
        updatedAt: new Date().toISOString(),
        evidenceSnippet: 'test snippet',
        sourceIds: [sources[0].id]
      },
      {
        id: crypto.randomUUID(),
        runId: run.id,
        pointer: 'test_input_2',
        label: 'Test Input 2',
        domain: 'regulatory' as const,
        required: false,
        fieldType: 'text' as const,
        options: null,
        valueKind: 'number' as const,
        valueString: null,
        valueNumber: 42,
        valueBoolean: null,
        valueEnum: null,
        valueJson: null,
        provenance: 'user-entered' as const,
        updatedBy: 'user' as const,
        updatedAt: new Date().toISOString(),
        evidenceSnippet: null,
        sourceIds: []
      }
    ];
    await adapter.upsertInputs(run.id, inputs);
    console.log(`   ✓ Upserted ${inputs.length} input(s)`);
    // Step 3b: Link input sources
    console.log('3️⃣b Link input sources...');
    await adapter.linkInputSources(run.id, [
      { inputId: inputs[0].id, sourceId: sources[0].id }
    ]);
    console.log(`   ✓ Linked 1 input source`);
    // Step 4: Upsert constraint
    console.log('4️⃣  Upserting constraints...');
    const constraints = [
      {
        id: crypto.randomUUID(),
        runId: run.id,
        key: 'test_constraint_1',
        domain: 'regulatory' as const,
        label: 'Test Constraint',
        valueKind: 'boolean' as const,
        valueString: null,
        valueNumber: null,
        valueBoolean: true,
        valueEnum: null,
        valueJson: null,
        provenance: 'source-backed' as const,
        sourceId: sources[0].id,
        snippet: 'Test constraint snippet from extraction',
        createdAt: new Date().toISOString()
      }
    ];
    await adapter.upsertConstraints(run.id, constraints);
    console.log(`   ✓ Upserted ${constraints.length} constraint(s)`);

    // Step 5: Commit run
    console.log('5️⃣  Committing run...');
    const committedRun = await adapter.commitRun(run.id, false);
    console.log(`   ✓ Status: ${committedRun.status}`);
    console.log(`   ✓ Committed at: ${committedRun.committedAt}`);

    // Step 6: Resolve ContextView
    console.log('6️⃣  Resolving ContextView...');
    const view = await resolveContextView({ scopeId, prefer: 'latest_commit' });
    console.log(`   ✓ Run ID: ${view.run.id}`);
    console.log(`   ✓ Status: ${view.run.status}`);
    console.log(`   ✓ Inputs: ${Object.keys(view.inputsByPointer).length}`);
    console.log(`   ✓ Sources: ${Object.keys(view.sourcesById).length}`);
    console.log(`   ✓ Constraints: ${view.constraints.length}`);

    // Step 7: Cleanup
    console.log('7️⃣  Cleaning up...');
    await cleanup();

    console.log('');
    console.log('✅ Smoke test PASSED');
    process.exit(0);
  } catch (error) {
    console.error('');
    console.error('❌ Smoke test FAILED');
    console.error(error);
    await cleanup();
    process.exit(1);
  }
};

main();
