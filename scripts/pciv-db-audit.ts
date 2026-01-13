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

const findIndexColumns = (indexDef: string) => {
  const match = indexDef.match(/\(([^)]+)\)/);
  if (!match) return [];
  return match[1]
    .split(',')
    .map((value) => value.trim())
    .map((value) => value.replace(/"/g, ''))
    .map((value) => value.split(' ')[0])
    .filter(Boolean);
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

  const { data: tableRows, error: tableError } = await supabase
    .schema('information_schema')
    .from('tables')
    .select('table_name')
    .eq('table_schema', 'public')
    .in('table_name', tableNames as unknown as string[]);

  if (tableError) {
    throw new Error(`Failed to read information_schema.tables: ${tableError.message}`);
  }

  const existingTables = new Set((tableRows ?? []).map((row) => row.table_name));

  console.log(formatHeader('Table existence'));
  tableNames.forEach((table) => {
    console.log({ table, exists: existingTables.has(table) });
  });

  const { data: columnRows, error: columnError } = await supabase
    .schema('information_schema')
    .from('columns')
    .select('table_name,column_name,data_type,is_nullable')
    .eq('table_schema', 'public')
    .in('table_name', tableNames as unknown as string[]);

  if (columnError) {
    throw new Error(`Failed to read information_schema.columns: ${columnError.message}`);
  }

  console.log(formatHeader('Columns'));
  tableNames.forEach((table) => {
    const columns = (columnRows ?? []).filter((row) => row.table_name === table);
    console.log({ table, columns });
  });

  const { data: namespaceRows, error: namespaceError } = await supabase
    .schema('pg_catalog')
    .from('pg_namespace')
    .select('oid')
    .eq('nspname', 'public')
    .single();

  if (namespaceError || !namespaceRows) {
    throw new Error(`Failed to read pg_namespace: ${namespaceError?.message ?? 'missing row'}`);
  }

  const { data: classRows, error: classError } = await supabase
    .schema('pg_catalog')
    .from('pg_class')
    .select('oid,relname,relnamespace')
    .eq('relnamespace', namespaceRows.oid)
    .in('relname', tableNames as unknown as string[]);

  if (classError) {
    throw new Error(`Failed to read pg_class: ${classError.message}`);
  }

  const tableOids = new Map<string, number>();
  (classRows ?? []).forEach((row) => {
    tableOids.set(row.relname, row.oid);
  });

  const { data: attributeRows, error: attributeError } = await supabase
    .schema('pg_catalog')
    .from('pg_attribute')
    .select('attrelid,attnum,attname,attisdropped')
    .in('attrelid', Array.from(tableOids.values()))
    .gt('attnum', 0)
    .eq('attisdropped', false);

  if (attributeError) {
    throw new Error(`Failed to read pg_attribute: ${attributeError.message}`);
  }

  const attributesByTable = new Map<number, Map<number, string>>();
  (attributeRows ?? []).forEach((row) => {
    const tableMap = attributesByTable.get(row.attrelid) ?? new Map<number, string>();
    tableMap.set(row.attnum, row.attname);
    attributesByTable.set(row.attrelid, tableMap);
  });

  const { data: constraintRows, error: constraintError } = await supabase
    .schema('pg_catalog')
    .from('pg_constraint')
    .select('conname,contype,conrelid,confrelid,conkey,confkey')
    .in('conrelid', Array.from(tableOids.values()));

  if (constraintError) {
    throw new Error(`Failed to read pg_constraint: ${constraintError.message}`);
  }

  const oidToTable = new Map<number, string>();
  tableOids.forEach((oid, name) => oidToTable.set(oid, name));

  const constraintsByTable = new Map<string, {
    primaryKeys: Array<{ name: string; columns: string[] }>;
    uniques: Array<{ name: string; columns: string[] }>;
    foreignKeys: Array<{ name: string; columns: string[]; references: { table: string; columns: string[] } }>;
  }>();

  (constraintRows ?? []).forEach((row) => {
    const tableName = oidToTable.get(row.conrelid);
    if (!tableName) return;
    const tableConstraints = constraintsByTable.get(tableName) ?? {
      primaryKeys: [],
      uniques: [],
      foreignKeys: []
    };
    const attMap = attributesByTable.get(row.conrelid) ?? new Map<number, string>();
    const columns = (row.conkey ?? []).map((attnum: number) => attMap.get(attnum)).filter(Boolean) as string[];

    if (row.contype === 'p') {
      tableConstraints.primaryKeys.push({ name: row.conname, columns });
    } else if (row.contype === 'u') {
      tableConstraints.uniques.push({ name: row.conname, columns });
    } else if (row.contype === 'f') {
      const refTable = oidToTable.get(row.confrelid);
      const refAttMap = attributesByTable.get(row.confrelid) ?? new Map<number, string>();
      const refColumns = (row.confkey ?? [])
        .map((attnum: number) => refAttMap.get(attnum))
        .filter(Boolean) as string[];
      tableConstraints.foreignKeys.push({
        name: row.conname,
        columns,
        references: {
          table: refTable ?? 'unknown',
          columns: refColumns
        }
      });
    }

    constraintsByTable.set(tableName, tableConstraints);
  });

  console.log(formatHeader('Constraints summary'));
  tableNames.forEach((table) => {
    console.log({
      table,
      constraints: constraintsByTable.get(table) ?? { primaryKeys: [], uniques: [], foreignKeys: [] }
    });
  });

  const { data: indexRows, error: indexError } = await supabase
    .schema('pg_catalog')
    .from('pg_indexes')
    .select('tablename,indexname,indexdef')
    .eq('schemaname', 'public')
    .in('tablename', tableNames as unknown as string[]);

  if (indexError) {
    throw new Error(`Failed to read pg_indexes: ${indexError.message}`);
  }

  console.log(formatHeader('Indexes'));
  tableNames.forEach((table) => {
    const indexes = (indexRows ?? [])
      .filter((row) => row.tablename === table)
      .map((row) => ({
        name: row.indexname,
        columns: findIndexColumns(row.indexdef)
      }));
    console.log({ table, indexes });
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
