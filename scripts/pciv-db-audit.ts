import { createClient } from '@supabase/supabase-js';
import { PcivRunV1Schema } from '../src/decision-program/pciv/v1/schemas.ts';

const tableNames = [
  'pciv_runs',
  'pciv_sources',
  'pciv_inputs',
  'pciv_input_sources',
  'pciv_constraints',
  'pciv_artifacts'
] as const;

type TableName = (typeof tableNames)[number];

type SupabaseEnv = {
  url: string;
  anonKey: string | null;
  serviceRoleKey: string | null;
  preferredKey: string;
};

const resolveSupabaseEnv = (): SupabaseEnv | null => {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? null;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? null;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? null;

  if (!url || (!anonKey && !serviceRoleKey)) {
    return null;
  }

  return {
    url,
    anonKey,
    serviceRoleKey,
    preferredKey: serviceRoleKey ?? anonKey
  };
};

const parseScopeId = () => {
  const args = process.argv.slice(2);
  const scopeIndex = args.indexOf('--scopeId');
  if (scopeIndex === -1 || !args[scopeIndex + 1]) {
    throw new Error('Usage: npm run pciv:db:audit -- --scopeId <scopeId>');
  }
  return args[scopeIndex + 1];
};

const formatHeader = (title: string) => `\n=== ${title} ===`;

const mapRunRow = (row: any) =>
  PcivRunV1Schema.parse({
    id: row.id,
    scopeId: row.scope_id,
    userId: row.user_id,
    status: row.status,
    allowPartial: row.allow_partial,
    committedAt: row.committed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  });

const main = async () => {
  const scopeId = parseScopeId();
  const env = resolveSupabaseEnv();

  if (!env) {
    console.warn('Missing Supabase env vars. Set VITE_SUPABASE_URL/SUPABASE_URL and key env vars.');
    process.exit(0);
  }

  const supabase = createClient(env.url, env.preferredKey);

  console.log(formatHeader('Supabase env'));
  console.log({
    url: env.url,
    usingServiceRole: Boolean(env.serviceRoleKey)
  });

  const { data: introspectData, error: introspectError } = await supabase.rpc('pciv_introspect');

  if (introspectError || !introspectData) {
    throw new Error(
      `pciv_introspect RPC failed: ${introspectError?.message ?? 'no data returned'}. ` +
        'Ensure the function exists in public schema and grants execute to anon/authenticated.'
    );
  }

  const tables = (introspectData as { tables?: Record<string, any> }).tables ?? {};

  console.log(formatHeader('Table report'));
  tableNames.forEach((table) => {
    const tableInfo = tables[table];
    console.log({
      table,
      exists: tableInfo?.exists ?? false,
      columns: tableInfo?.columns?.length ?? 0,
      constraints: tableInfo?.constraints?.length ?? 0,
      indexes: tableInfo?.indexes?.length ?? 0
    });
  });

  const { data: runRows, error: runError } = await supabase
    .from('pciv_runs')
    .select('*')
    .eq('scope_id', scopeId)
    .order('committed_at', { ascending: false, nullsFirst: false })
    .order('updated_at', { ascending: false })
    .limit(1);

  if (runError) {
    throw new Error(`Failed to fetch runs for scope ${scopeId}: ${runError.message}`);
  }

  const runRow = runRows?.[0];

  console.log(formatHeader('Latest run snapshot'));
  if (!runRow) {
    console.log({ scopeId, run: null, counts: null });
    return;
  }

  const run = mapRunRow(runRow);

  const [inputsCount, sourcesCount, constraintsCount, artifactsCount] = await Promise.all([
    supabase.from('pciv_inputs').select('id', { count: 'exact', head: true }).eq('run_id', run.id),
    supabase.from('pciv_sources').select('id', { count: 'exact', head: true }).eq('run_id', run.id),
    supabase.from('pciv_constraints').select('id', { count: 'exact', head: true }).eq('run_id', run.id),
    supabase.from('pciv_artifacts').select('id', { count: 'exact', head: true }).eq('run_id', run.id)
  ]);

  const counts = {
    inputs: inputsCount.count ?? 0,
    sources: sourcesCount.count ?? 0,
    constraints: constraintsCount.count ?? 0,
    artifacts: artifactsCount.count ?? 0
  };

  console.log({ scopeId, run, counts });
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
