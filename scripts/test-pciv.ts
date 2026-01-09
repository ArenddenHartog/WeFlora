import assert from 'node:assert/strict';
import { validateConstraintRegistry } from '../src/domain/constraints/constraintRegistry.ts';
import { computeClaimConfidence, computeConstraintConfidence, computeDecisionConfidence } from '../src/decision-program/pciv/confidence.ts';
import { addSource, confirmConstraints, createContextVersion, extractContext, getGraph, getConstraints, updateClaim } from '../src/decision-program/pciv/store.ts';
import type { Claim, Constraint, GraphEdge, GraphNode } from '../src/decision-program/pciv/types.ts';
import { buildContextPatchesFromConstraints } from '../src/decision-program/pciv/adapters.ts';
import { listMissingPointers, setByPointer } from '../src/decision-program/runtime/pointers.ts';
import { STREET_TREE_SHORTLIST_REQUIRED_POINTERS } from '../src/decision-program/orchestrator/canonicalPointers.ts';

// Unit: registry validation
{
  const errors = validateConstraintRegistry();
  assert.equal(errors.length, 0);
}

// Unit: claim confidence
{
  const claim: Claim = {
    claimId: 'claim-1',
    contextVersionId: 'ctx',
    domain: 'regulatory',
    claimType: 'fact',
    statement: 'Regulatory setting: provincial road',
    normalized: { key: 'regulatory.setting', value: 'provincialRoad', datatype: 'enum' },
    confidence: 0,
    confidenceRationale: 'direct quote',
    status: 'proposed',
    review: {},
    evidenceRefs: [{ evidenceId: 'e1', strength: 'direct' }],
    createdAt: new Date().toISOString()
  };
  const direct = computeClaimConfidence(claim);
  assert.ok(direct >= 0.9);
  const inferred = computeClaimConfidence({ ...claim, claimType: 'inference' });
  assert.ok(inferred < direct);
  const corrected = computeClaimConfidence({ ...claim, status: 'corrected', confidence: direct });
  assert.ok(corrected >= 0.75);
}

// Unit: constraint confidence
{
  const constraint: Constraint = {
    constraintId: 'c1',
    contextVersionId: 'ctx',
    key: 'site.soil.type',
    value: 'clay',
    datatype: 'enum',
    confidence: 0,
    status: 'active',
    derivedFrom: [
      { claimId: 'claim-1', weight: 1 },
      { claimId: 'claim-2', weight: 2 }
    ],
    createdAt: new Date().toISOString()
  };
  const claims: Claim[] = [
    {
      claimId: 'claim-1',
      contextVersionId: 'ctx',
      domain: 'biophysical',
      claimType: 'fact',
      statement: 'Soil is clay',
      normalized: { key: 'site.soil.type', value: 'clay', datatype: 'enum' },
      confidence: 0.8,
      confidenceRationale: 'direct quote',
      status: 'accepted',
      review: {},
      evidenceRefs: [{ evidenceId: 'e1', strength: 'direct' }],
      createdAt: new Date().toISOString()
    },
    {
      claimId: 'claim-2',
      contextVersionId: 'ctx',
      domain: 'biophysical',
      claimType: 'fact',
      statement: 'Soil is clay',
      normalized: { key: 'site.soil.type', value: 'clay', datatype: 'enum' },
      confidence: 0.6,
      confidenceRationale: 'supporting',
      status: 'accepted',
      review: {},
      evidenceRefs: [{ evidenceId: 'e2', strength: 'supporting' }],
      createdAt: new Date().toISOString()
    }
  ];
  const confidence = computeConstraintConfidence(constraint, claims);
  assert.ok(confidence > 0.6 && confidence < 0.8);
}

// Unit: decision confidence
{
  const decisionNode: GraphNode = {
    nodeId: 'decision-1',
    graphId: 'graph-1',
    nodeType: 'decision',
    label: 'Planning kickoff',
    confidence: 0,
    payload: { decisionKey: 'planning_kickoff', scope: 'planning' },
    createdAt: new Date().toISOString()
  };
  const edges: Array<{ edge: GraphEdge; constraintConfidence: number }> = [
    {
      edge: {
        edgeId: 'edge-1',
        graphId: 'graph-1',
        fromNodeId: 'c1',
        toNodeId: 'decision-1',
        edgeType: 'influences',
        polarity: 'positive',
        weight: 0.8,
        createdAt: new Date().toISOString()
      },
      constraintConfidence: 0.9
    },
    {
      edge: {
        edgeId: 'edge-2',
        graphId: 'graph-1',
        fromNodeId: 'c2',
        toNodeId: 'decision-1',
        edgeType: 'influences',
        polarity: 'negative',
        weight: 0.2,
        createdAt: new Date().toISOString()
      },
      constraintConfidence: 0.6
    }
  ];
  const confidence = computeDecisionConfidence(decisionNode, edges);
  assert.ok(confidence > 0.5 && confidence < 1);
}

// Integration: context -> source -> extract -> accept -> confirm
{
  const context = createContextVersion('ctx-test');
  const source = addSource(context.graph.contextVersionId, {
    type: 'file',
    title: 'Regulatory memo',
    mimeType: 'text/plain',
    metadata: { content: 'Regulatory setting: Provincial road. Soil type: clay.' }
  });
  assert.ok(source.sourceId);
  const extracted = extractContext(context.graph.contextVersionId);
  assert.ok(extracted.claims.length > 0);
  const firstClaim = extracted.claims[0];
  updateClaim(context.graph.contextVersionId, firstClaim.claimId, { status: 'accepted' });
  const constraints = confirmConstraints(context.graph.contextVersionId);
  assert.ok(constraints.length > 0);
  const graph = getGraph(context.graph.contextVersionId);
  assert.equal(graph.graph.status, 'locked');
  assert.ok(graph.nodes.some((node) => node.nodeType === 'source'));
  assert.ok(graph.nodes.some((node) => node.nodeType === 'evidence'));
  assert.ok(graph.nodes.some((node) => node.nodeType === 'claim'));
  assert.ok(graph.nodes.some((node) => node.nodeType === 'constraint'));
  assert.ok(graph.edges.some((edge) => edge.edgeType === 'cites'));
  assert.ok(graph.edges.some((edge) => edge.edgeType === 'supports'));
  assert.ok(graph.edges.some((edge) => edge.edgeType === 'derives'));
}

// Integration: planning run uses locked constraints
{
  const context = createContextVersion('ctx-plan');
  addSource(context.graph.contextVersionId, {
    type: 'file',
    title: 'Site summary',
    mimeType: 'text/plain',
    metadata: { content: 'Soil type: loam. Light exposure: full sun.' }
  });
  const extracted = extractContext(context.graph.contextVersionId);
  extracted.claims.forEach((claim) => {
    updateClaim(context.graph.contextVersionId, claim.claimId, { status: 'accepted' });
  });
  confirmConstraints(context.graph.contextVersionId);
  const constraints = getConstraints(context.graph.contextVersionId);
  const wrapper = { context: { site: {}, regulatory: {}, equity: {}, species: {}, supply: {} } };
  buildContextPatchesFromConstraints(constraints).forEach((patch) =>
    setByPointer(wrapper, patch.pointer, patch.value)
  );
  const missing = listMissingPointers(wrapper, STREET_TREE_SHORTLIST_REQUIRED_POINTERS);
  assert.ok(!missing.includes('/context/site/soil/type'));
  assert.ok(!missing.includes('/context/site/light'));
}
