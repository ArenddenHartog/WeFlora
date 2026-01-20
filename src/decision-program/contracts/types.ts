// src/decision-program/contracts/types.ts
// Phase-1 (agent-first) contract types for: AgentProfile, FlowTemplate, EventRecord
// Goal: Living Record UI is a pure renderer over EventRecord[]; runtime Agents remain separate.

export type UUID = string;
export type ISO8601 = string; // e.g. "2026-01-19T11:00:00.000Z"

/** Stable semantic version for profiles/templates (contract evolution). */
export type SemVer = `${number}.${number}.${number}`;

/** JSON Schema draft-07-ish shape (enough for UI rendering + validation tooling). */
export type JsonSchema = {
  $id?: string;
  $schema?: string;
  title?: string;
  description?: string;
  type?: string | string[];
  required?: string[];
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema | JsonSchema[];
  enum?: Array<string | number | boolean | null>;
  const?: unknown;
  additionalProperties?: boolean | JsonSchema;
  oneOf?: JsonSchema[];
  anyOf?: JsonSchema[];
  allOf?: JsonSchema[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;
  examples?: unknown[];
};

/** JSON Pointer (RFC 6901) into a payload/state object. */
export type JsonPointer = `/${string}`;

/** Confidence is intentionally coarse for product UX. */
export type ConfidenceLevel = 'low' | 'medium' | 'high';

/** Common output modes across skills. */
export type OutputMode = 'ok' | 'insufficient_data' | 'rejected' | 'error';

/** Evidence primitives used by all agents/steps. */
export interface EvidenceRef {
  id: string; // stable within a run
  kind: 'file' | 'url' | 'dataset' | 'policy' | 'note';
  title: string;
  uri?: string; // signed URL, external URL, or internal file ref
  excerpt?: string; // keep short; UI shows full via expansion route if needed
  page?: number; // for PDFs
  created_at: ISO8601;
}

/** Assumption primitives used by all agents/steps. */
export interface Assumption {
  id: string;
  claim: string;
  basis: 'planner_provided' | 'proxy' | 'heuristic' | 'inferred' | 'unknown';
  confidence: ConfidenceLevel;
  how_to_validate: string;
  owner: 'weflora' | 'user' | 'external';
}

/** A machine-readable "what changed" record: pointers written and optional diffs. */
export interface PointerWrite {
  pointer: JsonPointer;
  op: 'add' | 'replace' | 'remove' | 'merge';
  /** Optional hash for large payload blobs to keep events slim. */
  content_hash?: string;
  /** Optional short preview for UI (never required). */
  preview?: string;
}

/** A normalized output envelope (every agent returns this shape). */
export interface OutputEnvelope<TPayload = unknown> {
  mode: OutputMode;
  confidence: ConfidenceLevel;

  /** Human-readable short conclusion (1–3 sentences). */
  summary: string;

  /** Strict, contract-validated payload from the agent. */
  payload: TPayload;

  evidence: EvidenceRef[];
  assumptions: Assumption[];

  /** What the agent wrote back to the run payload/state. */
  writes: PointerWrite[];

  /** Missing inputs (esp. for insufficient_data) */
  missing?: Array<{
    field: string; // e.g. "region" or "policyScope"
    reason: string;
    expected?: string; // small guidance
  }>;

  /** Optional internal diagnostics; never rendered by default. */
  debug?: {
    model?: string;
    latency_ms?: number;
    tokens_in?: number;
    tokens_out?: number;
  };
}

/* =========================
   AgentProfile (Skill)
   ========================= */

export type AgentCategory =
  | 'compliance'
  | 'water'
  | 'climate_resilience'
  | 'risk'
  | 'biodiversity'
  | 'maintenance'
  | 'planning'
  | 'operations'
  | 'documentation'
  | 'site'
  | 'other';

/** How an input is provided: direct value, file, or pointer from run payload. */
export type InputSourceKind = 'value' | 'pointer' | 'file';

export interface InputFieldSpec {
  /** Stable field name used in UI + runner. */
  key: string;

  label: string;
  description?: string;

  required: boolean;

  /** Where the value comes from. */
  source: InputSourceKind;

  /** If source === 'pointer' */
  pointer?: JsonPointer;

  /** If source === 'file' */
  file?: {
    accept?: string[]; // e.g. ['text/csv','application/pdf']
    maxBytes?: number;
    multiple?: boolean;
  };

  /** Lightweight UI hints. */
  ui?: {
    control?: 'text' | 'textarea' | 'select' | 'checkbox' | 'number' | 'json';
    placeholder?: string;
    options?: Array<{ label: string; value: string }>;
  };

  /** JSON schema for the field’s value (for validation + auto-form). */
  schema: JsonSchema;

  /** Example values to render on Skill page. */
  examples?: unknown[];
}

export interface OutputSpec {
  /** JSON schema of OutputEnvelope.payload ONLY (envelope is fixed). */
  payload_schema: JsonSchema;

  /** Supported modes for this agent (typically ok + insufficient_data; some include rejected). */
  modes: OutputMode[];

  /** Additional UI hints on how to render the payload. */
  ui?: {
    render_as?: 'badge' | 'enum' | 'score' | 'currency' | 'text' | 'json' | 'table';
    primary_fields?: string[]; // keys within payload to surface
  };
}

export interface FixtureSet {
  /** Minimal valid inputs to produce a meaningful ok output (for docs/tests). */
  minimal_ok_input: Record<string, unknown>;

  /** Example outputs for UI mocks and regression tests. */
  example_outputs: {
    ok: OutputEnvelope;
    insufficient_data: OutputEnvelope;
    rejected?: OutputEnvelope;
    error?: OutputEnvelope;
  };
}

export interface AgentProfile {
  /** Stable registry id (namespaced). */
  id: string; // e.g. "compliance.policy_grounded"

  title: string;
  description: string;

  category: AgentCategory;

  /** Tagging for discovery. */
  tags: string[];

  /** Contract + schema versioning. */
  spec_version: SemVer; // semantic changes in behavior/contract
  schema_version: SemVer; // semantic changes in schema shapes

  /** Declares what the runtime agent reads/writes in the payload (for safety + UX). */
  reads: JsonPointer[];
  writes: JsonPointer[];

  /** The auto-generated input form spec for running this agent standalone or in a flow. */
  inputs: InputFieldSpec[];

  /** Strict output schema patterns. */
  output: OutputSpec;

  /** Optional fixtures for UI + tests. */
  fixtures?: FixtureSet;

  /** Operational notes: when to use, limitations, and how to get to "ok". */
  notes?: {
    when_to_use?: string[];
    limitations?: string[];
    data_requirements?: string[];
  };
}

/* =========================
   FlowTemplate (pre-engineered agent strings)
   ========================= */

export type FlowMode = 'operated' | 'assistive';

export interface FlowStepTemplate {
  /** Stable step id within the flow template. */
  step_id: string; // e.g. "site_constraints"

  /** References AgentProfile.id */
  agent_id: string;

  /** Optional pinned versions to ensure reproducibility. */
  agent_spec_version?: SemVer;
  agent_schema_version?: SemVer;

  /** Optional per-step config (deterministic knobs). */
  config?: Record<string, unknown>;

  /** Optional overrides for input fields (e.g., pointer mapping or defaults). */
  input_overrides?: Partial<Record<string, Partial<InputFieldSpec>>>;

  /** Expected pointers written (sanity checks, progress UI). */
  expected_writes?: JsonPointer[];

  /** Step gating: allow skipping if insufficient data or a prior condition. */
  gate?: {
    /** Evaluate using a pointer in payload; if falsey, skip. */
    requires_pointer?: JsonPointer;
    /** If prior step output mode is in list, skip/stop. */
    skip_if_prior_mode_in?: OutputMode[];
    /** If missing inputs, mark as "needs_review" rather than failing. */
    soft_fail?: boolean;
  };
}

export interface FlowTemplate {
  id: string; // e.g. "flow.planner_pack_ppp"
  title: string;
  description: string;

  mode: FlowMode;

  /** Personas this flow is designed for. */
  personas: Array<'urban_planner' | 'arborist' | 'municipal_professional' | 'consultant' | 'other'>;

  /** Top-level inputs required to kick off the flow. */
  inputs: InputFieldSpec[];

  /** Ordered step templates (agent string). */
  steps: FlowStepTemplate[];

  /** Success criteria = what makes this flow "submission ready". */
  success?: {
    required_artifact_types?: string[]; // e.g. ['memo','options','procurement']
    required_pointer_paths?: JsonPointer[];
    max_high_risk_assumptions?: number;
  };

  /** Versioning for template evolution. */
  template_version: SemVer;

  /** Discovery tags. */
  tags: string[];

  /** UI hints for how to present in Flows list. */
  ui?: {
    icon?: string;
    accent?: 'mint' | 'slate' | 'amber' | 'red';
  };
}

/* =========================
   EventRecord (Step Ledger)
   Living Record UI renders this ONLY.
   ========================= */

export type RunStatus = 'queued' | 'running' | 'partial' | 'complete' | 'failed' | 'cancelled';

export interface RunRef {
  run_id: UUID;
  scope_id: UUID | string; // allow non-uuid during early phases (e.g. demo scopes)
  flow_id?: string; // FlowTemplate.id
  title: string;
  created_at: ISO8601;
  status: RunStatus;
}

export type EventKind =
  | 'run.created'
  | 'run.status_changed'
  | 'step.started'
  | 'step.input_snapshot'
  | 'step.output'
  | 'step.evidence'
  | 'step.assumptions'
  | 'step.pointers_written'
  | 'artifact.created'
  | 'action.proposed'
  | 'action.executed'
  | 'step.failed'
  | 'run.completed';

export interface BaseEventRecord {
  /** Stable id for ordering + dedupe. */
  id: UUID;

  run_id: UUID;
  scope_id: UUID | string;

  /** Monotonic-ish ordering; can be ULID if you want sortable ids. */
  created_at: ISO8601;

  kind: EventKind;

  /** Optional grouping for steps. */
  step_id?: UUID; // runtime step execution id
  flow_step_id?: string; // FlowStepTemplate.step_id

  /** Who/what produced the event. */
  actor: 'system' | 'user' | 'agent' | 'ops' | 'connector';

  /** Optional link to the skill/agent that generated it. */
  agent_id?: string; // AgentProfile.id
  agent_spec_version?: SemVer;
  agent_schema_version?: SemVer;
}

/** Snapshot of what a step saw (resolved inputs). */
export interface StepInputSnapshotEvent extends BaseEventRecord {
  kind: 'step.input_snapshot';
  data: {
    /** Resolved, redacted-safe inputs. */
    inputs: Record<string, unknown>;
    /** Pointers read to build inputs. */
    reads: JsonPointer[];
  };
}

/** Output event is the canonical envelope (UI can render summary + payload). */
export interface StepOutputEvent extends BaseEventRecord {
  kind: 'step.output';
  data: {
    output: OutputEnvelope;
  };
}

/** Evidence-only event (optional if you embed evidence in output, but useful for streaming). */
export interface StepEvidenceEvent extends BaseEventRecord {
  kind: 'step.evidence';
  data: {
    evidence: EvidenceRef[];
  };
}

export interface StepAssumptionsEvent extends BaseEventRecord {
  kind: 'step.assumptions';
  data: {
    assumptions: Assumption[];
  };
}

export interface StepPointersWrittenEvent extends BaseEventRecord {
  kind: 'step.pointers_written';
  data: {
    writes: PointerWrite[];
  };
}

export interface StepStartedEvent extends BaseEventRecord {
  kind: 'step.started';
  data: {
    label?: string;
  };
}

export interface StepFailedEvent extends BaseEventRecord {
  kind: 'step.failed';
  data: {
    error: {
      code?: string;
      message: string;
      stack?: string;
    };
    retryable?: boolean;
  };
}

/** Artifacts are first-class outcomes, created by agents/ops/workflows. */
export interface ArtifactRecord {
  id: UUID;
  run_id: UUID;
  scope_id: UUID | string;

  type: string; // e.g. "memo" | "options" | "procurement" | "species_mix" | ...
  version: number;

  title: string;
  mime_type: string; // "text/markdown", "application/pdf", etc.

  /** Either inline content or pointer to stored blob. */
  content?: string;
  content_uri?: string;
  content_hash?: string;

  /** Provenance: which agent/step created it. */
  created_at: ISO8601;
  created_by: 'agent' | 'ops' | 'user' | 'system';
  agent_id?: string;
  step_id?: UUID;
}

export interface ArtifactCreatedEvent extends BaseEventRecord {
  kind: 'artifact.created';
  data: {
    artifact: ArtifactRecord;
  };
}

/** Actions are operational side-effects (emails, tickets, procurement exports). */
export type ActionKind =
  | 'email.send'
  | 'ticket.create'
  | 'file.export'
  | 'procurement.request_quote'
  | 'webhook.call'
  | 'other';

export interface ActionRecord {
  id: UUID;
  run_id: UUID;
  scope_id: UUID | string;

  kind: ActionKind;
  title: string;

  status: 'proposed' | 'executed' | 'failed';

  /** Human-readable preview (safe). */
  preview?: string;

  /** Machine params to execute (may be redacted for UI). */
  params?: Record<string, unknown>;

  created_at: ISO8601;
  executed_at?: ISO8601;

  created_by: 'agent' | 'ops' | 'user' | 'system';
  agent_id?: string;
  step_id?: UUID;

  error?: { message: string; code?: string };
}

export interface ActionProposedEvent extends BaseEventRecord {
  kind: 'action.proposed';
  data: { action: ActionRecord };
}

export interface ActionExecutedEvent extends BaseEventRecord {
  kind: 'action.executed';
  data: { action: ActionRecord };
}

export interface RunCreatedEvent extends BaseEventRecord {
  kind: 'run.created';
  data: RunRef;
}

export interface RunStatusChangedEvent extends BaseEventRecord {
  kind: 'run.status_changed';
  data: { from: RunStatus; to: RunStatus };
}

export interface RunCompletedEvent extends BaseEventRecord {
  kind: 'run.completed';
  data: { status: RunStatus; summary?: string };
}

/** Union: the only thing the Living Record renderer needs. */
export type EventRecord =
  | RunCreatedEvent
  | RunStatusChangedEvent
  | StepStartedEvent
  | StepInputSnapshotEvent
  | StepOutputEvent
  | StepEvidenceEvent
  | StepAssumptionsEvent
  | StepPointersWrittenEvent
  | ArtifactCreatedEvent
  | ActionProposedEvent
  | ActionExecutedEvent
  | StepFailedEvent
  | RunCompletedEvent;

/* =========================
   Convenience helpers (optional)
   ========================= */

export const isStepEvent = (e: EventRecord): boolean => !!e.step_id;

export const isArtifactEvent = (e: EventRecord): e is ArtifactCreatedEvent => e.kind === 'artifact.created';

export const isActionEvent = (e: EventRecord): e is ActionProposedEvent | ActionExecutedEvent =>
  e.kind === 'action.proposed' || e.kind === 'action.executed';
