import { CONSTRAINT_REGISTRY_MAP } from '../../domain/constraints/constraintRegistry.ts';
import { computeClaimConfidence, computeConstraintConfidence, computeDecisionConfidence } from './confidence.ts';
import { extractEvidenceAndClaims } from './extraction.ts';
import type {
  Claim,
  Constraint,
  ContextSnapshot,
  EvidenceGraphSnapshot,
  EvidenceItem,
  Graph,
  GraphEdge,
  GraphNode,
  Source
} from './types.ts';

const now = () => new Date().toISOString();

const buildId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

type ContextStore = {
  graph: Graph;
  sources: Source[];
  evidenceItems: EvidenceItem[];
  claims: Claim[];
  constraints: Constraint[];
  nodes: GraphNode[];
  edges: GraphEdge[];
};

const store = new Map<string, ContextStore>();

const ensureContext = (contextVersionId: string) => {
  const context = store.get(contextVersionId);
  if (!context) throw new Error(`Unknown contextVersionId: ${contextVersionId}`);
  return context;
};

const upsertNode = (context: ContextStore, node: GraphNode) => {
  const index = context.nodes.findIndex((entry) => entry.nodeId === node.nodeId);
  if (index >= 0) {
    context.nodes[index] = node;
    return;
  }
  context.nodes.push(node);
};

const upsertEdge = (context: ContextStore, edge: GraphEdge) => {
  const index = context.edges.findIndex((entry) => entry.edgeId === edge.edgeId);
  if (index >= 0) {
    context.edges[index] = edge;
    return;
  }
  context.edges.push(edge);
};

export const createContextVersion = (contextId = buildId('context')): ContextSnapshot => {
  const contextVersionId = buildId('ctxv');
  const graphId = buildId('graph');
  const graph: Graph = {
    graphId,
    contextId,
    contextVersionId,
    createdAt: now(),
    createdBy: 'system',
    status: 'draft'
  };
  const record: ContextStore = {
    graph,
    sources: [],
    evidenceItems: [],
    claims: [],
    constraints: [],
    nodes: [],
    edges: []
  };
  store.set(contextVersionId, record);
  return {
    graph,
    sources: [],
    evidenceItems: [],
    claims: [],
    constraints: [],
    nodes: [],
    edges: []
  };
};

export const addSource = (contextVersionId: string, source: Omit<Source, 'contextVersionId' | 'createdAt' | 'sourceId'>): Source => {
  const context = ensureContext(contextVersionId);
  const sourceRecord: Source = {
    ...source,
    sourceId: buildId('source'),
    contextVersionId,
    createdAt: now()
  };
  context.sources.push(sourceRecord);
  const node: GraphNode = {
    nodeId: buildId('node'),
    graphId: context.graph.graphId,
    nodeType: 'source',
    label: sourceRecord.title,
    confidence: null,
    payload: { sourceId: sourceRecord.sourceId },
    createdAt: now()
  };
  upsertNode(context, node);
  return sourceRecord;
};

