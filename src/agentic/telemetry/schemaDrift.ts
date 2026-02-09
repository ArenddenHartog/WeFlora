/**
 * Schema Drift Detection (client-side checks)
 *
 * Provides instant PASS/FAIL checks for required tables, columns, RPCs.
 * Uses direct table reads (no RPC dependency for discovery).
 *
 * For full SQL-based checks, see scripts/schema-drift-check.sql.
 */

export interface DriftCheck {
  type: 'table' | 'column' | 'rpc' | 'constraint';
  name: string;
  result: 'PASS' | 'FAIL' | 'SKIP';
  detail?: string;
}

/**
 * Run client-side schema drift checks against the Supabase instance.
 *
 * These checks use direct table queries (not RPC) to verify the schema
 * exists. They're designed to be instant and non-destructive.
 */
export async function runSchemaDriftChecks(
  supabaseClient: any,
): Promise<DriftCheck[]> {
  const checks: DriftCheck[] = [];

  // 1. Check required tables exist by attempting a minimal select
  const tables = ['vault_objects', 'flow_drafts', 'memory_items', 'memory_policies', 'messages'];
  for (const table of tables) {
    try {
      const { error, status } = await supabaseClient
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error && (error.code === '42P01' || error.message?.includes('does not exist'))) {
        checks.push({ type: 'table', name: table, result: 'FAIL', detail: 'Table not found' });
      } else if (error && error.code === '42501') {
        // Permission denied = table exists but RLS blocks
        checks.push({ type: 'table', name: table, result: 'PASS', detail: 'Exists (RLS active)' });
      } else if (error) {
        checks.push({ type: 'table', name: table, result: 'FAIL', detail: error.message });
      } else {
        checks.push({ type: 'table', name: table, result: 'PASS' });
      }
    } catch (e) {
      checks.push({ type: 'table', name: table, result: 'FAIL', detail: (e as Error).message });
    }
  }

  // 2. Check vault_objects has required columns by selecting them
  const requiredColumns = ['id', 'status', 'confidence', 'relevance', 'tags', 'record_type', 'title'];
  try {
    const { error } = await supabaseClient
      .from('vault_objects')
      .select(requiredColumns.join(','))
      .limit(0);

    if (error) {
      // Parse which columns are missing from the error message
      checks.push({
        type: 'column',
        name: `vault_objects.{${requiredColumns.join(',')}}`,
        result: 'FAIL',
        detail: error.message,
      });
    } else {
      requiredColumns.forEach((col) => {
        checks.push({ type: 'column', name: `vault_objects.${col}`, result: 'PASS' });
      });
    }
  } catch (e) {
    checks.push({
      type: 'column',
      name: 'vault_objects.*',
      result: 'FAIL',
      detail: (e as Error).message,
    });
  }

  // 3. Check mutation RPCs exist
  const rpcs = ['vault_claim_next_review', 'vault_update_review'];
  for (const rpc of rpcs) {
    try {
      // Call with obviously wrong params — we only care about whether
      // we get PGRST202 (function not found) vs any other response.
      const { error, status } = await supabaseClient.rpc(rpc, {});
      if (error?.code === 'PGRST202') {
        checks.push({ type: 'rpc', name: rpc, result: 'FAIL', detail: 'RPC not deployed' });
      } else {
        // Any other error (param mismatch, etc.) means the RPC exists
        checks.push({ type: 'rpc', name: rpc, result: 'PASS', detail: error ? `Exists (${error.code})` : 'OK' });
      }
    } catch (e) {
      checks.push({ type: 'rpc', name: rpc, result: 'FAIL', detail: (e as Error).message });
    }
  }

  return checks;
}

/**
 * Summary of drift check results.
 */
export function summarizeDriftChecks(checks: DriftCheck[]): {
  total: number;
  passed: number;
  failed: number;
  allPassed: boolean;
} {
  const passed = checks.filter((c) => c.result === 'PASS').length;
  const failed = checks.filter((c) => c.result === 'FAIL').length;
  return {
    total: checks.length,
    passed,
    failed,
    allPassed: failed === 0,
  };
}
