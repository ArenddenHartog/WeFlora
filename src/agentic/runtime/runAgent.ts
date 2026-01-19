import { ArtifactRecordSchema, StepRecordSchema } from '../contracts/zod.ts';
import type { ArtifactRecord, StepRecord } from '../contracts/zod.ts';
import type { AgentHandler, AgentRunInput, AgentRunResult } from './types.ts';
import { AgentProfileNotFoundError } from './errors.ts';
import { getAgentProfile } from './registry.ts';

const createId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `step-${Math.random().toString(36).slice(2)}-${Date.now()}`;
};

const now = () => new Date().toISOString();

const toStatus = (mode: string): StepRecord['status'] => {
  switch (mode) {
    case 'ok':
      return 'ok';
    case 'insufficient_data':
      return 'insufficient_data';
    case 'rejected':
      return 'rejected';
    default:
      return 'error';
  }
};

export const runAgent = async (
  input: AgentRunInput,
  handler: AgentHandler,
  persist?: {
    insertStep?: (step: StepRecord) => Promise<StepRecord>;
    insertArtifact?: (artifact: ArtifactRecord) => Promise<ArtifactRecord>;
  }
): Promise<AgentRunResult> => {
  const profile = getAgentProfile(input.agentId, input.agentVersion);
  if (!profile) {
    throw new AgentProfileNotFoundError(input.agentId, input.agentVersion);
  }

  const startedAt = now();
  let output: StepRecord['output'];
  let artifacts: ArtifactRecord[] = [];
  let status: StepRecord['status'] = 'running';
  let errorPayload: StepRecord['error'] = null;

  try {
    const result = await handler({
      profile,
      runId: input.runId,
      scopeId: input.scopeId,
      inputs: input.inputs
    });
    output = result.output;
    status = toStatus(result.output.mode);

    if (result.artifacts?.length) {
      artifacts = result.artifacts.map((artifact) => {
        const record: ArtifactRecord = {
          schema_version: profile.schema_version,
          id: createId(),
          run_id: input.runId,
          scope_id: input.scopeId,
          type: artifact.type,
          title: artifact.title ?? null,
          version: artifact.version,
          status: artifact.status,
          supersedes: artifact.supersedes ?? null,
          derived_from_steps: artifact.derived_from_steps,
          content: artifact.content,
          evidence: artifact.evidence ?? [],
          assumptions: artifact.assumptions ?? [],
          created_at: now()
        };
        return ArtifactRecordSchema.parse(record);
      });
    }
  } catch (err) {
    status = 'error';
    output = { mode: 'rejected' };
    errorPayload = { message: (err as Error)?.message ?? 'Agent execution failed' };
  }

  const step: StepRecord = StepRecordSchema.parse({
    schema_version: profile.schema_version,
    id: createId(),
    run_id: input.runId,
    scope_id: input.scopeId,
    agent_id: profile.agent_id,
    agent_version: profile.spec_version,
    workflow_id: input.workflowId ?? null,
    workflow_version: input.workflowVersion ?? null,
    workflow_step_id: input.workflowStepId ?? null,
    status,
    inputs: input.inputs,
    output: output ?? { mode: 'rejected' },
    metrics: null,
    error: errorPayload,
    created_at: now(),
    started_at: startedAt,
    finished_at: now()
  });

  let persistedStep = step;
  if (persist?.insertStep) {
    persistedStep = await persist.insertStep(step);
  }

  if (persist?.insertArtifact) {
    const persistedArtifacts: ArtifactRecord[] = [];
    for (const artifact of artifacts) {
      const stored = await persist.insertArtifact(artifact);
      persistedArtifacts.push(stored);
    }
    artifacts = persistedArtifacts;
  }

  return { step: persistedStep, artifacts };
};
