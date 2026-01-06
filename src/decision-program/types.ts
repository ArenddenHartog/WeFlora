export type Phase = 'site' | 'species' | 'supply';

export type RunStatus = 'idle' | 'running' | 'blocked' | 'done' | 'error' | 'canceled';
export type StepStatus = 'queued' | 'running' | 'done' | 'blocked' | 'error' | 'skipped';
export type ActionCardType = 'deepen' | 'refine' | 'next_step';
export type ActionInputType = 'text' | 'select' | 'number' | 'boolean';

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
}

export interface EvidenceRef {
  sourceId: string;
  sourceType?: string;
  locationHint?: string;
  pointer?: string;
  note?: string;
}

export interface DraftMatrixColumn {
  id: string;
  label: string;
  kind: 'trait' | 'constraint' | 'score' | 'compliance' | 'supply';
  datatype: 'string' | 'number' | 'boolean' | 'enum' | 'range';
  why?: string;
  pinned?: boolean;
  visible?: boolean;
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
  required?: boolean;
  placeholder?: string;
  options?: string[];
  helpText?: string;
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
  selectedDocs?: Array<Record<string, unknown>>;
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
}
