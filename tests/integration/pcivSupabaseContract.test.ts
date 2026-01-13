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

const requiredColumnGroups: Record<TableName, string[][]> = {
  pciv_runs: [
    ['id'],
    ['scope_id'],
    ['status'],
    ['created_at'],
    ['updated_at'],
    ['committed_at'],
    ['allow_partial'],
    ['user_id'],
    ['run_id', 'id']
  ],
  pciv_sources: [
    ['id'],
    ['run_id'],
    ['type', 'kind'],
    ['name', 'title'],
    ['mime_type'],
    ['size_bytes'],
    ['status', 'parse_status'],
    ['created_at']
  ],
  pciv_inputs: [
    ['id'],
    ['run_id'],
    ['pointer'],
    ['label'],
    ['domain'],
    ['required'],
    ['type', 'field_type'],
    ['options'],
    ['value_json'],
    ['provenance'],
    ['created_at', 'updated_at']
  ],
  pciv_input_sources: [['input_id'], ['source_id'], ['snippet'], ['created_at']],
  pciv_constraints: [
    ['id'],
    ['run_id'],
    ['key'],
    ['domain'],
    ['label'],
    ['value_json'],
    ['provenance'],
    ['source_id'],
    ['snippet'],
    ['created_at']
  ],
  pciv_artifacts: [
    ['id'],
    ['run_id'],
    ['type'],
    ['payload_json', 'payload'],
    ['created_at']
  ]
};

