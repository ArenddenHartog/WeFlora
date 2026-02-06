/**
 * Agent Reasoning Spine — Event → Evidence → Outcome graph
 *
 * This is the canonical "reasoning spine" the product renders, stores,
 * and will later power Frontier orchestration.
 *
 * Core idea:
 * - Events are the timeline (immutable facts about what happened)
 * - Evidence is the provenance (what sources were used and how)
 * - Outcomes are the user-facing results (artifacts/actions/decisions)
 * - Everything ties together with pointers and edges.
 *
 * Rendering rule:
 * - Outcome column renders OutcomeRecord sorted by importance
 * - Evidence column renders EvidenceRecord grouped by vault object + pointers
 * - Timeline is EventRecord, but user mostly reads Outcomes + Evidence
 *
 * Runner contract:
 * - Runner MUST only emit Events/Evidence/Outcomes — UI renders them blindly.
 * - Minimum required events: run.started, step.started, evidence.candidates_ranked,
 *   evidence.bound, reasoning.step, outcome.proposed, outcome.finalized,
 *   step.completed, run.completed
 */

import type { UUID, ISO8601, ScopeId, Json, PointerPath, Confidence } from './primitives';
import type { VaultPointer } from './vault';

/* ─── Identifiers ─────────────────────────────────────── */
export type RunId = UUID;
export type EventId = UUID;
export type VaultObjectId = UUID;
export type AgentId = string;
export type FlowId = string;
export type JsonPointer = PointerPath;

/* ─── Event kinds (timeline) ──────────────────────────── */
export type ReasoningEventKind =
  | 'run.started'
  | 'run.completed'
  | 'run.failed'
  | 'step.started'
  | 'step.completed'
  | 'step.failed'
  | 'evidence.candidates_ranked'
  | 'evidence.bound'
  | 'reasoning.step'
  | 'outcome.proposed'
  | 'outcome.finalized'
  | 'artifact.emitted'
  | 'action.requested'
  | 'action.completed'
  | 'vault.mutated';

/**
 * ReasoningEvent — canonical event for the reasoning timeline.
 *
 * Compatible with the existing EventRecord union type in ledger.ts.
 * This type can be derived from EventRecord for rendering purposes.
 */
export interface ReasoningEvent {
  event_id: EventId;
  run_id: RunId;
  ts: ISO8601;
  kind: ReasoningEventKind;

  // Who/what
  agent_id?: AgentId;
  flow_id?: FlowId;
  step_id?: string;

  // What changed in the payload graph
  reads?: JsonPointer[];
  writes?: JsonPointer[];

  // What the renderer needs for the Living Record
  title: string;
  summary?: string;
  data?: unknown;

  // Linkage
  evidence_ids?: string[];
  outcome_ids?: string[];
  trace_id?: string;
}

/* ─── Evidence kinds (provenance) ─────────────────────── */
export type EvidenceKind =
  | 'vault.object'
  | 'vault.extract'
  | 'policy.citation'
  | 'tool.call'
  | 'user.input';

/**
 * EvidenceRecord — what sources were used and how.
 *
 * Grouped by vault object in the UI evidence column.
 * Provenance enables document viewer overlays (future).
 *
 * Every bound input MUST produce at least one EvidenceRecord with:
 * - kind: 'vault.object', vault_object_id, stable evidence_id
 * - provenance if available (page/line/char spans)
 */
export interface EvidenceRecord {
  evidence_id: string;
  run_id: RunId;
  ts: ISO8601;
  kind: EvidenceKind;

  // Source reference (vault object id, tool call id, or user input id)
  source_ref?: string;

  // Vault binding
  vault_object_id?: VaultObjectId;
  pointer?: JsonPointer;

  // Provenance (document viewer overlays later)
  provenance?: {
    file_page?: number;
    char_start?: number;
    char_end?: number;
    line_start?: number;
    line_end?: number;
    quote?: string;
  };

  confidence?: number;
  relevance?: 'high' | 'medium' | 'low';

  // Relevance + confidence snapshots at time of use
  score_snapshot?: {
    relevance: number;
    confidence: number;
    coverage: number;
    recency: number;
    total: number;
  };

  // Tool provenance
  tool?: {
    name: string;
    input_hash?: string;
    output_hash?: string;
  };

  // User input provenance
  user_input?: {
    field_key: string;
    value: unknown;
  };

  // Human-readable label
  label?: string;
}

/* ─── Outcome kinds (results) ─────────────────────────── */
export type OutcomeKind =
  | 'table'
  | 'memo'
  | 'score'
  | 'badge'
  | 'enum'
  | 'json'
  | 'action';

/**
 * OutcomeRecord — user-facing results.
 *
 * Ties to AgentProfile.output.ui.render_as.
 * Headline + structured result displayed in Outcome column.
 *
 * Every run MUST produce at least one OutcomeRecord with:
 * - headline, summary, confidence, render_as, references to evidence_ids
 */
export interface OutcomeRecord {
  outcome_id: string;
  run_id: RunId;
  ts: ISO8601;
  kind: OutcomeKind;

  // Render contract: ties to AgentProfile.output.ui.render_as
  render_as: 'badge' | 'enum' | 'score' | 'currency' | 'text' | 'json' | 'table';

  // Primary payload (what user sees first)
  headline: string;
  summary?: string;
  result: unknown;

  // Confidence: 0–1 or null with explicit reason
  confidence?: number | null;
  confidence_reason?: string;

  // Explainability (strict flows: neutral, citations preferred)
  explanation?: string;
  evidence_ids?: string[];

  // Artifact handshake (jump to Worksheets/Reports/etc.)
  artifact?: {
    type: 'draft_matrix' | 'report' | 'memo' | 'export' | 'external_action';
    target_route?: string;
    target_id?: string;
  };
}

