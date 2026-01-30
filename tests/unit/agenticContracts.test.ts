import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import Ajv from 'ajv';
import { AgentProfileSchema, StepRecordSchema } from '../../src/agentic/contracts/zod.ts';
import { agentProfiles } from '../../src/agentic/registry/agents.ts';

const FIXTURE_DIR = path.join(process.cwd(), 'src/agentic/fixtures/agentOutputs');

const ajv = new Ajv({ allErrors: true });

const loadFixtures = () => {
  const files = fs.readdirSync(FIXTURE_DIR).filter((file) => file.endsWith('.json'));
  return files.map((file) => ({
    file,
    data: JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, file), 'utf8'))
  }));
};

describe('agentic contracts', () => {
  test('agent profiles validate', () => {
    agentProfiles.forEach((profile) => {
      const result = AgentProfileSchema.safeParse(profile);
      assert.ok(result.success, `Profile invalid: ${profile.agent_id}`);
    });
  });

  test('fixtures validate against StepRecord + output schema', () => {
    const fixtures = loadFixtures();
    assert.ok(fixtures.length >= 15, 'Expected at least 15 agent fixtures');

    fixtures.forEach(({ file, data }) => {
      assert.ok(data.agent_id, `Fixture missing agent_id: ${file}`);
      const profile = agentProfiles.find((p) => p.agent_id === data.agent_id);
      assert.ok(profile, `No profile found for fixture: ${data.agent_id}`);

      const hasInsufficient = data.samples.some((sample: any) => sample.output?.mode === 'insufficient_data');
      assert.ok(hasInsufficient, `Fixture missing insufficient_data sample: ${data.agent_id}`);

      const validatePayload = ajv.compile(profile.output_schema);

      data.samples.forEach((sample: any) => {
        const parsed = StepRecordSchema.safeParse(sample);
        assert.ok(parsed.success, `StepRecord invalid for ${data.agent_id}`);

        if (sample.output?.mode === 'ok' && sample.output?.payload) {
          const valid = validatePayload(sample.output.payload);
          assert.ok(valid, `Output payload invalid for ${data.agent_id}: ${JSON.stringify(validatePayload.errors)}`);
        }
      });
    });
  });
});
