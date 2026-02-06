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
  | 'evidence.bound'
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
 */
export interface EvidenceRecord {
  evidence_id: string;
  run_id: RunId;
  ts: ISO8601;
  kind: EvidenceKind;

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
  result: unknown;

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

/* ─── Reasoning Graph (the complete spine) ────────────── */
export interface ReasoningGraph {
  run_id: RunId;
  events: ReasoningEvent[];
  evidence: EvidenceRecord[];
  outcomes: OutcomeRecord[];
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
            result: sc.payload.summary,
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
