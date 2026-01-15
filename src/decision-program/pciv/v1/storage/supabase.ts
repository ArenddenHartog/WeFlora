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
  PcivScopeMemberV1Schema,
  type PcivArtifactV1,
  type PcivConstraintV1,
  type PcivContextViewV1,
  type PcivInputSourceV1,
  type PcivInputV1,
  type PcivRunV1,
  type PcivSourceV1,
  type PcivScopeMemberV1,
  type PcivScopeMemberRole
} from '../schemas.ts';
import { PcivRlsDeniedError, PcivAuthRequiredError } from './rls-errors.ts';
import { invariantPCIVValueColumnsMatchKind } from '../runtimeInvariants.ts';

// ============================================================================
// Auth & RLS Helpers
// ============================================================================

/**
 * Get the current authenticated user ID from Supabase session.
 * Returns null if no user is authenticated.
 */
const getCurrentUserId = async (): Promise<string | null> => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
};

/**
 * Handle Supabase errors with RLS/auth classification.
 * Throws PcivAuthRequiredError for 401/PGRST301 (missing/invalid auth).
 * Throws PcivRlsDeniedError for 403/42501 (RLS policy denial).
 * Rethrows other errors unchanged.
 */
const handleSupabaseError = (error: any, operation: string): never => {
  // Check HTTP status and PostgREST error codes
  const isAuthError = error?.status === 401 || error?.code === 'PGRST301';
  const isRlsError = error?.status === 403 || error?.code === '42501';

  if (isAuthError) {
    throw new PcivAuthRequiredError(
      `Authentication required for ${operation}: ${error.message}`,
      error
    );
  }

  if (isRlsError) {
    throw new PcivRlsDeniedError(
      `Access denied by RLS policy for ${operation}: ${error.message}`,
      error
    );
  }

  // Unknown error - rethrow as-is
  throw new Error(`${operation} failed: ${error.message}`);
};

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

const mapMembershipRow = (row: any): PcivScopeMemberV1 =>
  parseSchema(
    PcivScopeMemberV1Schema,
    {
      scopeId: row.scope_id,
      userId: row.user_id,
      role: row.role,
      createdAt: row.created_at,
      createdBy: row.created_by
    },
    'PcivScopeMemberV1'
  );

// ============================================================================
// Scope Membership Helpers (v1.4)
// ============================================================================

/**
 * List all members of a scope.
 * Requires viewer role or higher for the scope.
 */
export const listScopeMembers = async (scopeId: string): Promise<PcivScopeMemberV1[]> => {
  try {
    const { data, error } = await supabase
      .from('pciv_scope_members')
      .select('*')
      .eq('scope_id', scopeId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return (data ?? []).map(mapMembershipRow);
  } catch (error: any) {
    handleSupabaseError(error, 'listScopeMembers');
  }
};

/**
 * Add or update a scope member.
 * Requires owner role for the scope.
 */
export const upsertScopeMember = async (
  scopeId: string,
  userId: string,
  role: PcivScopeMemberRole
): Promise<PcivScopeMemberV1> => {
  const currentUserId = await getCurrentUserId();
  
  try {
    const { data, error } = await supabase
      .from('pciv_scope_members')
      .upsert({
        scope_id: scopeId,
        user_id: userId,
        role,
        created_by: currentUserId
      }, { onConflict: 'scope_id,user_id' })
      .select('*')
      .single();

    if (error) throw error;
    if (!data) throw new Error('missing row');

    return mapMembershipRow(data);
  } catch (error: any) {
    handleSupabaseError(error, 'upsertScopeMember');
  }
};

/**
 * Remove a scope member.
 * Requires owner role for the scope.
 * Protected by last-owner trigger (cannot remove last owner).
 */
export const removeScopeMember = async (scopeId: string, userId: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('pciv_scope_members')
      .delete()
      .eq('scope_id', scopeId)
      .eq('user_id', userId);

    if (error) throw error;
  } catch (error: any) {
    handleSupabaseError(error, 'removeScopeMember');
  }
};

// ============================================================================
// Run Queries
// ============================================================================

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
  // UUID guard: prevent email strings from being used as userId
  if (userId !== undefined && userId !== null) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      throw new Error(
        `pciv_invalid_user_id_expected_uuid: userId must be a valid UUID, got: ${userId.substring(0, 50)}`
      );
    }
  }

  // Dev-only breadcrumb for debugging userId usage
  if (import.meta.env.DEV && userId !== undefined) {
    console.warn('[PCIV] listRunsForScope called with userId filter:', { scopeId, userId });
  }

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

