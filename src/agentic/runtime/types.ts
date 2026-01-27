import type { ArtifactRecord, AgentProfile, OutputEnvelope, StepRecord } from '../contracts/zod.ts';

export type AgentRunStatus = 'draft' | 'running' | 'complete' | 'partial' | 'failed';
export type StepStatus = 'queued' | 'running' | 'ok' | 'insufficient_data' | 'rejected' | 'error';
export type ArtifactStatus = 'draft' | 'final' | 'superseded';

export type AgentRun = {
  id: string;
  scope_id: string;
  user_id: string | null;
  title: string | null;
  status: AgentRunStatus;
  created_at: string;
  updated_at: string;
};

export type AgentRunInput = {
  runId: string;
  scopeId: string;
  agentId: string;
  agentVersion?: string;
  inputs: Record<string, unknown>;
  workflowId?: string | null;
  workflowVersion?: string | null;
  workflowStepId?: string | null;
};

export type AgentHandlerContext = {
  profile: AgentProfile;
  runId: string;
  scopeId: string;
  inputs: Record<string, unknown>;
};

export type AgentHandlerResult = {
  output: OutputEnvelope;
  artifacts?: Array<Omit<ArtifactRecord, 'id' | 'run_id' | 'scope_id' | 'schema_version' | 'created_at'>>;
};

export type AgentHandler = (context: AgentHandlerContext) => Promise<AgentHandlerResult> | AgentHandlerResult;

export type AgentRunResult = {
  step: StepRecord;
  artifacts: ArtifactRecord[];
};
