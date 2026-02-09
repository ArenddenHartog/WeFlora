/**
 * Learning Loop v1.1 — Cognitive Memory
 *
 * Evidence Usage Persistence + Memory Reinforcement
 *
 * When a run completes:
 * - Store EvidenceUsageRecords per vault object (lightweight, client-side)
 * - Emit vault.mutated events
 * - Compute evidence_contributions for each outcome
 *
 * When a review is accepted or blocked:
 * - vault_update_review sets status, relevance, confidence, tags/title/description
 * - These feed back into the pointer index for future runs
 *
 * The evidence usage store enables:
 * - Evidence usefulness learning (which evidence led to strong outcomes)
 * - Better candidate ranking (historical_outcome_contribution boost)
 * - Real semantic memory (system learns from experience)
 *
 * Design:
 * - Client-side localStorage persistence (no migration needed)
 * - Reads use direct table reads (no fragile RPC dependencies)
 * - Mutations use rpcSafe only
 * - vault.mutated event is always emitted even if persistence fails
 */

import type {
  ReasoningEvent,
  EvidenceRecord,
  OutcomeRecord,
  EvidenceContribution,
  ReasoningGraph,
} from '../contracts/reasoning';
import type { RunContext } from '../contracts/run_context';
import type { PointerPath } from '../contracts/primitives';

/* ═══════════════════════════════════════════════════════════
   Step A — Evidence Usage Record + Persistence
   ═══════════════════════════════════════════════════════════ */

/**
 * EvidenceUsageRecord — one row per evidence item per run.
 *
 * Stored client-side (localStorage) for lightweight persistence.
 * No heavy migration needed. Can later be promoted to a DB table:
 *   evidence_usage(vault_object_id, pointer_path, used_in_run_id,
 *     outcome_contribution, timestamp, confidence_snapshot, relevance_snapshot)
 */
export interface EvidenceUsageRecord {
  vault_object_id: string;
  pointer_path: string;
  used_in_run_id: string;
  /** 0–1: how strongly this evidence contributed to the run outcome */
  outcome_contribution: number;
  timestamp: string;
  confidence_snapshot: number;
  relevance_snapshot: number;
}

const EVIDENCE_USAGE_KEY = 'weflora.evidence_usage.v1';
const MAX_USAGE_RECORDS = 500; // keep storage bounded

/**
 * Load all stored evidence usage records.
 */
