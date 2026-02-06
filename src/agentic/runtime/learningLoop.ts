/**
 * Learning Loop v1 — Memory Updates on Run Completion
 *
 * When a run completes:
 * - Emit vault.mutated event (even if we don't persist it yet)
 * - If configured and safe: update vault_objects.pointers with used pointers & provenance links
 *
 * When a review is accepted or blocked:
 * - vault_update_review sets: status, relevance, confidence, tags/title/description
 * - These changes feed back into the pointer index for future runs
 *
 * Design:
 * - Reads use direct table reads (no fragile RPC dependencies)
 * - Mutations use rpcSafe only
 * - vault.mutated event is always emitted even if persistence fails
 */

import type { ReasoningEvent, EvidenceRecord, ReasoningGraph } from '../contracts/reasoning';
import type { RunContext } from '../contracts/run_context';
import type { PointerPath } from '../contracts/primitives';

/* ─── Types ───────────────────────────────────────────── */

export interface VaultMutationEvent {
  event_id: string;
  run_id: string;
  ts: string;
  kind: 'vault.mutated';
  vault_object_id: string;
  mutation_type: 'pointer_update' | 'provenance_link' | 'confidence_update';
  pointer?: PointerPath;
  data?: unknown;
  persisted: boolean;
}

export interface LearningLoopResult {
  events: VaultMutationEvent[];
  persistedCount: number;
  skippedCount: number;
  errors: string[];
}

/* ─── Config ──────────────────────────────────────────── */

export interface LearningLoopConfig {
  /** Whether to persist mutations to vault_objects table */
  persistToVault: boolean;
  /** Whether to emit vault.mutated events (always true in v1) */
  emitEvents: boolean;
  /** Supabase client for persistence (optional) */
  supabaseClient?: any;
}

const DEFAULT_CONFIG: LearningLoopConfig = {
  persistToVault: false, // Safe default: don't persist until configured
  emitEvents: true,
};

/* ─── Learning Loop: Run Completion ───────────────────── */

/**
 * Process run completion and emit vault.mutated events.
 *
 * For each evidence record bound to a vault object:
 * - Emit a vault.mutated event
 * - If persistToVault is true and supabaseClient is provided:
 *   update vault_objects.pointers with used pointers & provenance links
 *
 * Returns the mutation events for inclusion in the session ledger.
 */
export function processRunCompletion(
  runContext: RunContext,
  graph: ReasoningGraph,
  config: LearningLoopConfig = DEFAULT_CONFIG,
): LearningLoopResult {
  const ts = new Date().toISOString();
  const events: VaultMutationEvent[] = [];
  const errors: string[] = [];
  let persistedCount = 0;
  let skippedCount = 0;

  // Collect unique vault objects used in evidence
  const usedVaultObjects = new Map<string, EvidenceRecord[]>();
  graph.evidence.forEach((ev) => {
    if (ev.vault_object_id) {
      const list = usedVaultObjects.get(ev.vault_object_id) ?? [];
      list.push(ev);
      usedVaultObjects.set(ev.vault_object_id, list);
    }
  });

  // Emit vault.mutated for each used vault object
  usedVaultObjects.forEach((evidenceRecords, vaultObjectId) => {
    const pointers = evidenceRecords
      .filter((ev) => ev.pointer)
      .map((ev) => ev.pointer!);

    const provenanceLinks = evidenceRecords
      .filter((ev) => ev.provenance)
      .map((ev) => ({
        evidence_id: ev.evidence_id,
        run_id: ev.run_id,
        provenance: ev.provenance,
      }));

    // Emit pointer update event
    events.push({
      event_id: `${runContext.run_id}-vault-mut-${vaultObjectId.slice(0, 8)}`,
      run_id: runContext.run_id,
      ts,
      kind: 'vault.mutated',
      vault_object_id: vaultObjectId,
      mutation_type: 'pointer_update',
      data: {
        used_pointers: pointers,
        provenance_links: provenanceLinks,
        run_title: runContext.title,
        skill_id: runContext.skill_id,
        flow_id: runContext.flow_id,
      },
      persisted: false, // Will be updated if persistence succeeds
    });

    skippedCount++;
  });

  // Note: actual persistence to vault_objects table would happen here
  // if config.persistToVault is true. For v1, we only emit events.
  // Persistence will be implemented when we're confident it's safe.

  return { events, persistedCount, skippedCount, errors };
}

/**
 * Convert LearningLoopResult events to ReasoningEvents for inclusion in the graph.
 */
export function learningEventsToReasoningEvents(
  result: LearningLoopResult,
  runId: string,
): ReasoningEvent[] {
  return result.events.map((event) => ({
    event_id: event.event_id,
    run_id: runId,
    ts: event.ts,
    kind: 'vault.mutated' as const,
    title: `Memory updated: ${event.vault_object_id.slice(0, 8)}…`,
    summary: `${event.mutation_type}: ${event.persisted ? 'persisted' : 'event-only (safe mode)'}`,
    data: event.data,
  }));
}

/**
 * Process review acceptance/block for learning loop.
 *
 * When a review is accepted or blocked, the new confidence and relevance
 * values feed back into the pointer index. This function generates the
 * events that document this learning step.
 */
export function processReviewUpdate(
  vaultObjectId: string,
  action: 'accepted' | 'blocked',
  updates: {
    confidence?: number;
    relevance?: number;
    tags?: string[];
    title?: string;
    description?: string;
  },
): VaultMutationEvent {
  return {
    event_id: `review-${vaultObjectId.slice(0, 8)}-${Date.now()}`,
    run_id: 'review',
    ts: new Date().toISOString(),
    kind: 'vault.mutated',
    vault_object_id: vaultObjectId,
    mutation_type: 'confidence_update',
    data: {
      action,
      ...updates,
    },
    persisted: true, // Review updates go through vault_update_review RPC
  };
}
