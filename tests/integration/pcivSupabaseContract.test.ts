import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import {
  PcivArtifactV1Schema,
  PcivConstraintV1Schema,
  PcivContextViewV1Schema,
  PcivInputSourceV1Schema,
  PcivInputV1Schema,
  PcivRunV1Schema,
  PcivSourceV1Schema
} from '../../src/decision-program/pciv/v1/schemas.ts';

const tableContracts = {
  pciv_runs: {
    schema: PcivRunV1Schema,
    columnsByField: {
      id: 'id',
      scopeId: 'scope_id',
      userId: 'user_id',
      status: 'status',
      allowPartial: 'allow_partial',
      committedAt: 'committed_at',
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    }
  },
  pciv_sources: {
    schema: PcivSourceV1Schema,
    columnsByField: {
      id: 'id',
      runId: 'run_id',
      kind: 'kind',
      title: 'title',
      uri: 'uri',
      fileId: 'file_id',
      mimeType: 'mime_type',
      sizeBytes: 'size_bytes',
      parseStatus: 'parse_status',
      excerpt: 'excerpt',
      rawMeta: 'raw_meta',
      createdAt: 'created_at'
    }
  },
  pciv_inputs: {
    schema: PcivInputV1Schema,
    columnsByField: {
      id: 'id',
      runId: 'run_id',
      pointer: 'pointer',
      label: 'label',
      domain: 'domain',
      required: 'required',
      fieldType: 'field_type',
      options: 'options',
      valueKind: 'value_kind',
      valueString: 'value_string',
      valueNumber: 'value_number',
      valueBoolean: 'value_boolean',
      valueEnum: 'value_enum',
      valueJson: 'value_json',
      provenance: 'provenance',
      updatedBy: 'updated_by',
      updatedAt: 'updated_at',
      evidenceSnippet: 'evidence_snippet'
    },
    nonPersistedFields: new Set(['sourceIds'])
  },
  pciv_input_sources: {
    schema: PcivInputSourceV1Schema,
    columnsByField: {
      inputId: 'input_id',
      sourceId: 'source_id'
    }
  },
  pciv_constraints: {
    schema: PcivConstraintV1Schema,
    columnsByField: {
      id: 'id',
      runId: 'run_id',
      key: 'key',
      domain: 'domain',
      label: 'label',
      valueKind: 'value_kind',
      valueString: 'value_string',
      valueNumber: 'value_number',
      valueBoolean: 'value_boolean',
      valueEnum: 'value_enum',
      valueJson: 'value_json',
      provenance: 'provenance',
      sourceId: 'source_id',
      snippet: 'snippet',
      createdAt: 'created_at'
    }
  },
  pciv_artifacts: {
    schema: PcivArtifactV1Schema,
    columnsByField: {
      id: 'id',
      runId: 'run_id',
      type: 'type',
      title: 'title',
      payload: 'payload',
      createdAt: 'created_at'
    }
  }
} as const;

type TableName = keyof typeof tableContracts;

const tableNames = Object.keys(tableContracts) as TableName[];

const uniqueExpectations: Record<TableName, string[][]> = {
  pciv_runs: [['id']],
  pciv_sources: [['id']],
  pciv_inputs: [
    ['id'],
    ['run_id', 'pointer']
  ],
  pciv_input_sources: [['input_id', 'source_id']],
  pciv_constraints: [['id']],
  pciv_artifacts: [['id']]
};

const indexExpectations: Record<TableName, string[][]> = {
  pciv_runs: [
    ['scope_id'],
    ['scope_id', 'status']
  ],
  pciv_sources: [['run_id']],
  pciv_inputs: [
    ['run_id'],
    ['run_id', 'pointer']
  ],
  pciv_input_sources: [
    ['input_id'],
    ['input_id', 'source_id']
  ],
  pciv_constraints: [['run_id']],
  pciv_artifacts: [['run_id']]
};

const fkExpectations = [
  {
    table: 'pciv_input_sources',
    columns: ['input_id'],
    references: { table: 'pciv_inputs', columns: ['id'] }
  },
  {
    table: 'pciv_input_sources',
    columns: ['source_id'],
    references: { table: 'pciv_sources', columns: ['id'] }
  }
] as const;

