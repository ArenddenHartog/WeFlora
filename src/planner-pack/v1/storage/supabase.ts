import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  PlannerArtifactSchema,
  PlannerGeometrySchema,
  PlannerInterventionSchema,
  PlannerRunSchema,
  PlannerSourceSchema,
  type PlannerArtifact,
  type PlannerGeometry,
  type PlannerGeometryInput,
  type PlannerIntervention,
  type PlannerRun,
  type PlannerSource
} from '../schemas.ts';
import {
  listScopeMembers as listPcivScopeMembers,
  upsertScopeMember as upsertPcivScopeMember,
  removeScopeMember as removePcivScopeMember
} from '../../../decision-program/pciv/v1/storage/supabase.ts';
import type { PcivScopeMemberRole, PcivScopeMemberV1 } from '../../../decision-program/pciv/v1/schemas.ts';
import { handleSupabaseError } from './errors.ts';

const parseSchema = <T>(schema: z.ZodType<T>, data: unknown, label: string): T => {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new Error(`${label} validation failed: ${result.error.message}`);
  }
  return result.data;
};

const mapInterventionRow = (row: any): PlannerIntervention =>
  parseSchema(
    PlannerInterventionSchema,
    {
      id: row.id,
      scopeId: row.scope_id,
      createdBy: row.created_by ?? null,
      name: row.name,
      municipality: row.municipality ?? null,
      interventionType: row.intervention_type,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    },
    'PlannerIntervention'
  );

const mapGeometryRow = (row: any): PlannerGeometry =>
  parseSchema(
    PlannerGeometrySchema,
    {
      id: row.id,
      interventionId: row.intervention_id,
      kind: row.kind,
      geojson: row.geojson,
      corridorWidthM: row.corridor_width_m ?? undefined,
      areaM2: row.area_m2 ?? null,
      lengthM: row.length_m ?? null,
      createdAt: row.created_at
    },
    'PlannerGeometry'
  );

const mapSourceRow = (row: any): PlannerSource =>
  parseSchema(
    PlannerSourceSchema,
    {
      id: row.id,
      interventionId: row.intervention_id,
      kind: row.kind,
      title: row.title,
      uri: row.uri ?? null,
      fileId: row.file_id ?? null,
      mimeType: row.mime_type ?? null,
      parseStatus: row.parse_status,
      parseReport: row.parse_report ?? {},
      createdAt: row.created_at
    },
    'PlannerSource'
  );

const mapRunRow = (row: any): PlannerRun =>
  parseSchema(
    PlannerRunSchema,
    {
      id: row.id,
      interventionId: row.intervention_id,
      workerType: row.worker_type,
      status: row.status,
      assumptions: row.assumptions ?? {},
      inputsHash: row.inputs_hash ?? null,
      startedAt: row.started_at,
      finishedAt: row.finished_at ?? null
    },
    'PlannerRun'
  );

const mapArtifactRow = (row: any): PlannerArtifact =>
  parseSchema(
    PlannerArtifactSchema,
    {
      id: row.id,
      interventionId: row.intervention_id,
      runId: row.run_id ?? null,
      type: row.type,
      version: row.version,
      payload: row.payload ?? {},
      renderedHtml: row.rendered_html ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    },
    'PlannerArtifact'
  );


export const createIntervention = async (
  supabase: SupabaseClient,
  args: { scopeId: string; name: string; municipality?: string | null; interventionType: string }
): Promise<PlannerIntervention> => {
  const userId = (await supabase.auth.getUser()).data.user?.id ?? null;
  const payload = {
    scope_id: args.scopeId,
    created_by: userId,
    name: args.name,
    municipality: args.municipality ?? null,
    intervention_type: args.interventionType,
    status: 'draft'
  };
  const { data, error } = await supabase.from('planner_interventions').insert(payload).select('*').single();
  if (error) handleSupabaseError(error, 'createIntervention');
  return mapInterventionRow(data);
};

export const bootstrapIntervention = async (
  supabase: SupabaseClient,
  args: { scopeId: string; name: string; municipality?: string | null; interventionType: string }
): Promise<{ interventionId: string; scopeId: string }> => {
  const { data, error } = await supabase.rpc('planner_bootstrap_intervention', {
    p_scope_id: args.scopeId,
    p_name: args.name,
    p_municipality: args.municipality ?? null,
    p_intervention_type: args.interventionType
  });
  if (error) handleSupabaseError(error, 'bootstrapIntervention');
  const row = data?.[0];
  if (!row?.intervention_id) {
    throw new Error('bootstrapIntervention failed: no intervention id returned');
  }
  return { interventionId: row.intervention_id, scopeId: row.scope_id };
};

export const setGeometry = async (
  supabase: SupabaseClient,
  interventionId: string,
  geometry: PlannerGeometryInput
): Promise<PlannerGeometry> => {
  const payload = {
    intervention_id: interventionId,
    kind: geometry.kind,
    geojson: geometry.geojson,
    corridor_width_m: geometry.corridorWidthM ?? null,
    area_m2: geometry.areaM2 ?? null,
    length_m: geometry.lengthM ?? null
  };

  const { data: existing, error: existingError } = await supabase
    .from('planner_geometries')
    .select('*')
    .eq('intervention_id', interventionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) handleSupabaseError(existingError, 'setGeometry.list');

  if (existing?.id) {
    const { data, error } = await supabase
      .from('planner_geometries')
      .update(payload)
      .eq('id', existing.id)
      .select('*')
      .single();
    if (error) handleSupabaseError(error, 'setGeometry.update');
    return mapGeometryRow(data);
  }

  const { data, error } = await supabase.from('planner_geometries').insert(payload).select('*').single();
  if (error) handleSupabaseError(error, 'setGeometry.insert');
  return mapGeometryRow(data);
};

