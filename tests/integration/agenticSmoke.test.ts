import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createRun, insertArtifact, insertStep } from '../../src/agentic/runtime/persist.ts';
import { ArtifactRecordSchema, StepRecordSchema } from '../../src/agentic/contracts/zod.ts';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasEnv = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY;

if (!hasEnv) {
  console.log('Skipping agentic smoke tests: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.');
}

describe('Agentic Supabase smoke', { skip: !hasEnv }, () => {
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

  test('create run, step, artifact, and fetch timeline', async () => {
    const scopeId = `agentic-smoke-${Date.now()}`;
    const run = await createRun(supabase, { scopeId, status: 'running', userId: null, title: 'Smoke run' });

    const step = StepRecordSchema.parse({
      schema_version: '1.0.0',
      id: randomUUID(),
      run_id: run.id,
      scope_id: scopeId,
      agent_id: 'compliance.policy_grounded',
      agent_version: '1.0.0',
      status: 'ok',
      inputs: { policy_refs: 'Smoke policy' },
      output: {
        mode: 'ok',
        payload: { summary: 'Smoke test output', status: 'compliant' },
        confidence: { level: 'medium' },
        evidence: [],
        assumptions: []
      },
      metrics: null,
      error: null,
      created_at: new Date().toISOString(),
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString()
    });

    const storedStep = await insertStep(supabase, step);
    assert.equal(storedStep.run_id, run.id);

    const artifact = ArtifactRecordSchema.parse({
      schema_version: '1.0.0',
      id: randomUUID(),
      run_id: run.id,
      scope_id: scopeId,
      type: 'compliance.memo.v1',
      title: 'Smoke memo',
      version: 1,
      status: 'draft',
      supersedes: null,
      derived_from_steps: [storedStep.id],
      content: { format: 'markdown', body: 'Smoke memo body' },
      evidence: [],
      assumptions: [],
      created_at: new Date().toISOString()
    });

    const storedArtifact = await insertArtifact(supabase, artifact);
    assert.equal(storedArtifact.run_id, run.id);

    const { data: steps, error: stepsError } = await supabase
      .from('agent_steps')
      .select('*')
      .eq('run_id', run.id)
      .order('created_at', { ascending: true });

    if (stepsError) throw stepsError;
    assert.ok(steps && steps.length >= 1);

    const { data: artifacts, error: artifactsError } = await supabase
      .from('agent_artifacts')
      .select('*')
      .eq('run_id', run.id);

    if (artifactsError) throw artifactsError;
    assert.ok(artifacts && artifacts.length >= 1);
  });
});