const fkExpectations = [
  {
    table: 'pciv_sources',
    columns: ['run_id'],
    references: { table: 'pciv_runs', columns: ['id'] }
  },
  {
    table: 'pciv_inputs',
    columns: ['run_id'],
    references: { table: 'pciv_runs', columns: ['id'] }
  },
  {
    table: 'pciv_input_sources',
    columns: ['input_id'],
    references: { table: 'pciv_inputs', columns: ['id'] }
  },
  {
    table: 'pciv_input_sources',
    columns: ['source_id'],
    references: { table: 'pciv_sources', columns: ['id'] }
  },
  {
    table: 'pciv_constraints',
    columns: ['run_id'],
    references: { table: 'pciv_runs', columns: ['id'] }
  },
  {
    table: 'pciv_artifacts',
    columns: ['run_id'],
    references: { table: 'pciv_runs', columns: ['id'] }
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

const parseColumnList = (value: string) =>
  value
    .split(',')
    .map((column) => column.trim())
    .map((column) => column.replace(/"/g, ''))
    .map((column) => column.split(' ')[0])
    .filter(Boolean);

const extractColumnsFromDefinition = (definition: string) => {
  const match = definition.match(/\(([^)]+)\)/);
  if (!match) return [];
  return parseColumnList(match[1]);
};

const normalizeReferenceTable = (value: string) => value.replace(/"/g, '').split('.').pop() ?? value;

const extractForeignKeyDefinition = (definition: string) => {
  const match = definition.match(
    /foreign key\s*\(([^)]+)\)\s*references\s+([^\s(]+)\s*\(([^)]+)\)/i
  );
  if (!match) return null;
  return {
    columns: parseColumnList(match[1]),
    references: {
      table: normalizeReferenceTable(match[2]),
      columns: parseColumnList(match[3])
    }
  };
};

const indexSatisfies = (indexColumns: string[], expectedColumns: string[]) => {
  const indexSet = new Set(normalizeColumns(indexColumns));
  return expectedColumns.every((col) => indexSet.has(col.toLowerCase()));
};

const indexDefinitionHasColumns = (definition: string, expectedColumns: string[]) =>
  indexSatisfies(findIndexColumns(definition), expectedColumns);

const hasForeignKeyDefinition = (
  constraints: Array<{ definition: string }>,
  column: string,
  referenceTable: string,
  referenceColumn: string
) => {
  const pattern = new RegExp(
    `foreign key\\s*\\(${column}\\)\\s*references\\s+["\\w\\.]*${referenceTable}["\\w\\.]*\\s*\\(${referenceColumn}\\)`,
    'i'
  );
  return constraints.some((constraint) => pattern.test(constraint.definition ?? ''));
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

    const { data: introspectData, error: introspectError } = await supabase.rpc('pciv_introspect');

    if (introspectError || !introspectData) {
      throw new Error(
        `pciv_introspect RPC failed: ${introspectError?.message ?? 'no data returned'}. ` +
          'Ensure the function exists in public schema and grants execute to anon/authenticated.'
      );
    }

    const tables = (introspectData as { tables?: Record<string, any> }).tables ?? {};

    tableNames.forEach((tableName) => {
      assert.ok(tables[tableName]?.exists, `Expected table public.${tableName} to exist.`);
    });

    const columnsByTable = tableNames.reduce<Record<string, Array<any>>>((acc, tableName) => {
      acc[tableName] = tables[tableName]?.columns ?? [];
      return acc;
    }, {} as Record<string, Array<any>>);

    const expectedColumns = collectColumnExpectations();

    tableNames.forEach((tableName) => {
      const tableColumns = columnsByTable[tableName] ?? [];
      const columnLookup = new Map(tableColumns.map((row) => [row.name, row]));

      requiredColumnGroups[tableName].forEach((group) => {
        const hasColumn = group.some((column) => columnLookup.has(column));
        assert.ok(
          hasColumn,
          `Expected ${tableName} to include one of: ${group.join(' or ')}.`
        );
      });

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

    const runColumns = columnsByTable.pciv_runs ?? [];
    const runColumnLookup = new Map(runColumns.map((row) => [row.name, row]));
    assert.ok(runColumnLookup.has('id'), 'Expected pciv_runs.id column to exist.');
    assert.ok(runColumnLookup.has('scope_id'), 'Expected pciv_runs.scope_id column to exist.');
    assert.equal(
      runColumnLookup.get('id')?.is_nullable,
      'NO',
      'Expected pciv_runs.id to be NOT NULL.'
    );
    assert.equal(
      runColumnLookup.get('scope_id')?.is_nullable,
      'NO',
      'Expected pciv_runs.scope_id to be NOT NULL.'
    );

    const childTables: Array<'pciv_sources' | 'pciv_inputs' | 'pciv_constraints' | 'pciv_artifacts'> = [
      'pciv_sources',
      'pciv_inputs',
      'pciv_constraints',
      'pciv_artifacts'
    ];
    childTables.forEach((tableName) => {
      const tableColumns = columnsByTable[tableName] ?? [];
      const columnLookup = new Map(tableColumns.map((row) => [row.name, row]));
      assert.ok(columnLookup.has('run_id'), `Expected ${tableName}.run_id column to exist.`);
      assert.equal(
        columnLookup.get('run_id')?.is_nullable,
        'NO',
        `Expected ${tableName}.run_id to be NOT NULL.`
      );
    });

    const joinColumns = columnsByTable.pciv_input_sources ?? [];
    const joinColumnLookup = new Map(joinColumns.map((row) => [row.name, row]));
    assert.ok(joinColumnLookup.has('input_id'), 'Expected pciv_input_sources.input_id column to exist.');
    assert.ok(joinColumnLookup.has('source_id'), 'Expected pciv_input_sources.source_id column to exist.');
    assert.equal(
      joinColumnLookup.get('input_id')?.is_nullable,
      'NO',
      'Expected pciv_input_sources.input_id to be NOT NULL.'
    );
    assert.equal(
      joinColumnLookup.get('source_id')?.is_nullable,
      'NO',
      'Expected pciv_input_sources.source_id to be NOT NULL.'
    );

    const constraintsByTable = new Map<string, {
      primaryKeys: Array<{ name: string; columns: string[] }>;
      uniques: Array<{ name: string; columns: string[] }>;
      foreignKeys: Array<{ name: string; columns: string[]; references: { table: string; columns: string[] } }>;
    }>();
    tableNames.forEach((tableName) => {
      const tableConstraints = constraintsByTable.get(tableName) ?? {
        primaryKeys: [],
        uniques: [],
        foreignKeys: []
      };
      const constraints = tables[tableName]?.constraints ?? [];

      constraints.forEach((constraint: { name: string; type: string; definition: string }) => {
        const definition = constraint.definition ?? '';
        if (constraint.type === 'p') {
          tableConstraints.primaryKeys.push({
            name: constraint.name,
            columns: extractColumnsFromDefinition(definition)
          });
        } else if (constraint.type === 'u') {
          tableConstraints.uniques.push({
            name: constraint.name,
            columns: extractColumnsFromDefinition(definition)
          });
        } else if (constraint.type === 'f') {
          const foreignKey = extractForeignKeyDefinition(definition);
          if (foreignKey) {
            tableConstraints.foreignKeys.push({
              name: constraint.name,
              columns: foreignKey.columns,
              references: foreignKey.references
            });
          }
        }
      });

      constraintsByTable.set(tableName, tableConstraints);
    });

    const runIdForeignKeyPattern = (tableName: TableName) => {
      const constraints = tables[tableName]?.constraints ?? [];
      return hasForeignKeyDefinition(constraints, 'run_id', 'pciv_runs', 'id');
    };

    ['pciv_sources', 'pciv_inputs', 'pciv_constraints', 'pciv_artifacts'].forEach((tableName) => {
      const hasFk = runIdForeignKeyPattern(tableName as TableName);
      assert.ok(
        hasFk,
        `Expected FK on ${tableName}(run_id) REFERENCES pciv_runs(id).`
      );
    });

    const joinConstraints = tables.pciv_input_sources?.constraints ?? [];
    const hasJoinPk = joinConstraints.some(
      (constraint: { name: string; type: string }) =>
        constraint.type === 'p' && constraint.name === 'pciv_input_sources_pkey'
    );
    assert.ok(hasJoinPk, 'Expected pciv_input_sources to have primary key pciv_input_sources_pkey.');
    const joinConstraintSummary = constraintsByTable.get('pciv_input_sources');
    const hasJoinPkColumns = joinConstraintSummary?.primaryKeys.some((constraint) =>
      indexSatisfies(constraint.columns, ['input_id', 'source_id'])
    );
    assert.ok(
      hasJoinPkColumns,
      'Expected pciv_input_sources primary key on (input_id, source_id).'
    );
    assert.ok(
      hasForeignKeyDefinition(joinConstraints, 'input_id', 'pciv_inputs', 'id'),
      'Expected FK on pciv_input_sources(input_id) REFERENCES pciv_inputs(id).'
    );
    assert.ok(
      hasForeignKeyDefinition(joinConstraints, 'source_id', 'pciv_sources', 'id'),
      'Expected FK on pciv_input_sources(source_id) REFERENCES pciv_sources(id).'
    );

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

    const indexesByTable = tableNames.reduce<Record<string, Array<{ name: string; definition: string }>>>(
      (acc, tableName) => {
        const indexes = tables[tableName]?.indexes ?? [];
        acc[tableName] = indexes.map((index: { name: string; definition: string }) => ({
          name: index.name,
          definition: index.definition
        }));
        return acc;
      },
      {}
    );

    const runIndexes = indexesByTable.pciv_runs ?? [];
    const hasRunIndex = runIndexes.some(
      (index) => index.name === 'pciv_runs_scope_id_idx' || indexDefinitionHasColumns(index.definition, ['scope_id'])
    );
    assert.ok(hasRunIndex, 'Expected pciv_runs index named pciv_runs_scope_id_idx or covering (scope_id).');

    const childTablesForIndexes: Array<'pciv_sources' | 'pciv_inputs' | 'pciv_constraints' | 'pciv_artifacts'> = [
      'pciv_sources',
      'pciv_inputs',
      'pciv_constraints',
      'pciv_artifacts'
    ];
    childTablesForIndexes.forEach((tableName) => {
      const indexes = indexesByTable[tableName] ?? [];
      const hasRunIdIndex = indexes.some((index) => indexDefinitionHasColumns(index.definition, ['run_id']));
      assert.ok(hasRunIdIndex, `Expected ${tableName} index covering (run_id).`);
    });

    const inputIndexes = indexesByTable.pciv_inputs ?? [];
    const hasInputIndex = inputIndexes.some((index) => indexDefinitionHasColumns(index.definition, ['run_id', 'pointer']));
    assert.ok(hasInputIndex, 'Expected pciv_inputs index covering (run_id, pointer).');
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