export const addUploadSource = async (
  supabase: SupabaseClient,
  interventionId: string,
  args: { title: string; fileId?: string | null; mimeType?: string | null }
): Promise<PlannerSource> => {
  const payload = {
    intervention_id: interventionId,
    kind: 'upload',
    title: args.title,
    file_id: args.fileId ?? null,
    mime_type: args.mimeType ?? null,
    parse_status: 'pending',
    parse_report: {}
  };
  const { data, error } = await supabase.from('planner_sources').insert(payload).select('*').single();
  if (error) handleSupabaseError(error, 'addUploadSource');
  return mapSourceRow(data);
};

export const updateSourceParseStatus = async (
  supabase: SupabaseClient,
  sourceId: string,
  patch: { parseStatus: 'pending' | 'parsed' | 'partial' | 'failed'; parseReport: Record<string, unknown> }
): Promise<void> => {
  const { error } = await supabase
    .from('planner_sources')
    .update({ parse_status: patch.parseStatus, parse_report: patch.parseReport })
    .eq('id', sourceId);
  if (error) handleSupabaseError(error, 'updateSourceParseStatus');
};

export const createRun = async (
  supabase: SupabaseClient,
  interventionId: string,
  workerType: 'inventory_ingest' | 'planner_pack_compose' | 'maintenance_lifecycle',
  assumptions: Record<string, unknown>
): Promise<PlannerRun> => {
  const payload = {
    intervention_id: interventionId,
    worker_type: workerType,
    assumptions,
    status: 'running'
  };
  const { data, error } = await supabase.from('planner_runs').insert(payload).select('*').single();
  if (error) handleSupabaseError(error, 'createRun');
  return mapRunRow(data);
};

export const finishRun = async (
  supabase: SupabaseClient,
  runId: string,
  status: 'succeeded' | 'failed'
): Promise<void> => {
  const { error } = await supabase
    .from('planner_runs')
    .update({ status, finished_at: new Date().toISOString() })
    .eq('id', runId);
  if (error) handleSupabaseError(error, 'finishRun');
};

export const upsertArtifact = async (
  supabase: SupabaseClient,
  interventionId: string,
  args: { runId?: string | null; type: PlannerArtifact['type']; payload: Record<string, unknown>; renderedHtml?: string | null }
): Promise<PlannerArtifact> => {
  const { data: latest, error: latestError } = await supabase
    .from('planner_artifacts')
    .select('version')
    .eq('intervention_id', interventionId)
    .eq('type', args.type)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError) handleSupabaseError(latestError, 'upsertArtifact.latest');

  const version = (latest?.version ?? 0) + 1;
  const payload = {
    intervention_id: interventionId,
    run_id: args.runId ?? null,
    type: args.type,
    version,
    payload: args.payload,
    rendered_html: args.renderedHtml ?? null
  };

  const { data, error } = await supabase.from('planner_artifacts').insert(payload).select('*').single();
  if (error) handleSupabaseError(error, 'upsertArtifact');

  if (args.type === 'email_draft') {
    const { error: statusError } = await supabase
      .from('planner_interventions')
      .update({ status: 'submission_ready', updated_at: new Date().toISOString() })
      .eq('id', interventionId);
    if (statusError) handleSupabaseError(statusError, 'upsertArtifact.updateStatus');
  }

  return mapArtifactRow(data);
};

export const listArtifacts = async (
  supabase: SupabaseClient,
  interventionId: string
): Promise<PlannerArtifact[]> => {
  const { data, error } = await supabase
    .from('planner_artifacts')
    .select('*')
    .eq('intervention_id', interventionId)
    .order('created_at', { ascending: false });
  if (error) handleSupabaseError(error, 'listArtifacts');
  return (data ?? []).map(mapArtifactRow);
};

export const getLatestArtifactByType = async (
  supabase: SupabaseClient,
  interventionId: string,
  type: PlannerArtifact['type']
): Promise<PlannerArtifact | null> => {
  const { data, error } = await supabase
    .from('planner_artifacts')
    .select('*')
    .eq('intervention_id', interventionId)
    .eq('type', type)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) handleSupabaseError(error, 'getLatestArtifactByType');
  return data ? mapArtifactRow(data) : null;
};

export const getIntervention = async (supabase: SupabaseClient, id: string): Promise<PlannerIntervention> => {
  const { data, error } = await supabase.from('planner_interventions').select('*').eq('id', id).single();
  if (error) handleSupabaseError(error, 'getIntervention');
  return mapInterventionRow(data);
};

export const listInterventionsForScope = async (
  supabase: SupabaseClient,
  scopeId: string
): Promise<PlannerIntervention[]> => {
  const { data, error } = await supabase
    .from('planner_interventions')
    .select('*')
    .eq('scope_id', scopeId)
    .order('created_at', { ascending: false });
  if (error) handleSupabaseError(error, 'listInterventionsForScope');
  return (data ?? []).map(mapInterventionRow);
};

export const listScopeMembers = async (scopeId: string): Promise<PcivScopeMemberV1[]> =>
  listPcivScopeMembers(scopeId);

export const updateScopeMemberRole = async (
  scopeId: string,
  userId: string,
  role: PcivScopeMemberRole
): Promise<void> => {
  await upsertPcivScopeMember(scopeId, userId, role);
};

export const removeScopeMember = async (scopeId: string, userId: string): Promise<void> => {
  await removePcivScopeMember(scopeId, userId);
};
