import type {
  UUID,
  ISO8601,
  ScopeId,
  Json,
  PointerPath,
  Confidence,
  StepStatus,
  Provenance,
  SemVer,
} from './primitives';
import type { VaultPointer } from './vault';

/**
 * A Session is "one living record": a run + its event stream.
 */
export interface Session {
  session_id: UUID;
  scope_id: ScopeId;
  run_id: UUID;

  title: string;

  status: 'running' | 'complete' | 'partial' | 'failed' | 'canceled';
  created_at: ISO8601;
  created_by: Provenance;

  // denormalized for list pages
  last_event_at?: ISO8601;
  summary?: string;
  tags?: string[];
}

/**
 * Every event is immutable, append-only.
 * UI MUST be able to render a meaningful timeline from these alone.
 */
export interface EventRecordBase {
  event_id: UUID;
  scope_id: ScopeId;
  session_id: UUID;
  run_id: UUID;

  at: ISO8601;
  by: Provenance;

  // Ordering (monotonic per session). Can be DB sequence or computed.
  seq: number;

  // For backward/forward compatibility
  event_version: SemVer; // "1.0.0"
}

/**
 * Pointer mutation: the canonical representation of "data flow".
 * Example: write /outputs/compliance -> vault pointer
 */
export interface PointerMutation {
  op: 'set' | 'unset' | 'append';
  path: PointerPath;
  value?: VaultPointer; // required for set/append
  reason?: string;
}

export interface EvidenceRef {
  kind: 'vault' | 'url' | 'inline';
  label: string;
  // For vault evidence: pointer to a doc chunk / policy clause / dataset row range
  pointer?: VaultPointer;
  url?: string;
  // Strict limit: inline evidence should be short
  inline_excerpt?: string;
}

export interface Assumption {
  statement: string;
  // Optional: where the assumption came from
  basis?: EvidenceRef[];
  // What to do next
  validate_next?: string;
}

export interface ActionRequest {
  // "Actions" are executable intents; they may later become actual integrations.
  action_id: string; // e.g. "export.report", "create.worksheet", "notify.stakeholder"
  label: string;
  payload?: Json;
}

/**
 * === Event Types ===
 * Keep the set small. Extend via payload schemas if needed.
 */

// 1) System level lifecycle
export interface RunStartedEvent extends EventRecordBase {
  type: 'run.started';
  payload: {
    title: string;
    kind: 'skill' | 'flow' | 'agent_string';
    skill_id?: string;
    flow_id?: string;
    agent_ids?: string[];
    input_bindings: Record<PointerPath, VaultPointer>;
  };
}

export interface RunCompletedEvent extends EventRecordBase {
  type: 'run.completed';
  payload: {
    status: 'complete' | 'partial' | 'failed' | 'canceled';
    summary?: string;
    output_pointers?: Record<PointerPath, VaultPointer>;
  };
}

// 2) Ops events (deterministic preprocessing)
export interface OpsJobEvent extends EventRecordBase {
  type: 'ops.job';
  payload: {
    job_id: UUID;
    op_id: string; // e.g. "parse.pdf", "normalize.inventory"
    status: 'queued' | 'running' | 'complete' | 'failed' | 'skipped';
    inputs?: VaultPointer[];
    outputs?: VaultPointer[];
    message?: string;
    error?: { code: string; message: string; details?: Json };
  };
}

// 3) Step lifecycle (agent execution is step-based even for single-skill runs)
export interface StepStartedEvent extends EventRecordBase {
  type: 'step.started';
  payload: {
    step_id: UUID;
    step_index: number; // 1..n within the session
    agent_id: string; // Skill ID
    title?: string; // human readable name
    // Inputs as pointers (resolved at start)
    inputs: Record<PointerPath, VaultPointer>;
  };
}

export interface StepCompletedEvent extends EventRecordBase {
  type: 'step.completed';
  payload: {
    step_id: UUID;
    step_index: number;
    agent_id: string;

    status: StepStatus;
    confidence?: Confidence;

    // Human-readable "what happened" (strict flows: neutral tone)
    summary: string;

    // Contracted output stored as a Vault agent_output record
    output?: {
      pointer: VaultPointer; // points to vault kind=agent_output
      schema_id: string;
      schema_version: SemVer;
    };

    // Pointer-level writes/changes caused by this step (canonical data flow)
    mutations: PointerMutation[];

    // Evidence and assumptions are always first-class
    evidence?: EvidenceRef[];
    assumptions?: Assumption[];

    // Optional: requests to do something next (UI renders as buttons)
    actions?: ActionRequest[];

    // For insufficient_data only (strict rule: interactions appear here)
    insufficient_data?: {
      missing: Array<{ path: PointerPath; label: string; hint?: string }>;
      recommended_next: Array<{ label: string; suggested_input?: string; binds_to?: PointerPath }>;
    };

    error?: { code: string; message: string; details?: Json };
  };
}

// 4) Human interaction / note / decision
export interface NoteEvent extends EventRecordBase {
  type: 'note.added';
  payload: {
    title?: string;
    body: string;
    attaches?: VaultPointer[]; // user attached evidence
  };
}

export interface BindingUpdatedEvent extends EventRecordBase {
  type: 'bindings.updated';
  payload: {
    changes: Array<{
      path: PointerPath;
      before?: VaultPointer;
      after?: VaultPointer;
      reason?: string;
    }>;
  };
}

// 5) Artifact emitted (worksheet/report/pack)
export interface ArtifactEmittedEvent extends EventRecordBase {
  type: 'artifact.emitted';
  payload: {
    artifact_kind: 'worksheet' | 'report' | 'planner_pack' | 'export';
    title: string;
    pointer: VaultPointer; // points to vault kind=artifact
    derived_from_steps?: UUID[];
  };
}

export type EventRecord =
  | RunStartedEvent
  | RunCompletedEvent
  | OpsJobEvent
  | StepStartedEvent
  | StepCompletedEvent
  | NoteEvent
  | BindingUpdatedEvent
  | ArtifactEmittedEvent;

/**
 * Derived helper used by renderer: a flattened "timeline item" can be produced
 * by grouping step.started + step.completed etc. (in UI only).
 */
export interface LedgerStream {
  session: Session;
  events: EventRecord[];
}
