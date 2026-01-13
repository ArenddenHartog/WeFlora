import { z } from 'zod';
import { supabase } from '../../../../../services/supabaseClient.ts';
import {
  PcivArtifactV1Schema,
  PcivConstraintV1Schema,
  PcivContextViewV1Schema,
  PcivInputSourceV1Schema,
  PcivInputV1Schema,
  PcivRunV1Schema,
  PcivSourceV1Schema,
  type PcivArtifactV1,
  type PcivConstraintV1,
  type PcivContextViewV1,
  type PcivInputSourceV1,
  type PcivInputV1,
  type PcivRunV1,
  type PcivSourceV1
} from '../schemas.ts';

const parseSchema = <T>(schema: z.ZodType<T>, data: unknown, label: string): T => {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new Error(`${label} validation failed: ${result.error.message}`);
  }
  return result.data;
};

const mapRunRow = (row: any): PcivRunV1 =>
  parseSchema(
    PcivRunV1Schema,
    {
      id: row.id,
      scopeId: row.scope_id,
      userId: row.user_id,
      status: row.status,
      allowPartial: row.allow_partial,
      committedAt: row.committed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    },
    'PcivRunV1'
  );

const mapSourceRow = (row: any): PcivSourceV1 =>
  parseSchema(
    PcivSourceV1Schema,
    {
      id: row.id,
      runId: row.run_id,
      kind: row.kind,
      title: row.title,
      uri: row.uri,
      fileId: row.file_id,
      mimeType: row.mime_type,
      sizeBytes: row.size_bytes,
      parseStatus: row.parse_status,
      excerpt: row.excerpt,
      rawMeta: row.raw_meta ?? {},
      createdAt: row.created_at
    },
    'PcivSourceV1'
  );

const mapInputRow = (row: any, sourceIds: string[] = []): PcivInputV1 =>
  parseSchema(
    PcivInputV1Schema,
    {
      id: row.id,
      runId: row.run_id,
      pointer: row.pointer,
      label: row.label,
      domain: row.domain,
      required: row.required,
      fieldType: row.field_type,
      options: row.options,
      valueKind: row.value_kind,
      valueString: row.value_string,
      valueNumber: row.value_number,
      valueBoolean: row.value_boolean,
      valueEnum: row.value_enum,
      valueJson: row.value_json,
      provenance: row.provenance,
      updatedBy: row.updated_by,
      updatedAt: row.updated_at,
      evidenceSnippet: row.evidence_snippet,
      sourceIds
    },
    'PcivInputV1'
  );

const mapConstraintRow = (row: any): PcivConstraintV1 =>
  parseSchema(
    PcivConstraintV1Schema,
    {
      id: row.id,
      runId: row.run_id,
      key: row.key,
      domain: row.domain,
      label: row.label,
      valueKind: row.value_kind,
      valueString: row.value_string,
      valueNumber: row.value_number,
      valueBoolean: row.value_boolean,
      valueEnum: row.value_enum,
      valueJson: row.value_json,
      provenance: row.provenance,
      sourceId: row.source_id,
      snippet: row.snippet,
      createdAt: row.created_at
    },
    'PcivConstraintV1'
  );

const mapArtifactRow = (row: any): PcivArtifactV1 =>
  parseSchema(
    PcivArtifactV1Schema,
    {
      id: row.id,
      runId: row.run_id,
      type: row.type,
      title: row.title,
      payload: row.payload ?? {},
      createdAt: row.created_at
    },
    'PcivArtifactV1'
  );

const ensureRunMatch = (runId: string, records: { runId?: string }[], label: string) => {
  records.forEach((record) => {
    if (record.runId && record.runId !== runId) {
      throw new Error(`${label} runId mismatch: expected ${runId}, got ${record.runId}`);
    }
  });
};

export const fetchLatestCommittedRun = async (scopeId: string, userId?: string | null): Promise<PcivRunV1 | null> => {
  let query = supabase
    .from('pciv_runs')
    .select('*')
    .eq('scope_id', scopeId)
    .in('status', ['committed', 'partial_committed'])
    .order('committed_at', { ascending: false, nullsFirst: false })
    .limit(1);

  if (userId !== undefined) {
    query = userId === null ? query.is('user_id', null) : query.eq('user_id', userId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch latest committed run: ${error.message}`);
  }

  if (!data || data.length === 0) return null;

  return mapRunRow(data[0]);
};

export const listRunsForScope = async (scopeId: string, userId?: string | null): Promise<PcivRunV1[]> => {
  let query = supabase
    .from('pciv_runs')
    .select('*')
    .eq('scope_id', scopeId);

  if (userId !== undefined) {
    query = userId === null ? query.is('user_id', null) : query.eq('user_id', userId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to list runs for scope ${scopeId}: ${error.message}`);
  }

  return (data ?? []).map(mapRunRow);
};