export function loadEvidenceUsage(): EvidenceUsageRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(EVIDENCE_USAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as EvidenceUsageRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Persist evidence usage records (append, bounded by MAX_USAGE_RECORDS).
 */
export function saveEvidenceUsage(records: EvidenceUsageRecord[]): void {
  if (typeof window === 'undefined') return;
  const existing = loadEvidenceUsage();
  const merged = [...records, ...existing].slice(0, MAX_USAGE_RECORDS);
  window.localStorage.setItem(EVIDENCE_USAGE_KEY, JSON.stringify(merged));
}

/**
 * Get the average historical outcome contribution for a vault object.
 *
 * Returns 0 if no usage history exists. Range: 0–1.
 * This is the key input to the semantic ranking upgrade (Step B).
 */
export function getHistoricalContribution(vaultObjectId: string): number {
  const all = loadEvidenceUsage();
  const forObject = all.filter((r) => r.vault_object_id === vaultObjectId);
  if (forObject.length === 0) return 0;
  const sum = forObject.reduce((acc, r) => acc + r.outcome_contribution, 0);
  return sum / forObject.length;
}

/**
 * Get a full historical profile for a vault object.
 */
export function getEvidenceHistory(vaultObjectId: string): {
  usageCount: number;
  avgContribution: number;
  lastUsed: string | null;
  runIds: string[];
} {
  const all = loadEvidenceUsage();
  const forObject = all.filter((r) => r.vault_object_id === vaultObjectId);
  if (forObject.length === 0) {
    return { usageCount: 0, avgContribution: 0, lastUsed: null, runIds: [] };
  }
  const sum = forObject.reduce((acc, r) => acc + r.outcome_contribution, 0);
  const sorted = [...forObject].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return {
    usageCount: forObject.length,
    avgContribution: sum / forObject.length,
    lastUsed: sorted[0]?.timestamp ?? null,
    runIds: [...new Set(forObject.map((r) => r.used_in_run_id))],
  };
}

/**
 * Batch-fetch historical contributions for a set of vault object IDs.
 * More efficient than calling getHistoricalContribution per-object.
 */
export function getHistoricalContributions(
  objectIds: string[],
): Map<string, number> {
  const all = loadEvidenceUsage();
  const result = new Map<string, number>();

  // Group by object
  const byObject = new Map<string, number[]>();
  all.forEach((r) => {
    if (!objectIds.includes(r.vault_object_id)) return;
    const list = byObject.get(r.vault_object_id) ?? [];
    list.push(r.outcome_contribution);
    byObject.set(r.vault_object_id, list);
  });

  objectIds.forEach((id) => {
    const contribs = byObject.get(id);
    if (!contribs || contribs.length === 0) {
      result.set(id, 0);
    } else {
      result.set(id, contribs.reduce((a, b) => a + b, 0) / contribs.length);
    }
  });

  return result;
}

/* ═══════════════════════════════════════════════════════════
   Step C — Compute Evidence Contributions
   ═══════════════════════════════════════════════════════════ */

/**
 * Compute evidence contributions for an outcome.
 *
 * Strategy: distribute weight proportional to each evidence item's
 * score_snapshot.total (normalized). Evidence with higher scores
 * contributed more to the outcome.
 */
export function computeEvidenceContributions(
  evidence: EvidenceRecord[],
  outcomeConfidence: number | null | undefined,
): EvidenceContribution[] {
  if (evidence.length === 0) return [];

  const scores = evidence.map((ev) => ev.score_snapshot?.total ?? ev.confidence ?? 0.5);
  const totalScore = scores.reduce((a, b) => a + b, 0);

  if (totalScore === 0) {
    // Equal distribution
    const equalWeight = 1 / evidence.length;
    return evidence.map((ev) => ({
      evidence_id: ev.evidence_id,
      weight: equalWeight,
    }));
  }

  return evidence.map((ev, idx) => ({
    evidence_id: ev.evidence_id,
    weight: scores[idx] / totalScore,
  }));
}

/* ═══════════════════════════════════════════════════════════
   Run Completion Processing (v1.1)
   ═══════════════════════════════════════════════════════════ */

export interface VaultMutationEvent {
  event_id: string;
  run_id: string;
  ts: string;
  kind: 'vault.mutated';
  vault_object_id: string;
  mutation_type: 'pointer_update' | 'provenance_link' | 'confidence_update' | 'usage_recorded';
  pointer?: PointerPath;
  data?: unknown;
  persisted: boolean;
}

export interface LearningLoopResult {
  events: VaultMutationEvent[];
  evidenceUsageRecords: EvidenceUsageRecord[];
  persistedCount: number;
  skippedCount: number;
  errors: string[];
}

export interface LearningLoopConfig {
  /** Whether to persist mutations to vault_objects table */
  persistToVault: boolean;
  /** Whether to emit vault.mutated events (always true in v1) */
  emitEvents: boolean;
  /** Whether to persist evidence usage to localStorage (default true in v1.1) */
  persistEvidenceUsage: boolean;
  /** Supabase client for persistence (optional) */
  supabaseClient?: any;
}

const DEFAULT_CONFIG: LearningLoopConfig = {
  persistToVault: false,
  emitEvents: true,
  persistEvidenceUsage: true, // v1.1: evidence usage persistence on by default
};

/**
 * Process run completion — emit events, compute contributions, persist usage.
 *
 * v1.1 additions:
 * - Computes evidence_contributions for each outcome
 * - Persists EvidenceUsageRecords to localStorage
 * - Emits usage_recorded mutation events
 */
export function processRunCompletion(
  runContext: RunContext,
  graph: ReasoningGraph,
  config: LearningLoopConfig = DEFAULT_CONFIG,
): LearningLoopResult {
  const ts = new Date().toISOString();
  const events: VaultMutationEvent[] = [];
  const evidenceUsageRecords: EvidenceUsageRecord[] = [];
  const errors: string[] = [];
  let persistedCount = 0;
  let skippedCount = 0;

  // Compute contributions for each outcome
  const contributionsByEvidence = new Map<string, number>();
  graph.outcomes.forEach((outcome) => {
    const outcomeEvidence = graph.evidence.filter(
      (ev) => outcome.evidence_ids?.includes(ev.evidence_id),
    );
    const contributions = computeEvidenceContributions(
      outcomeEvidence,
      outcome.confidence,
    );
    contributions.forEach((c) => {
      const existing = contributionsByEvidence.get(c.evidence_id) ?? 0;
      contributionsByEvidence.set(c.evidence_id, Math.max(existing, c.weight));
    });
  });

  // Build EvidenceUsageRecords and emit events
  const usedVaultObjects = new Map<string, EvidenceRecord[]>();
  graph.evidence.forEach((ev) => {
    if (ev.vault_object_id) {
      const list = usedVaultObjects.get(ev.vault_object_id) ?? [];
      list.push(ev);
      usedVaultObjects.set(ev.vault_object_id, list);
    }
  });

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

    // Compute aggregate contribution for this vault object
    const objectContributions = evidenceRecords
      .map((ev) => contributionsByEvidence.get(ev.evidence_id) ?? 0);
    const avgContribution = objectContributions.length > 0
      ? objectContributions.reduce((a, b) => a + b, 0) / objectContributions.length
      : 0;

    // Create EvidenceUsageRecords
    evidenceRecords.forEach((ev) => {
      evidenceUsageRecords.push({
        vault_object_id: vaultObjectId,
        pointer_path: ev.pointer ?? '/unknown',
        used_in_run_id: runContext.run_id,
        outcome_contribution: contributionsByEvidence.get(ev.evidence_id) ?? 0,
        timestamp: ts,
        confidence_snapshot: ev.score_snapshot?.confidence ?? ev.confidence ?? 0,
        relevance_snapshot: ev.score_snapshot?.relevance ?? 0,
      });
    });

    // Emit pointer update event
    events.push({
      event_id: `${runContext.run_id}-vault-mut-${vaultObjectId.slice(0, 8)}`,
      run_id: runContext.run_id,
      ts,
      kind: 'vault.mutated',
      vault_object_id: vaultObjectId,
      mutation_type: 'usage_recorded',
      data: {
        used_pointers: pointers,
        provenance_links: provenanceLinks,
        run_title: runContext.title,
        skill_id: runContext.skill_id,
        flow_id: runContext.flow_id,
        outcome_contribution: avgContribution,
        evidence_count: evidenceRecords.length,
      },
      persisted: config.persistEvidenceUsage,
    });

    if (config.persistEvidenceUsage) {
      persistedCount++;
    } else {
      skippedCount++;
    }
  });

  // Persist evidence usage to localStorage
  if (config.persistEvidenceUsage && evidenceUsageRecords.length > 0) {
    try {
      saveEvidenceUsage(evidenceUsageRecords);
    } catch (err) {
      errors.push(`Failed to persist evidence usage: ${(err as Error).message}`);
    }
  }

  return { events, evidenceUsageRecords, persistedCount, skippedCount, errors };
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
    summary: `${event.mutation_type}: ${event.persisted ? 'persisted' : 'event-only'} · contribution: ${((event.data as any)?.outcome_contribution ?? 0).toFixed(2)}`,
    data: event.data,
  }));
}

/**
 * Process review acceptance/block for learning loop.
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
    persisted: true,
  };
}
