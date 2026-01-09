export type Phase = 'site' | 'species' | 'supply';

export type RunStatus = 'idle' | 'running' | 'blocked' | 'done' | 'error' | 'canceled';
export type StepStatus = 'queued' | 'running' | 'done' | 'blocked' | 'error' | 'skipped';
export type ActionCardType = 'deepen' | 'refine' | 'next_step';
export type ActionInputType = 'text' | 'select' | 'number' | 'boolean';
export type ActionInputSeverity = 'required' | 'recommended' | 'optional';

export interface DecisionProgram {
  id: string;
  title: string;
  description?: string;
  version: string;
  steps: DecisionStep[];
  draftMatrixTemplates?: DraftMatrix[];
  actionCardTemplates?: ActionCard[];
}

export interface DecisionStep {
  id: string;
  title: string;
  description?: string;
  kind: 'agent';
  phase: Phase;
  agentRef?: string;
  requiredPointers?: string[];
  producesPointers?: string[];
}

export interface StepState {
  stepId: string;
  status: StepStatus;
  startedAt?: string;
  endedAt?: string;
  blockingMissingInputs?: string[];
  error?: { message: string; code?: string };
  reasoningSummary?: string[];
}

export interface EvidenceSource {
  id: string;
  title: string;
  fileId?: string;
  url?: string;
  pageStart?: number;
  pageEnd?: number;
  quote?: string;
  retrievedAt?: string;
}

export interface CitationLocator {
  page?: number;
  section?: string;
  row?: string;
}

export interface Citation {
  sourceId: string;
  locator?: CitationLocator;
  confidence?: number;
}

export type EvidenceKind = 'regulatory' | 'equity' | 'biophysical' | 'site';

export interface EvidenceItem {
  id: string;
  kind: EvidenceKind;
  claim: string;
  citations: Citation[];
}

export type EvidenceNodeType = 'source' | 'claim' | 'constraint' | 'skill' | 'artifact' | 'decision';

export interface EvidenceNode {
  id: string;
  type: EvidenceNodeType;
  label: string;
  description?: string;
  metadata?: Record<string, any>;
}

export type EvidenceEdgeType =
  | 'supports'
  | 'derived_from'
  | 'influences'
  | 'produced_by'
  | 'filters'
  | 'scores'
  | 'conflicts_with';

export interface EvidenceEdge {
  from: string;
  to: string;
  type: EvidenceEdgeType;
  weight?: number;
  confidence?: number;
}

export interface EvidenceGraph {
  nodes: EvidenceNode[];
  edges: EvidenceEdge[];
}

export interface ArtifactRef {
  id: string;
  kind: 'constraints' | 'shortlist' | 'scoring' | 'map' | 'supplyStatus';
  label: string;
  href: string;
}

export interface TimelineEntry {
  id: string;
  stepId?: string;
  phase?: Phase;
  title?: string;
  summary: string;
  keyFindings: string[];
  evidence: EvidenceItem[];
  artifacts?: ArtifactRef[];
  status: 'running' | 'done' | 'needs_input' | 'error';
  createdAt: string;
}

export interface DerivedConstraints {
  regulatory: {
    setting?: string | null;
    saltToleranceRequired?: boolean | null;
    protectedZone?: boolean | null;
    permitNeeded?: boolean | null;
    maxHeightClass?: string | null;
    notes?: string | null;
  };
  site: {
    lightExposure?: string | null;
    soilType?: string | null;
    moisture?: string | null;
    compactionRisk?: string | null;
    rootingVolumeClass?: string | null;
    crownClearanceClass?: string | null;
    utilitiesPresent?: boolean | null;
    setbacksKnown?: boolean | null;
  };
  equity: {
    priorityZones?: string | null;
    heatVulnerability?: string | null;
    asthmaBurden?: string | null;
    underservedFlag?: boolean | null;
  };
  biophysical: {
    canopyCover?: number | null;
    lstClass?: string | null;
    distanceToPaved?: string | null;
    floodRisk?: string | null;
  };
  meta: {
    derivedFrom: EvidenceItem[];
    confidenceByField?: Record<string, number>;
  };
}

export interface DerivedInput {
  pointer: string;
  value: unknown;
  confidence?: number;
  evidenceItemIds?: string[];
  timelineEntryId?: string;
}

export interface EvidenceFileRef {
  id: string;
  title?: string;
  fileId?: string;
  url?: string;
  content?: string;
  file?: File;
  sourceType?: string;
}

export interface EvidenceRef {
  sourceId: string;
  sourceType?: string;
  locationHint?: string;
  pointer?: string;
  note?: string;
  claim?: string;
  citations?: Citation[];
  evidenceItemId?: string;
}

export interface DraftMatrixColumn {
  id: string;
  label: string;
  kind: 'trait' | 'constraint' | 'score' | 'compliance' | 'supply';
  datatype: 'string' | 'number' | 'boolean' | 'enum' | 'range';
  why?: string;
  pinned?: boolean;
  visible?: boolean;
  skillId?: string;
  skillArgs?: Record<string, unknown>;
  skillMetadata?: {
    kind: 'skill';
    skillId: string;
    inputContract?: Record<string, unknown>;
  };
}

export interface DraftMatrixCell {
  columnId: string;
  value: string | number | boolean | null;
  rationale?: string;
  evidence?: EvidenceRef[];
  confidence?: number;
  flags?: string[];
}

export interface DraftMatrixRow {
  id: string;
  label?: string;
  cells: DraftMatrixCell[];
}

export interface DraftMatrix {
  id: string;
  title?: string;
  columns: DraftMatrixColumn[];
  rows: DraftMatrixRow[];
}

export interface ActionCard {
  id: string;
  type: ActionCardType;
  title: string;
  description: string;
  inputs?: ActionCardInput[];
  suggestedActions?: ActionCardSuggestedAction[];
}

export interface ActionCardInput {
  id: string;
  pointer: string;
  label: string;
  type: ActionInputType;
  severity?: ActionInputSeverity;
  required?: boolean;
  placeholder?: string;
  options?: string[];
  helpText?: string;
  impactNote?: string;
}

export interface ActionCardSuggestedAction {
  label: string;
  action: string;
  icon?: string;
}

export interface PointerPatch {
  pointer: string;
  value: unknown;
}

export interface ExecutionContext {
  site: Record<string, unknown>;
  regulatory: Record<string, unknown>;
  equity: Record<string, unknown>;
  species: Record<string, unknown>;
  supply: Record<string, unknown>;
  selectedDocs?: EvidenceFileRef[];
}

export interface ExecutionLogEntry {
  level: 'info' | 'warn' | 'error';
  message: string;
  data?: Record<string, unknown>;
  timestamp: string;
}

export interface ExecutionState {
  runId: string;
  programId: string;
  status: RunStatus;
  startedAt?: string;
  endedAt?: string;
  currentStepId?: string;
  steps: StepState[];
  context: ExecutionContext;
  draftMatrix?: DraftMatrix;
  actionCards: ActionCard[];
  logs: ExecutionLogEntry[];
  evidenceIndex?: Record<string, EvidenceRef[]>;
  evidenceSources?: EvidenceSource[];
  evidenceItems?: EvidenceItem[];
  evidenceGraph?: EvidenceGraph;
  timelineEntries?: TimelineEntry[];
  derivedConstraints?: DerivedConstraints;
  derivedInputs?: Record<string, DerivedInput>;
}