export const extractContext = (contextVersionId: string) => {
  const context = ensureContext(contextVersionId);
  const { evidenceItems, claims } = extractEvidenceAndClaims(context.sources);
  const evidenceNodes: GraphNode[] = [];
  const claimNodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  evidenceItems.forEach((item) => {
    const node: GraphNode = {
      nodeId: buildId('node'),
      graphId: context.graph.graphId,
      nodeType: 'evidence',
      label: item.text?.slice(0, 48) || `${item.kind} evidence`,
      confidence: null,
      payload: { evidenceId: item.evidenceId },
      createdAt: now()
    };
    evidenceNodes.push(node);
    const sourceNode = context.nodes.find((entry) => entry.nodeType === 'source' && entry.payload.sourceId === item.sourceId);
    if (sourceNode) {
      edges.push({
        edgeId: buildId('edge'),
        graphId: context.graph.graphId,
        fromNodeId: sourceNode.nodeId,
        toNodeId: node.nodeId,
        edgeType: 'cites',
        polarity: 'neutral',
        weight: 1,
        createdAt: now()
      });
    }
  });

  claims.forEach((claim) => {
    claim.contextVersionId = contextVersionId;
    claim.confidence = computeClaimConfidence(claim);
    const node: GraphNode = {
      nodeId: buildId('node'),
      graphId: context.graph.graphId,
      nodeType: 'claim',
      label: claim.statement,
      confidence: claim.confidence,
      payload: { claimId: claim.claimId, domain: claim.domain, claimType: claim.claimType },
      createdAt: now()
    };
    claimNodes.push(node);
    claim.evidenceRefs.forEach((ref) => {
      const evidenceNode = evidenceNodes.find((entry) => entry.payload.evidenceId === ref.evidenceId);
      if (!evidenceNode) return;
      const strengthWeight = ref.strength === 'direct' ? 1 : ref.strength === 'supporting' ? 0.6 : 0.3;
      edges.push({
        edgeId: buildId('edge'),
        graphId: context.graph.graphId,
        fromNodeId: evidenceNode.nodeId,
        toNodeId: node.nodeId,
        edgeType: 'supports',
        polarity: 'positive',
        weight: strengthWeight,
        rationale: ref.quote,
        createdAt: now()
      });
    });
  });

  context.evidenceItems = evidenceItems;
  context.claims = claims;
  evidenceNodes.forEach((node) => upsertNode(context, node));
  claimNodes.forEach((node) => upsertNode(context, node));
  edges.forEach((edge) => upsertEdge(context, edge));

  return { evidenceItems, claims };
};

const upsertConstraint = (context: ContextStore, claim: Claim) => {
  const registry = CONSTRAINT_REGISTRY_MAP.get(claim.normalized.key);
  if (!registry) return;
  const existing = context.constraints.find(
    (entry) => entry.key === claim.normalized.key && entry.status === 'active'
  );
  if (existing) {
    existing.status = 'superseded';
  }
  const constraint: Constraint = {
    constraintId: buildId('constraint'),
    contextVersionId: context.graph.contextVersionId,
    key: claim.normalized.key,
    value: claim.normalized.value,
    unit: claim.normalized.unit ?? registry.unit,
    datatype: claim.normalized.datatype,
    confidence: 0,
    status: 'active',
    derivedFrom: [{ claimId: claim.claimId, weight: 1 }],
    createdAt: now()
  };
  constraint.confidence = computeConstraintConfidence(constraint, context.claims);
  context.constraints.push(constraint);
  const node: GraphNode = {
    nodeId: buildId('node'),
    graphId: context.graph.graphId,
    nodeType: 'constraint',
    label: registry.label,
    confidence: constraint.confidence,
    payload: { constraintId: constraint.constraintId, key: constraint.key, datatype: constraint.datatype },
    createdAt: now()
  };
  upsertNode(context, node);

  const claimNode = context.nodes.find((entry) => entry.nodeType === 'claim' && entry.payload.claimId === claim.claimId);
  if (claimNode) {
    upsertEdge(context, {
      edgeId: buildId('edge'),
      graphId: context.graph.graphId,
      fromNodeId: claimNode.nodeId,
      toNodeId: node.nodeId,
      edgeType: 'derives',
      polarity: 'positive',
      weight: 1,
      createdAt: now()
    });
  }
};