export interface CreateRunOptions {
  ownership?: 'owned' | 'shared';
}

export const createDraftRun = async (
  scopeId: string,
  options: CreateRunOptions = {}
): Promise<PcivRunV1> => {
  const { ownership = 'owned' } = options;

  // For owned scopes, try bootstrap RPC first
  if (ownership === 'owned') {
    try {
      const { data, error } = await supabase.rpc('pciv_bootstrap_scope', {
        p_scope_id: scopeId,
        p_create_draft_run: true
      });

      if (error) {
        // If scope already initialized, fall through to normal insert
        if (error.message?.includes('pciv_scope_already_initialized') || 
            error.code === '23505') {
          // Continue to normal insert below
        } else {
          throw error;
        }
      } else if (data && data.length > 0 && data[0].run_id) {
        // Bootstrap succeeded, fetch and return the created run
        return await fetchRunById(data[0].run_id);
      }
    } catch (error: any) {
      // Only rethrow auth/RLS errors; scope already initialized is expected
      if (error instanceof PcivAuthRequiredError || error instanceof PcivRlsDeniedError) {
        throw error;
      }
      // For pciv_scope_already_initialized, fall through to normal insert
    }
  }

  // Fallback: normal insert (for shared or if bootstrap already happened)
  const userId = ownership === 'owned' ? await getCurrentUserId() : null;

  const payload = {
    scope_id: scopeId,
    user_id: userId,
    status: 'draft',
    allow_partial: false,
    committed_at: null
  };

  try {
    const { data, error } = await supabase
      .from('pciv_runs')
      .insert(payload)
      .select('*')
      .single();

    if (error) throw error;
    if (!data) throw new Error('missing row');

    return mapRunRow(data);
  } catch (error: any) {
    handleSupabaseError(error, 'createDraftRun');
  }
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

  // Runtime invariant check for each input
  for (const input of parsed) {
    invariantPCIVValueColumnsMatchKind({
      value_kind: input.valueKind,
      value_string: input.valueString ?? null,
      value_number: input.valueNumber ?? null,
      value_boolean: input.valueBoolean ?? null,
      value_enum: input.valueEnum ?? null,
      value_json: input.valueJson ?? null,
      runId,
      pointer: input.pointer
    });
  }

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

  try {
    const { error } = await supabase
      .from('pciv_inputs')
      .upsert(payload, { onConflict: 'run_id,pointer' });
    if (error) throw error;
  } catch (error: any) {
    handleSupabaseError(error, 'upsertInputs');
  }
};

