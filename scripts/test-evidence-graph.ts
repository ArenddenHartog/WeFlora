import assert from 'node:assert/strict';
import type { EvidenceGraph } from '../src/decision-program/types.ts';
import { computeConfidenceGraph } from '../src/decision-program/evidence/confidence.ts';
import { simulateScenario } from '../src/decision-program/evidence/simulate.ts';

const nearlyEqual = (actual: number, expected: number, epsilon = 1e-4) => {
  assert.ok(Math.abs(actual - expected) <= epsilon, `expected ${actual} to be near ${expected}`);
};

// 1. Confidence noisy OR
{
  const graph: EvidenceGraph = {
    nodes: [
      { id: 'source:1', type: 'source', label: 'S1', confidenceBase: 0.9 },
      { id: 'source:2', type: 'source', label: 'S2', confidenceBase: 0.6 },
      { id: 'claim:1', type: 'claim', label: 'Claim 1' }
    ],
    edges: [
      { from: 'source:1', to: 'claim:1', type: 'supports', confidence: 0.8 },
      { from: 'source:2', to: 'claim:1', type: 'supports', confidence: 0.8 }
    ]
  };
  const computed = computeConfidenceGraph(graph);
  const claim = computed.nodes.find((node) => node.id === 'claim:1');
  assert.ok(claim?.confidence !== undefined);
  nearlyEqual(claim?.confidence ?? 0, 0.8544, 1e-4);
}

// 2. Conflict penalty cap
{
  const graph: EvidenceGraph = {
    nodes: [
      { id: 'source:1', type: 'source', label: 'S1', confidenceBase: 1 },
      { id: 'claim:1', type: 'claim', label: 'Claim 1' },
      { id: 'source:2', type: 'source', label: 'S2' }
    ],
    edges: [
      { from: 'source:1', to: 'claim:1', type: 'supports', confidence: 1 },
      { from: 'source:2', to: 'claim:1', type: 'conflicts_with', weight: 0.2 },
      { from: 'source:2', to: 'claim:1', type: 'conflicts_with', weight: 0.2 },
      { from: 'source:2', to: 'claim:1', type: 'conflicts_with', weight: 0.2 }
    ]
  };
  const computed = computeConfidenceGraph(graph);
  const claim = computed.nodes.find((node) => node.id === 'claim:1');
  assert.ok(claim?.confidence !== undefined);
  nearlyEqual(claim?.confidence ?? 0, 0.65, 1e-4);
}

// 3. Derived constraint confidence weighted mean
{
  const graph: EvidenceGraph = {
    nodes: [
      { id: 'claim:1', type: 'claim', label: 'Claim 1', confidence: 0.9 },
      { id: 'claim:2', type: 'claim', label: 'Claim 2', confidence: 0.7 },
      { id: 'constraint:1', type: 'constraint', label: 'Constraint 1' }
    ],
    edges: [
      { from: 'claim:1', to: 'constraint:1', type: 'derived_from', confidence: 0.9, attenuation: 0.9, weight: 1 },
      { from: 'claim:2', to: 'constraint:1', type: 'derived_from', confidence: 0.8, attenuation: 0.8, weight: 2 }
    ]
  };
  const computed = computeConfidenceGraph(graph);
  const constraint = computed.nodes.find((node) => node.id === 'constraint:1');
  assert.ok(constraint?.confidence !== undefined);
  nearlyEqual(constraint?.confidence ?? 0, 1.625 / 3, 1e-4);
}

// 4. Decision confidence + coverage penalty
{
  const graph: EvidenceGraph = {
    nodes: [
      { id: 'constraint:a', type: 'constraint', label: 'Constraint A', confidence: 0.8 },
      {
        id: 'decision:1',
        type: 'decision',
        label: 'Decision 1',
        metadata: { requiredConstraintIds: ['constraint:a', 'constraint:missing'] }
      }
    ],
    edges: [{ from: 'constraint:a', to: 'decision:1', type: 'influences' }]
  };
  const computed = computeConfidenceGraph(graph);
  const decision = computed.nodes.find((node) => node.id === 'decision:1');
  assert.ok(decision?.confidence !== undefined);
  nearlyEqual(decision?.confidence ?? 0, 0.306 * 0.8, 1e-4);
}

// 5. Simulation diff
{
  const graph: EvidenceGraph = {
    nodes: [
      { id: 'constraint:a', type: 'constraint', label: 'Constraint A', confidence: 0.7 },
      { id: 'constraint:unlinked', type: 'constraint', label: 'Unlinked constraint', confidence: 0.5 },
      { id: 'decision:1', type: 'decision', label: 'Decision 1' }
    ],
    edges: [{ from: 'constraint:a', to: 'decision:1', type: 'influences' }]
  };
  const base = computeConfidenceGraph(graph);
  const scenario = {
    id: 'scenario-1',
    patches: [
      {
        nodeId: 'constraint:a',
        mode: 'overrideEvidence',
        patch: { value: true, confidence: 0.98, confidenceSource: 'user' }
      }
    ]
  };
  const simulation = simulateScenario(base, scenario);
  assert.ok(simulation.diff.changedNodes.some((entry) => entry.id === 'constraint:a'));
  assert.ok(simulation.diff.changedDecisions.some((entry) => entry.id === 'decision:1'));
  assert.ok(!simulation.diff.changedNodes.some((entry) => entry.id === 'constraint:unlinked'));
}