const resolveSupabaseEnv = () => {
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

const applyEnvForAdapter = (env: NonNullable<ReturnType<typeof resolveSupabaseEnv>>) => {
  process.env.VITE_SUPABASE_URL = env.url;
  process.env.VITE_SUPABASE_ANON_KEY = env.preferredKey ?? '';
};

const unwrapSchema = (schema: z.ZodTypeAny) => {
  let current = schema;
  let optional = false;
  let nullable = false;

  const unwrap = (inner: z.ZodTypeAny) => {
    if (inner instanceof z.ZodOptional) {
      optional = true;
      return inner._def.innerType;
    }
    if (inner instanceof z.ZodNullable) {
      nullable = true;
      return inner._def.innerType;
    }
    if (inner instanceof z.ZodDefault) {
      optional = true;
      return inner._def.innerType;
    }
    return null;
  };

  while (true) {
    const next = unwrap(current);
    if (!next) break;
    current = next;
  }

  return { optional, nullable };
};

const getSchemaKeys = (schema: z.ZodTypeAny) => {
  const objectSchema = schema as z.ZodObject<any>;
  return Object.keys(objectSchema.shape ?? {});
};

const collectColumnExpectations = () =>
  tableNames.reduce<Record<TableName, Set<string>>>((acc, tableName) => {
    acc[tableName] = new Set(Object.values(tableContracts[tableName].columnsByField));
    return acc;
  }, {} as Record<TableName, Set<string>>);

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

const normalizeColumns = (columns: string[]) => columns.map((value) => value.toLowerCase());

const indexSatisfies = (indexColumns: string[], expectedColumns: string[]) => {
  const indexSet = new Set(normalizeColumns(indexColumns));
  return expectedColumns.every((col) => indexSet.has(col.toLowerCase()));
};

describe('PCIV v1 Supabase DB contract', () => {
  const env = resolveSupabaseEnv();

  if (!env) {
    console.warn(
      'Skipping PCIV Supabase contract tests: missing VITE_SUPABASE_URL/SUPABASE_URL or key env vars.'
    );
  } else {
    applyEnvForAdapter(env);
  }

  test('tables, columns, constraints, indexes align with adapter + schemas', async (t) => {
    if (!env) {
      t.skip('Missing Supabase env vars.');
      return;
    }

    const supabase = createClient(env.url, env.preferredKey ?? '');

    const { data: tableRows, error: tableError } = await supabase
      .schema('information_schema')
      .from('tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', tableNames as string[]);

    if (tableError) {
      throw new Error(`Failed to read information_schema.tables: ${tableError.message}`);
    }

    const existingTables = new Set((tableRows ?? []).map((row) => row.table_name));
    tableNames.forEach((tableName) => {
      assert.ok(existingTables.has(tableName), `Expected table public.${tableName} to exist.`);
    });

    const { data: columnRows, error: columnError } = await supabase
      .schema('information_schema')
      .from('columns')
      .select('table_name,column_name,data_type,is_nullable')
      .eq('table_schema', 'public')
      .in('table_name', tableNames as string[]);

    if (columnError) {
      throw new Error(`Failed to read information_schema.columns: ${columnError.message}`);
    }

    const columnsByTable = (columnRows ?? []).reduce<Record<string, typeof columnRows>>((acc, row) => {
      acc[row.table_name] = acc[row.table_name] ?? [];
      acc[row.table_name].push(row);
      return acc;
    }, {});

    const expectedColumns = collectColumnExpectations();

    tableNames.forEach((tableName) => {
      const tableColumns = columnsByTable[tableName] ?? [];
      const columnLookup = new Map(tableColumns.map((row) => [row.column_name, row]));

      expectedColumns[tableName].forEach((column) => {
        assert.ok(columnLookup.has(column), `Expected column ${tableName}.${column} to exist.`);
      });

      const schemaKeys = getSchemaKeys(tableContracts[tableName].schema);
      schemaKeys.forEach((key) => {
        if (tableContracts[tableName].nonPersistedFields?.has(key)) return;
        assert.ok(
          key in tableContracts[tableName].columnsByField,
          `Schema field ${tableName}.${key} missing db column mapping.`
        );
      });

      schemaKeys.forEach((key) => {
        if (tableContracts[tableName].nonPersistedFields?.has(key)) return;
        const columnName = tableContracts[tableName].columnsByField[key as keyof typeof tableContracts[TableName]['columnsByField']];
        if (!columnName) return;
        const column = columnLookup.get(columnName);
        if (!column) return;
        const fieldSchema = (tableContracts[tableName].schema as z.ZodObject<any>).shape[key];
        if (!fieldSchema) return;
        const { optional, nullable } = unwrapSchema(fieldSchema);
        if (!optional && !nullable) {
          assert.equal(
            column.is_nullable,
            'NO',
            `Expected ${tableName}.${columnName} to be NOT NULL (derived from schema).`
          );
        }
      });
    });

    const { data: namespaceRows, error: namespaceError } = await supabase
      .schema('pg_catalog')
      .from('pg_namespace')
      .select('oid')
      .eq('nspname', 'public')
      .single();

    if (namespaceError || !namespaceRows) {
      throw new Error(`Failed to read pg_namespace for public schema: ${namespaceError?.message ?? 'missing row'}`);
    }

    const { data: classRows, error: classError } = await supabase
      .schema('pg_catalog')
      .from('pg_class')
      .select('oid,relname,relnamespace')
      .eq('relnamespace', namespaceRows.oid)
      .in('relname', tableNames as string[]);

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

    const constraintsByTable = new Map<string, {
      primaryKeys: Array<{ name: string; columns: string[] }>;
      uniques: Array<{ name: string; columns: string[] }>;
      foreignKeys: Array<{ name: string; columns: string[]; references: { table: string; columns: string[] } }>;
    }>();

    const oidToTable = new Map<number, string>();
    tableOids.forEach((oid, name) => oidToTable.set(oid, name));

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

    tableNames.forEach((tableName) => {
      const constraints = constraintsByTable.get(tableName);
      assert.ok(constraints?.primaryKeys.length, `Expected ${tableName} to have a primary key.`);

      uniqueExpectations[tableName].forEach((expectedColumns) => {
        const matches = [
          ...(constraints?.primaryKeys ?? []),
          ...(constraints?.uniques ?? [])
        ].some((constraint) => indexSatisfies(constraint.columns, expectedColumns));
        assert.ok(
          matches,
          `Expected ${tableName} to enforce uniqueness on (${expectedColumns.join(', ')}).`
        );
      });
    });

    fkExpectations.forEach((expected) => {
      const constraints = constraintsByTable.get(expected.table);
      const match = constraints?.foreignKeys.some((fk) => {
        return (
          indexSatisfies(fk.columns, expected.columns) &&
          fk.references.table === expected.references.table &&
          indexSatisfies(fk.references.columns, expected.references.columns)
        );
      });
      assert.ok(match, `Expected FK on ${expected.table}(${expected.columns.join(', ')}) -> ${expected.references.table}`);
    });

    const { data: indexRows, error: indexError } = await supabase
      .schema('pg_catalog')
      .from('pg_indexes')
      .select('tablename,indexname,indexdef')
      .eq('schemaname', 'public')
      .in('tablename', tableNames as string[]);

    if (indexError) {
      throw new Error(`Failed to read pg_indexes: ${indexError.message}`);
    }

    const indexesByTable = (indexRows ?? []).reduce<Record<string, Array<{ name: string; columns: string[] }>>>(
      (acc, row) => {
        acc[row.tablename] = acc[row.tablename] ?? [];
        acc[row.tablename].push({ name: row.indexname, columns: findIndexColumns(row.indexdef) });
        return acc;
      },
      {}
    );

    tableNames.forEach((tableName) => {
      const indexes = indexesByTable[tableName] ?? [];
      indexExpectations[tableName].forEach((expectedColumns) => {
        const match = indexes.some((index) => indexSatisfies(index.columns, expectedColumns));
        assert.ok(
          match,
          `Expected index on ${tableName} covering (${expectedColumns.join(', ')}).`
        );
      });
    });
  });

  test('draft → commit → resolve context view roundtrip', async (t) => {
    if (!env) {
      t.skip('Missing Supabase env vars.');
      return;
    }

    const supabase = createClient(env.url, env.preferredKey ?? '');
    const scopeId = `pciv-test-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const now = new Date().toISOString();
    const sourceId = crypto.randomUUID();
    const inputId = crypto.randomUUID();
    const inputIdTwo = crypto.randomUUID();
    const constraintId = crypto.randomUUID();
    const artifactId = crypto.randomUUID();

    let runId: string | null = null;

    const loadAdapter = async () => {
      const storage = await import('../../src/decision-program/pciv/v1/storage/supabase.ts');
      const resolver = await import('../../src/decision-program/pciv/v1/resolveContextView.ts');
      const skills = await import('../../src/decision-program/skills/context/getContextView.ts');
      return {
        storage,
        resolver,
        skills
      };
    };

    try {
      const { storage, resolver, skills } = await loadAdapter();

      let run;
      try {
        run = await storage.createDraftRun(scopeId, null);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!env.serviceRoleKey && /permission|row level|rls|not allowed/i.test(message)) {
          console.warn('Skipping write suite: RLS blocked draft insert under anon key.');
          t.skip('RLS blocked write access with anon key.');
          return;
        }
        throw error;
      }

      runId = run.id;

      await storage.upsertSources(runId, [
        {
          id: sourceId,
          runId,
          kind: 'url',
          title: 'PCIV Contract Source',
          uri: 'https://example.com/pciv',
          fileId: null,
          mimeType: null,
          sizeBytes: null,
          parseStatus: 'parsed',
          excerpt: null,
          rawMeta: {},
          createdAt: now
        }
      ]);

      await storage.upsertInputs(runId, [
        {
          id: inputId,
          runId,
          pointer: '/context/site/geo/locationHint',
          label: 'Location hint',
          domain: 'site',
          required: false,
          fieldType: 'text',
          options: null,
          valueKind: 'string',
          valueString: 'Pacific Northwest',
          valueNumber: null,
          valueBoolean: null,
          valueEnum: null,
          valueJson: null,
          provenance: 'user-entered',
          updatedBy: 'user',
          updatedAt: now,
          evidenceSnippet: null
        },
        {
          id: inputIdTwo,
          runId,
          pointer: '/context/site/geo/county',
          label: 'County',
          domain: 'site',
          required: false,
          fieldType: 'text',
          options: null,
          valueKind: 'string',
          valueString: 'King County',
          valueNumber: null,
          valueBoolean: null,
          valueEnum: null,
          valueJson: null,
          provenance: 'source-backed',
          updatedBy: 'user',
          updatedAt: now,
          evidenceSnippet: null,
          sourceIds: [sourceId]
        }
      ]);

      await storage.linkInputSources(runId, [
        {
          inputId: inputIdTwo,
          sourceId
        }
      ]);

      await storage.upsertConstraints(runId, [
        {
          id: constraintId,
          runId,
          key: 'site_geozone',
          domain: 'site',
          label: 'Geo zone',
          valueKind: 'string',
          valueString: 'Zone A',
          valueNumber: null,
          valueBoolean: null,
          valueEnum: null,
          valueJson: null,
          provenance: 'source-backed',
          sourceId,
          snippet: null,
          createdAt: now
        }
      ]);

      const { error: artifactError } = await supabase
        .from('pciv_artifacts')
        .insert({
          id: artifactId,
          run_id: runId,
          type: 'summary',
          title: 'Contract artifact',
          payload: { note: 'roundtrip' },
          created_at: now
        });

      if (artifactError) {
        throw new Error(`Failed to insert artifact: ${artifactError.message}`);
      }

      await storage.commitRun(runId, false);

      const planningView = await resolver.resolveContextView({ scopeId, userId: null, prefer: 'latest_commit' });
      const skillsView = await skills.getContextViewForSkill({ scopeId, userId: null });

      PcivContextViewV1Schema.parse(planningView);

      assert.deepEqual(
        planningView.inputsByPointer['/context/site/geo/locationHint'],
        skillsView.inputsByPointer['/context/site/geo/locationHint'],
        'Planning and Skills should resolve identical input pointer values.'
      );

      assert.equal(
        planningView.constraints.length,
        skillsView.constraints.length,
        'Planning and Skills should resolve identical constraints counts.'
      );

      assert.equal(
        Object.keys(planningView.sourcesById).length,
        Object.keys(skillsView.sourcesById).length,
        'Planning and Skills should resolve identical sources counts.'
      );
    } finally {
      if (!runId) return;
      const cleanup = async (table: string, filter: (builder: any) => any) => {
        const { error } = await filter(supabase.from(table).delete());
        if (error) {
          throw new Error(`Cleanup failed for ${table}: ${error.message}`);
        }
      };

      await cleanup('pciv_input_sources', (query) => query.in('input_id', [inputId, inputIdTwo]));
      await cleanup('pciv_inputs', (query) => query.eq('run_id', runId));
      await cleanup('pciv_sources', (query) => query.eq('run_id', runId));
      await cleanup('pciv_constraints', (query) => query.eq('run_id', runId));
      await cleanup('pciv_artifacts', (query) => query.eq('run_id', runId));
      await cleanup('pciv_runs', (query) => query.eq('id', runId));
    }
  });
});