export const fetchRunById = async (runId: string): Promise<PcivRunV1> => {
  const { data, error } = await supabase
    .from('pciv_runs')
    .select('*')
    .eq('id', runId)
    .single();

  if (error || !data) {
    throw new Error(`Failed to fetch run ${runId}: ${error?.message ?? 'missing run'}`);
  }

  return mapRunRow(data);
};

export const fetchContextViewByRunId = async (runId: string): Promise<PcivContextViewV1> => {
  const { data: runRow, error: runError } = await supabase
    .from('pciv_runs')
    .select('*')
    .eq('id', runId)
    .single();

  if (runError || !runRow) {
    throw new Error(`Failed to fetch run ${runId}: ${runError?.message ?? 'missing run'}`);
  }

  const { data: sourcesRows, error: sourcesError } = await supabase
    .from('pciv_sources')
    .select('*')
    .eq('run_id', runId);

  if (sourcesError) {
    throw new Error(`Failed to fetch sources for run ${runId}: ${sourcesError.message}`);
  }

  const { data: inputsRows, error: inputsError } = await supabase
    .from('pciv_inputs')
    .select('*')
    .eq('run_id', runId);

  if (inputsError) {
    throw new Error(`Failed to fetch inputs for run ${runId}: ${inputsError.message}`);
  }

  const inputIds = (inputsRows ?? []).map((row: any) => row.id);
  const sourceIdsByInput = new Map<string, string[]>();

  if (inputIds.length > 0) {
    const { data: linkRows, error: linkError } = await supabase
      .from('pciv_input_sources')
      .select('input_id, source_id')
      .in('input_id', inputIds);

    if (linkError) {
      throw new Error(`Failed to fetch input sources for run ${runId}: ${linkError.message}`);
    }

    (linkRows ?? []).forEach((row: any) => {
      const list = sourceIdsByInput.get(row.input_id) ?? [];
      list.push(row.source_id);
      sourceIdsByInput.set(row.input_id, list);
    });
  }

  const { data: constraintsRows, error: constraintsError } = await supabase
    .from('pciv_constraints')
    .select('*')
    .eq('run_id', runId);

  if (constraintsError) {
    throw new Error(`Failed to fetch constraints for run ${runId}: ${constraintsError.message}`);
  }

  const { data: artifactsRows, error: artifactsError } = await supabase
    .from('pciv_artifacts')
    .select('*')
    .eq('run_id', runId);

  if (artifactsError) {
    throw new Error(`Failed to fetch artifacts for run ${runId}: ${artifactsError.message}`);
  }

  const run = mapRunRow(runRow);
  const sources = (sourcesRows ?? []).map(mapSourceRow);
  const inputs = (inputsRows ?? []).map((row: any) => mapInputRow(row, sourceIdsByInput.get(row.id) ?? []));
  const constraints = (constraintsRows ?? []).map(mapConstraintRow);
  const artifacts = (artifactsRows ?? []).map(mapArtifactRow);

  const sourcesById = sources.reduce<Record<string, PcivSourceV1>>((acc, source) => {
    acc[source.id] = source;
    return acc;
  }, {});

  const inputsByPointer = inputs.reduce<Record<string, PcivInputV1>>((acc, input) => {
    acc[input.pointer] = input;
    return acc;
  }, {});

  const artifactsByType = artifacts.reduce<Record<string, PcivArtifactV1[]>>((acc, artifact) => {
    acc[artifact.type] = acc[artifact.type] ?? [];
    acc[artifact.type].push(artifact);
    return acc;
  }, {});

  return parseSchema(
    PcivContextViewV1Schema,
    {
      run,
      sourcesById,
      inputsByPointer,
      constraints,
      artifactsByType
    },
    'PcivContextViewV1'
  );
};

export const fetchLatestCommittedContextView = async (
  scopeId: string,
  userId?: string | null
): Promise<PcivContextViewV1 | null> => {
  const run = await fetchLatestCommittedRun(scopeId, userId);
  if (!run) return null;
  return fetchContextViewByRunId(run.id);
};

export const createDraftRun = async (scopeId: string, userId?: string | null): Promise<PcivRunV1> => {
  const payload = {
    scope_id: scopeId,
    user_id: userId ?? null,
    status: 'draft',
    allow_partial: false,
    committed_at: null
  };

  const { data, error } = await supabase
    .from('pciv_runs')
    .insert(payload)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(`Failed to create draft run: ${error?.message ?? 'missing row'}`);
  }

  return mapRunRow(data);
};

export const updateDraftRun = async (runId: string): Promise<PcivRunV1> => {
  const timestamp = new Date().toISOString();
  const { data, error } = await supabase
    .from('pciv_runs')
    .update({
      status: 'draft',
      updated_at: timestamp
    })
    .eq('id', runId)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(`Failed to update draft run ${runId}: ${error?.message ?? 'missing row'}`);
  }

  return mapRunRow(data);
};