export const updateClaim = (
  contextVersionId: string,
  claimId: string,
  update: { status: Claim['status']; correctedValue?: unknown; correctedUnit?: string }
) => {
  const context = ensureContext(contextVersionId);
  const claim = context.claims.find((entry) => entry.claimId === claimId);
  if (!claim) throw new Error(`Unknown claimId: ${claimId}`);
  claim.status = update.status;
  claim.review.reviewedBy = 'user';
  claim.review.reviewedAt = now();
  if (update.status === 'corrected' && update.correctedValue !== undefined) {
    claim.normalized.value = update.correctedValue;
    if (update.correctedUnit) claim.normalized.unit = update.correctedUnit;
    claim.review.correction = { value: update.correctedValue, unit: update.correctedUnit };
    claim.confidenceRationale = 'user corrected';
    claim.confidence = computeClaimConfidence({ ...claim, status: 'corrected' });
  } else {
    claim.confidence = computeClaimConfidence(claim);
  }

  const node = context.nodes.find((entry) => entry.nodeType === 'claim' && entry.payload.claimId === claimId);
  if (node) {
    node.confidence = claim.confidence;
  }

  if (claim.status === 'accepted' || claim.status === 'corrected') {
    if (claim.evidenceRefs.length === 0) {
      throw new Error(`Accepted claim must have evidenceRefs: ${claim.claimId}`);
    }
    upsertConstraint(context, claim);
  }
  if (claim.status === 'rejected') {
    context.constraints.forEach((constraint) => {
      if (constraint.status !== 'active') return;
      if (constraint.derivedFrom.some((entry) => entry.claimId === claim.claimId)) {
        constraint.status = 'superseded';
      }
    });
  }
};

const ensureDecisionNode = (context: ContextStore) => {
  let decisionNode = context.nodes.find((node) => node.nodeType === 'decision');
  if (!decisionNode) {
    decisionNode = {
      nodeId: buildId('node'),
      graphId: context.graph.graphId,
      nodeType: 'decision',
      label: 'Planning kickoff',
      confidence: 0,
      payload: { decisionKey: 'planning_kickoff', scope: 'planning' },
      createdAt: now()
    };
    context.nodes.push(decisionNode);
  }
  return decisionNode;
};

export const confirmConstraints = (contextVersionId: string) => {
  const context = ensureContext(contextVersionId);
  context.graph.status = 'locked';
  const decisionNode = ensureDecisionNode(context);
  const constraintNodes = context.nodes.filter((node) => node.nodeType === 'constraint');
  constraintNodes.forEach((node) => {
    const alreadyLinked = context.edges.some(
      (edge) => edge.fromNodeId === node.nodeId && edge.toNodeId === decisionNode.nodeId
    );
    if (!alreadyLinked) {
      upsertEdge(context, {
        edgeId: buildId('edge'),
        graphId: context.graph.graphId,
        fromNodeId: node.nodeId,
        toNodeId: decisionNode.nodeId,
        edgeType: 'influences',
        polarity: 'positive',
        weight: 1 / Math.max(1, constraintNodes.length),
        createdAt: now()
      });
    }
  });

  const decisionEdges = context.edges
    .filter((edge) => edge.toNodeId === decisionNode.nodeId && edge.edgeType === 'influences')
    .map((edge) => {
      const constraintNode = context.nodes.find((node) => node.nodeId === edge.fromNodeId);
      return {
        edge,
        constraintConfidence: constraintNode?.confidence ?? 0
      };
    });
  decisionNode.confidence = computeDecisionConfidence(decisionNode, decisionEdges);
  return context.constraints.filter((entry) => entry.status === 'active');
};

export const getGraph = (contextVersionId: string): EvidenceGraphSnapshot => {
  const context = ensureContext(contextVersionId);
  return {
    graph: context.graph,
    nodes: context.nodes,
    edges: context.edges
  };
};

export const getConstraints = (contextVersionId: string): Constraint[] => {
  const context = ensureContext(contextVersionId);
  return context.constraints.filter((entry) => entry.status === 'active');
};

export const getContextSnapshot = (contextVersionId: string): ContextSnapshot => {
  const context = ensureContext(contextVersionId);
  return {
    graph: context.graph,
    sources: context.sources,
    evidenceItems: context.evidenceItems,
    claims: context.claims,
    constraints: context.constraints,
    nodes: context.nodes,
    edges: context.edges
  };
};
