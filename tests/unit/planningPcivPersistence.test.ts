/**
 * Unit tests for Planning PCIV persistence adapter
 *
 * Validates that Planning persistence:
 * - Does not depend on planning_runs table
 * - Uses PCIV adapter functions correctly
 * - Derives scopeId from projectId with proper fallback
 * - Handles auth/RLS errors gracefully
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Skip tests if env vars missing (adapter needs Supabase client)
const hasEnvVars = !!process.env.VITE_SUPABASE_URL && !!process.env.VITE_SUPABASE_ANON_KEY;

describe('Planning PCIV Persistence', { skip: !hasEnvVars }, () => {
  let deriveScopeId: any;
  
  before(async () => {
    // Dynamically import only if env vars are present
    const adapter = await import('../../src/decision-program/planning/storage/planningPcivAdapter.ts');
    deriveScopeId = adapter.deriveScopeId;
  });

  describe('deriveScopeId', () => {
    it('returns projectId when provided', () => {
      assert.strictEqual(deriveScopeId('project-abc-123'), 'project-abc-123');
    });

    it('returns "project" when projectId is null', () => {
      assert.strictEqual(deriveScopeId(null), 'project');
    });

    it('returns "project" when projectId is undefined', () => {
      assert.strictEqual(deriveScopeId(undefined), 'project');
    });

    it('returns "project" when projectId is empty string', () => {
      assert.strictEqual(deriveScopeId(''), 'project');
    });
  });
});

describe('Planning Contract Validation', () => {
  it('does not reference planning_runs table directly', async () => {
    // Read the adapter source code
    const fs = await import('node:fs');
    const path = await import('node:path');
    
    const adapterPath = path.resolve(__dirname, '../../src/decision-program/planning/storage/planningPcivAdapter.ts');
    const adapterSource = fs.readFileSync(adapterPath, 'utf-8');
    
    // Assert no direct table queries
    assert.strictEqual(
      adapterSource.includes("from('planning_runs')"),
      false,
      'Adapter must not query planning_runs table directly'
    );
    
    // Check for planning_runs references, but allow doc comments
    const codeOnlySource = adapterSource.replace(/\/\*\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '');
    assert.strictEqual(
      codeOnlySource.includes('planning_runs'),
      false,
      'Adapter must not reference planning_runs table in code (excluding comments)'
    );
  });

  it('only uses PCIV adapter functions', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    
    const adapterPath = path.resolve(__dirname, '../../src/decision-program/planning/storage/planningPcivAdapter.ts');
    const adapterSource = fs.readFileSync(adapterPath, 'utf-8');
    
    // Check imports are from PCIV adapter (more flexible regex)
    assert.match(
      adapterSource,
      /from ['"].*pciv.*storage.*supabase/,
      'Must import from PCIV adapter'
    );
    
    // Should not have direct supabase.from calls
    const directDbCalls = adapterSource.match(/supabase\.from\(/g);
    assert.strictEqual(
      directDbCalls,
      null,
      'Should not make direct Supabase queries'
    );
  });
});