export const upsertInputs = async (runId: string, inputs: PcivInputV1[]): Promise<void> => {
  const parsed = inputs.map((input, index) =>
    parseSchema(PcivInputV1Schema, input, `PcivInputV1[${index}]`)
  );
  ensureRunMatch(runId, parsed, 'PcivInputV1');

  const payload = parsed.map((input) => ({
    id: input.id,
    run_id: runId,
    pointer: input.pointer,
    label: input.label,
    domain: input.domain,
    required: input.required,
    field_type: input.fieldType,
    options: input.options ?? null,
    value_kind: input.valueKind,
    value_string: input.valueString ?? null,
    value_number: input.valueNumber ?? null,
    value_boolean: input.valueBoolean ?? null,
    value_enum: input.valueEnum ?? null,
    value_json: input.valueJson ?? null,
    provenance: input.provenance,
    updated_by: input.updatedBy,
    updated_at: input.updatedAt,
    evidence_snippet: input.evidenceSnippet ?? null
  }));

  const { error } = await supabase
    .from('pciv_inputs')
    .upsert(payload, { onConflict: 'run_id,pointer' });

  if (error) {
    throw new Error(`Failed to upsert inputs: ${error.message}`);
  }
};

export const upsertConstraints = async (runId: string, constraints: PcivConstraintV1[]): Promise<void> => {
  const parsed = constraints.map((constraint, index) =>
    parseSchema(PcivConstraintV1Schema, constraint, `PcivConstraintV1[${index}]`)
  );
  ensureRunMatch(runId, parsed, 'PcivConstraintV1');

  const payload = parsed.map((constraint) => ({
    id: constraint.id,
    run_id: runId,
    key: constraint.key,
    domain: constraint.domain,
    label: constraint.label,
    value_kind: constraint.valueKind,
    value_string: constraint.valueString ?? null,
    value_number: constraint.valueNumber ?? null,
    value_boolean: constraint.valueBoolean ?? null,
    value_enum: constraint.valueEnum ?? null,
    value_json: constraint.valueJson ?? null,
    provenance: constraint.provenance,
    source_id: constraint.sourceId ?? null,
    snippet: constraint.snippet ?? null,
    created_at: constraint.createdAt
  }));

  const { error } = await supabase.from('pciv_constraints').upsert(payload, { onConflict: 'id' });

  if (error) {
    throw new Error(`Failed to upsert constraints: ${error.message}`);
  }
};

export const upsertSources = async (runId: string, sources: PcivSourceV1[]): Promise<void> => {
  const parsed = sources.map((source, index) =>
    parseSchema(PcivSourceV1Schema, source, `PcivSourceV1[${index}]`)
  );
  ensureRunMatch(runId, parsed, 'PcivSourceV1');

  const payload = parsed.map((source) => ({
    id: source.id,
    run_id: runId,
    kind: source.kind,
    title: source.title,
    uri: source.uri,
    file_id: source.fileId ?? null,
    mime_type: source.mimeType ?? null,
    size_bytes: source.sizeBytes ?? null,
    parse_status: source.parseStatus,
    excerpt: source.excerpt ?? null,
    raw_meta: source.rawMeta ?? {},
    created_at: source.createdAt
  }));

  const { error } = await supabase.from('pciv_sources').upsert(payload, { onConflict: 'id' });

  if (error) {
    throw new Error(`Failed to upsert sources: ${error.message}`);
  }
};

export const linkInputSources = async (runId: string, links: PcivInputSourceV1[]): Promise<void> => {
  const parsed = links.map((link, index) =>
    parseSchema(PcivInputSourceV1Schema, link, `PcivInputSourceV1[${index}]`)
  );

  const payload = parsed.map((link) => ({
    input_id: link.inputId,
    source_id: link.sourceId
  }));

  if (payload.length === 0) return;

  const { error } = await supabase
    .from('pciv_input_sources')
    .upsert(payload, { onConflict: 'input_id,source_id' });

  if (error) {
    throw new Error(`Failed to link input sources for run ${runId}: ${error.message}`);
  }
};

export const commitRun = async (runId: string, allowPartial: boolean): Promise<PcivRunV1> => {
  const status = allowPartial ? 'partial_committed' : 'committed';
  const timestamp = new Date().toISOString();

  const { data, error } = await supabase
    .from('pciv_runs')
    .update({
      status,
      allow_partial: allowPartial,
      committed_at: timestamp,
      updated_at: timestamp
    })
    .eq('id', runId)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(`Failed to commit run ${runId}: ${error?.message ?? 'missing row'}`);
  }

  return mapRunRow(data);
};
