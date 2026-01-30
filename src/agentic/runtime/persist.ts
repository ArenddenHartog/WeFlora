import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { AgentProfileSchema, ArtifactRecordSchema, StepRecordSchema } from '../contracts/zod.ts';
import type { AgentProfile, ArtifactRecord, StepRecord } from '../contracts/zod.ts';
import type { AgentRun } from './types.ts';

const parseSchema = <T>(schema: z.ZodType<T>, data: unknown, label: string): T => {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new Error(`${label} validation failed`);
  }
  return result.data;
};

const mapRunRow = (row: any): AgentRun => ({
  id: row.id,
  scope_id: row.scope_id,
  user_id: row.user_id ?? null,
  title: row.title ?? null,
  status: row.status,
  created_at: row.created_at,
  updated_at: row.updated_at
});

export const upsertAgentProfile = async (supabase: SupabaseClient, profile: AgentProfile): Promise<AgentProfile> => {
  const payload = {
    agent_id: profile.agent_id,
    spec_version: profile.spec_version,
    schema_version: profile.schema_version,
    name: profile.name,
    category: profile.category,
    description: profile.description,
    inputs: profile.inputs,
    output_modes: profile.output_modes,
    output_schema: profile.output_schema,
    tags: profile.tags ?? [],
    tooling: profile.tooling ?? null,
    governance: profile.governance ?? null
  };

  const { data, error } = await supabase
    .from('agent_profiles')
    .upsert(payload, { onConflict: 'agent_id,spec_version' })
    .select('*')
    .single();

  if (error) throw error;
  return parseSchema(AgentProfileSchema, {
    schema_version: data.schema_version,
    spec_version: data.spec_version,
    agent_id: data.agent_id,
    name: data.name,
    category: data.category,
    description: data.description,
    inputs: data.inputs ?? [],
    output_modes: data.output_modes ?? [],
    output_schema: data.output_schema ?? {},
    tags: data.tags ?? [],
    tooling: data.tooling ?? null,
    governance: data.governance ?? null
  }, 'AgentProfile');
};

export const createRun = async (
  supabase: SupabaseClient,
  args: { scopeId: string; title?: string | null; userId?: string | null; status?: AgentRun['status'] }
): Promise<AgentRun> => {
  const authUser = await supabase.auth.getUser();
  const userId = args.userId ?? authUser.data.user?.id ?? null;
  const payload = {
    scope_id: args.scopeId,
    user_id: userId,
    title: args.title ?? null,
    status: args.status ?? 'running'
  };
  const { data, error } = await supabase.from('agent_runs').insert(payload).select('*').single();
  if (error) throw error;
  return mapRunRow(data);
};

export const updateRun = async (
  supabase: SupabaseClient,
  args: { runId: string; status?: AgentRun['status']; title?: string | null }
): Promise<AgentRun> => {
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString()
  };
  if (args.status) payload.status = args.status;
  if (typeof args.title !== 'undefined') payload.title = args.title;

  const { data, error } = await supabase
    .from('agent_runs')
    .update(payload)
    .eq('id', args.runId)
    .select('*')
    .single();
  if (error) throw error;
  return mapRunRow(data);
};

export const insertStep = async (supabase: SupabaseClient, step: StepRecord): Promise<StepRecord> => {
  const payload = {
    id: step.id,
    run_id: step.run_id,
    scope_id: step.scope_id,
    agent_id: step.agent_id,
    agent_version: step.agent_version,
    workflow_id: step.workflow_id ?? null,
    workflow_version: step.workflow_version ?? null,
    workflow_step_id: step.workflow_step_id ?? null,
    status: step.status,
    inputs: step.inputs,
    output: step.output,
    metrics: step.metrics ?? null,
    error: step.error ?? null,
    created_at: step.created_at,
    started_at: step.started_at ?? null,
    finished_at: step.finished_at ?? null
  };

  const { data, error } = await supabase.from('agent_steps').insert(payload).select('*').single();
  if (error) throw error;
  return parseSchema(StepRecordSchema, {
    schema_version: step.schema_version,
    id: data.id,
    run_id: data.run_id,
    scope_id: data.scope_id,
    agent_id: data.agent_id,
    agent_version: data.agent_version,
    workflow_id: data.workflow_id,
    workflow_version: data.workflow_version,
    workflow_step_id: data.workflow_step_id,
    status: data.status,
    inputs: data.inputs ?? {},
    output: data.output ?? { mode: 'rejected' },
    metrics: data.metrics ?? null,
    error: data.error ?? null,
    created_at: data.created_at,
    started_at: data.started_at ?? null,
    finished_at: data.finished_at ?? null
  }, 'StepRecord');
};

export const insertArtifact = async (
  supabase: SupabaseClient,
  artifact: ArtifactRecord
): Promise<ArtifactRecord> => {
  const payload = {
    id: artifact.id,
    run_id: artifact.run_id,
    scope_id: artifact.scope_id,
    type: artifact.type,
    title: artifact.title ?? null,
    version: artifact.version,
    status: artifact.status,
    supersedes: artifact.supersedes ?? null,
    derived_from_steps: artifact.derived_from_steps,
    content: artifact.content,
    evidence: artifact.evidence,
    assumptions: artifact.assumptions,
    created_at: artifact.created_at
  };

  const { data, error } = await supabase.from('agent_artifacts').insert(payload).select('*').single();
  if (error) throw error;
  return parseSchema(ArtifactRecordSchema, {
    schema_version: artifact.schema_version,
    id: data.id,
    run_id: data.run_id,
    scope_id: data.scope_id,
    type: data.type,
    title: data.title ?? null,
    version: data.version,
    status: data.status,
    supersedes: data.supersedes ?? null,
    derived_from_steps: data.derived_from_steps ?? [],
    content: data.content ?? { format: 'json', body: null },
    evidence: data.evidence ?? [],
    assumptions: data.assumptions ?? [],
    created_at: data.created_at
  }, 'ArtifactRecord');
};
