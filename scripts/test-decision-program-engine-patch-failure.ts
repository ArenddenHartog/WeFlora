import assert from 'node:assert/strict';
import { createExecutionState, stepExecution } from '../src/decision-program/runtime/engine.ts';
import type { DecisionProgram } from '../src/decision-program/types.ts';
import type { Agent } from '../src/decision-program/agents/types.ts';

const program: DecisionProgram = {
  id: 'patch-failure-program',
  title: 'Patch Failure Program',
  version: 'v0.1',
  steps: [
    {
      id: 'site:bad-patch',
      title: 'Bad patch step',
      kind: 'agent',
      phase: 'site',
      agentRef: 'bad-patch-agent',
      requiredPointers: [],
      producesPointers: ['/context/site/constraints']
    }
  ]
};

const badAgent: Agent = {
  id: 'bad-patch-agent',
  title: 'Bad Patch Agent',
  phase: 'site',
  requiredPointers: [],
  producesPointers: ['/context/site/constraints'],
  run: async () => ({
    patches: [
      {
        pointer: 'context/no-leading-slash',
        value: 'boom'
      }
    ]
  })
};

const registry = new Map([[badAgent.id, badAgent]]);
const state = createExecutionState(program, {
  site: {},
  regulatory: {},
  equity: {},
  species: {},
  supply: {}
});

const result = await stepExecution(state, program, registry);

assert.equal(result.steps[0].status, 'error');
assert.notEqual(result.status, 'done');
assert.equal(result.status, 'error');
const errorLogs = result.logs.filter((entry) => entry.level === 'error');
assert.ok(errorLogs.some((entry) => entry.message.toLowerCase().includes('patch')));