export const upsertConstraints = async (runId: string, constraints: PcivConstraintV1[]): Promise<void> => {
  const parsed = constraints.map((constraint, index) =>
    parseSchema(PcivConstraintV1Schema, constraint, `PcivConstraintV1[${index}]`)
  );
  ensureRunMatch(runId, parsed, 'PcivConstraintV1');

  // Runtime invariant check for each constraint
  for (const constraint of parsed) {
    invariantPCIVValueColumnsMatchKind({
      value_kind: constraint.valueKind,
      value_string: constraint.valueString ?? null,
      value_number: constraint.valueNumber ?? null,
      value_boolean: constraint.valueBoolean ?? null,
      value_enum: constraint.valueEnum ?? null,
      value_json: constraint.valueJson ?? null,
      runId,
      pointer: constraint.key
    });
  }

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

  try {
    const { error } = await supabase.from('pciv_constraints').upsert(payload, { onConflict: 'id' });
    if (error) throw error;
  } catch (error: any) {
    handleSupabaseError(error, 'upsertConstraints');
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

  try {
    const { error } = await supabase.from('pciv_sources').upsert(payload, { onConflict: 'id' });
    if (error) throw error;
  } catch (error: any) {
    handleSupabaseError(error, 'upsertSources');
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

  try {
    const { error } = await supabase
      .from('pciv_input_sources')
      .upsert(payload, { onConflict: 'input_id,source_id' });
    if (error) throw error;
  } catch (error: any) {
    handleSupabaseError(error, 'linkInputSources');
  }
};

export const upsertArtifacts = async (artifacts: PcivArtifactV1[]): Promise<void> => {
  if (artifacts.length === 0) return;

  const parsed = artifacts.map((artifact, index) =>
    parseSchema(PcivArtifactV1Schema, artifact, `PcivArtifactV1[${index}]`)
  );

  const payload = parsed.map((artifact) => ({
    id: artifact.id,
    run_id: artifact.runId,
    type: artifact.type,
    title: artifact.title,
    payload: artifact.payload,
    created_at: artifact.createdAt
  }));

  try {
    const { error } = await supabase.from('pciv_artifacts').upsert(payload, { onConflict: 'id' });
    if (error) throw error;
  } catch (error: any) {
    handleSupabaseError(error, 'upsertArtifacts');
  }
};

export const commitRun = async (runId: string, allowPartial: boolean): Promise<PcivRunV1> => {
  const status = allowPartial ? 'partial_committed' : 'committed';
  const timestamp = new Date().toISOString();

  try {
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

    if (error) throw error;
    if (!data) throw new Error('missing row');

    return mapRunRow(data);
  } catch (error: any) {
    handleSupabaseError(error, 'commitRun');
  }
};

export const deleteRun = async (runId: string): Promise<void> => {
  try {
    const { error } = await supabase.from('pciv_runs').delete().eq('id', runId);
    if (error) throw error;
  } catch (error: any) {
    handleSupabaseError(error, 'deleteRun');
  }
};

// ============================================================================
// TEST-ONLY HELPERS (for provoking DB constraint failures in tests)
// ============================================================================

/**
 * TEST-ONLY: Write a raw input row with potentially invalid data.
 * This bypasses adapter validation to test DB-level constraints.
 * Only available when NODE_ENV === 'test'.
 */
export const __pcivTestWriteRawInputRowUnsafe = async (
  runId: string,
  pointer: string,
  valueKind: string,
  conflictingValues: Record<string, any>
): Promise<void> => {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('__pcivTestWriteRawInputRowUnsafe only available in test mode');
  }

  const payload = {
    run_id: runId,
    pointer,
    label: `test-${pointer}`,
    domain: 'site',
    required: false,
    field_type: 'text',
    value_kind: valueKind,
    provenance: 'user-entered',
    updated_by: 'user',
    updated_at: new Date().toISOString(),
    ...conflictingValues
  };

  const { error } = await supabase.from('pciv_inputs').insert(payload);

  if (error) {
    throw new Error(`DB rejected invalid input (expected): ${error.message}`);
  }
};

/**
 * Get the latest artifact of a specific type for a given run.
 * Returns null if no matching artifact exists.
 */
export const getLatestArtifactByType = async (
  runId: string,
  type: string
): Promise<PcivArtifactV1 | null> => {
  const { data, error } = await supabase
    .from('pciv_artifacts')
    .select('*')
    .eq('run_id', runId)
    .eq('type', type)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    handleSupabaseError(error, 'getLatestArtifactByType');
  }

  return data ? PcivArtifactV1Schema.parse(data) : null;
};

/**
 * Get the latest artifact of a specific type for any run in a given scope.
 * Useful for finding the most recent Planning snapshot or similar cross-run queries.
 * Returns null if no matching artifact exists.
 */
export const getLatestArtifactForScopeByType = async (
  scopeId: string,
  type: string
): Promise<PcivArtifactV1 | null> => {
  const { data, error } = await supabase
    .from('pciv_artifacts')
    .select('*, pciv_runs!inner(scope_id)')
    .eq('pciv_runs.scope_id', scopeId)
    .eq('type', type)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    handleSupabaseError(error, 'getLatestArtifactForScopeByType');
  }

  return data ? PcivArtifactV1Schema.parse(data) : null;
};

// ============================================================================
// TEST-ONLY HELPERS
// ============================================================================

/**
 * TEST-ONLY: Write a raw run row with potentially invalid committed_at state.
 * This bypasses adapter validation to test DB-level constraints.
 * Only available when NODE_ENV === 'test'.
 */
export const __pcivTestWriteRawRunRowUnsafe = async (
  scopeId: string,
  status: string,
  committedAt: string | null
): Promise<string> => {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('__pcivTestWriteRawRunRowUnsafe only available in test mode');
  }

  const payload = {
    scope_id: scopeId,
    status,
    allow_partial: false,
    committed_at: committedAt,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase.from('pciv_runs').insert(payload).select('id').single();

  if (error) {
    throw new Error(`DB rejected invalid run (expected): ${error.message}`);
  }

  return data.id;
};
