export type GraphStatus = 'draft' | 'locked';
export type SourceType = 'file' | 'location_hint' | 'api' | 'manual_note';
export type EvidenceKind = 'text_span' | 'table' | 'table_row' | 'map_feature' | 'image_region';
export type ClaimDomain = 'regulatory' | 'biophysical' | 'equity' | 'supply' | 'other';
export type ClaimType = 'fact' | 'threshold' | 'requirement' | 'classification' | 'inference';
export type ClaimStatus = 'proposed' | 'accepted' | 'corrected' | 'rejected';
export type ConstraintStatus = 'active' | 'superseded';
export type NodeType = 'source' | 'evidence' | 'claim' | 'constraint' | 'decision' | 'artifact';
export type EdgeType = 'cites' | 'supports' | 'derives' | 'influences' | 'conflicts' | 'explains';
export type EdgePolarity = 'positive' | 'negative' | 'neutral';

export interface Graph {
  graphId: string;
  contextId: string;
  contextVersionId: string;
  createdAt: string;
  createdBy: 'system' | 'user';
  status: GraphStatus;
}

export interface Source {
  sourceId: string;
  contextVersionId: string;
  type: SourceType;
  title: string;
  uri?: string;
  mimeType?: string;
  hash?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface EvidenceItem {
  evidenceId: string;
  contextVersionId: string;
  sourceId: string;
  kind: EvidenceKind;
  locator: {
    page?: number;
    section?: string;
    row?: number;
    col?: string;
    bbox?: [number, number, number, number];
    featureId?: string;
  };
  text?: string;
  data?: Record<string, unknown>;
  embeddingRef?: string;
  createdAt: string;
}

export interface Claim {
  claimId: string;
  contextVersionId: string;
  domain: ClaimDomain;
  claimType: ClaimType;
  statement: string;
  normalized: {
    key: string;
    value: unknown;
    unit?: string;
    datatype: 'number' | 'string' | 'boolean' | 'enum' | 'range' | 'geo' | 'json';
  };
  confidence: number;
  confidenceRationale: string;
  status: ClaimStatus;
  review: {
    reviewedBy?: 'system' | 'user';
    reviewedAt?: string;
    correction?: { value: unknown; unit?: string };
  };
  evidenceRefs: Array<{
    evidenceId: string;
    quote?: string;
    strength: 'direct' | 'supporting' | 'weak';
  }>;
  createdAt: string;
}

export interface Constraint {
  constraintId: string;
  contextVersionId: string;
  key: string;
  value: unknown;
  unit?: string;
  datatype: 'number' | 'string' | 'boolean' | 'enum' | 'range' | 'geo' | 'json';
  confidence: number;
  status: ConstraintStatus;
  derivedFrom: Array<{ claimId: string; weight: number }>;
  createdAt: string;
}

export interface GraphNode {
  nodeId: string;
  graphId: string;
  nodeType: NodeType;
  label: string;
  confidence: number | null;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface GraphEdge {
  edgeId: string;
  graphId: string;
  fromNodeId: string;
  toNodeId: string;
  edgeType: EdgeType;
  polarity: EdgePolarity;
  weight: number;
  rationale?: string;
  createdAt: string;
}

export interface EvidenceGraphSnapshot {
  graph: Graph;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface ContextSnapshot {
  graph: Graph;
  sources: Source[];
  evidenceItems: EvidenceItem[];
  claims: Claim[];
  constraints: Constraint[];
  nodes: GraphNode[];
  edges: GraphEdge[];
}