/* ─── Candidate Score Breakdown (explainability) ──────── */
export interface CandidateScoreBreakdown {
  object_id: string;
  label: string;
  relevance: number;
  confidence: number;
  coverage: number;
  recency: number;
  total: number;
  selected: boolean;
  reason?: string;
}

/* ─── Reasoning Graph (the complete spine) ────────────── */
export interface ReasoningGraph {
  run_id: RunId;
  events: ReasoningEvent[];
  evidence: EvidenceRecord[];
  outcomes: OutcomeRecord[];
}

/**
 * RunnerResult — canonical output contract for all runner modes.
 *
 * Runner returns ONLY this. UI renders from the graph blindly.
 */
export interface RunnerResult {
  graph: ReasoningGraph;
  /** Whether the run completed fully or was interrupted */
  status: 'complete' | 'partial' | 'failed';
  /** Optional diagnostic message */
  message?: string;
}

/* ─── Helpers: extract reasoning graph from EventRecord[] ─ */
import type { EventRecord, StepCompletedEvent, EvidenceRef } from './ledger';

/**
 * Extract a ReasoningGraph from the existing EventRecord[] stream.
 *
 * This bridges the existing ledger format to the new reasoning spine,
 * allowing the Session renderer to use the structured types.
 */
export function extractReasoningGraph(events: EventRecord[]): ReasoningGraph {
  const run_id = events[0]?.run_id ?? '';
  const reasoningEvents: ReasoningEvent[] = [];
  const evidence: EvidenceRecord[] = [];
  const outcomes: OutcomeRecord[] = [];

  events.forEach((event) => {
    // Convert to ReasoningEvent
    const re: ReasoningEvent = {
      event_id: event.event_id,
      run_id: event.run_id,
      ts: event.at,
      kind: event.type as ReasoningEventKind,
      title: '',
      trace_id: event.event_id,
    };

    switch (event.type) {
      case 'run.started':
        re.title = event.payload.title;
        re.reads = Object.keys(event.payload.input_bindings) as JsonPointer[];
        break;
      case 'run.completed':
        re.title = 'Run completed';
        re.summary = event.payload.summary;
        break;
      case 'step.started':
        re.title = event.payload.title ?? event.payload.agent_id;
        re.agent_id = event.payload.agent_id;
        re.step_id = event.payload.step_id;
        re.reads = Object.keys(event.payload.inputs) as JsonPointer[];
        break;
      case 'step.completed': {
        const sc = event as StepCompletedEvent;
        re.title = `Step completed: ${sc.payload.agent_id}`;
        re.agent_id = sc.payload.agent_id;
        re.step_id = sc.payload.step_id;
        re.summary = sc.payload.summary;
        re.writes = sc.payload.mutations?.map((m) => m.path) ?? [];

        // Extract evidence from step
        const stepEvidence = sc.payload.evidence ?? [];
        const evidenceIds: string[] = [];
        stepEvidence.forEach((ref: EvidenceRef, idx: number) => {
          const eid = `${event.event_id}-ev-${idx}`;
          evidenceIds.push(eid);
          evidence.push({
            evidence_id: eid,
            run_id: event.run_id,
            ts: event.at,
            kind: ref.kind === 'vault' ? 'vault.object'
              : ref.kind === 'url' ? 'tool.call'
              : 'vault.extract',
            source_ref: ref.pointer?.ref?.vault_id,
            vault_object_id: ref.pointer?.ref?.vault_id,
            pointer: ref.pointer?.selector
              ? (`/${ref.pointer.selector.kind}` as JsonPointer)
              : undefined,
            confidence: undefined,
            relevance: undefined,
            label: ref.label,
            provenance: ref.inline_excerpt
              ? { quote: ref.inline_excerpt }
              : undefined,
          });
        });
        re.evidence_ids = evidenceIds;

        // Extract outcome from step output
        if (sc.payload.summary) {
          const oid = `${event.event_id}-out`;
          outcomes.push({
            outcome_id: oid,
            run_id: event.run_id,
            ts: event.at,
            kind: 'json',
            render_as: 'text',
            headline: sc.payload.agent_id,
            summary: sc.payload.summary,
            result: sc.payload.summary,
            confidence: null,
            confidence_reason: 'Skill does not output confidence yet',
            explanation: sc.payload.summary,
            evidence_ids: evidenceIds,
          });
          re.outcome_ids = [oid];
        }
        break;
      }
      case 'artifact.emitted':
        re.title = event.payload.title;
        break;
      default:
        re.title = event.type;
    }

    reasoningEvents.push(re);
  });

  return { run_id, events: reasoningEvents, evidence, outcomes };
}

/**
 * Merge a RunnerResult's graph with EventRecord-derived graph.
 * Prefers RunnerResult data (direct runner output) over derived data.
 */
export function mergeReasoningGraphs(
  primary: ReasoningGraph,
  secondary: ReasoningGraph
): ReasoningGraph {
  const seenEventIds = new Set(primary.events.map((e) => e.event_id));
  const seenEvidenceIds = new Set(primary.evidence.map((e) => e.evidence_id));
  const seenOutcomeIds = new Set(primary.outcomes.map((o) => o.outcome_id));

  return {
    run_id: primary.run_id || secondary.run_id,
    events: [
      ...primary.events,
      ...secondary.events.filter((e) => !seenEventIds.has(e.event_id)),
    ],
    evidence: [
      ...primary.evidence,
      ...secondary.evidence.filter((e) => !seenEvidenceIds.has(e.evidence_id)),
    ],
    outcomes: [
      ...primary.outcomes,
      ...secondary.outcomes.filter((o) => !seenOutcomeIds.has(o.outcome_id)),
    ],
  };
}
