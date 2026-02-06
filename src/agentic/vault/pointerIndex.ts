/**
 * Vault Pointer Indexing Model v1 (deterministic, no embeddings)
 *
 * Given an AgentProfile (reads pointers + record types), produces:
 * - readiness (missing fields)
 * - ranked candidates (relevance-based)
 * - explicit mapping suggestions (pointer-level)
 *
 * Ranking heuristic (deterministic):
 * score = 0.45 * relevanceWeight
 *       + 0.35 * confidenceNormalized
 *       + 0.15 * pointerCoverage
 *       + 0.05 * recencyBoost
 */

import type { PointerPath, Json } from '../contracts/primitives';
import type { VaultPointer } from '../contracts/vault';

/* ─── Types ───────────────────────────────────────────── */

export type RelevanceLevel = 'high' | 'medium' | 'low';

export interface PointerProvenance {
  file_page?: number;
  char_start?: number;
  char_end?: number;
  line_start?: number;
  line_end?: number;
  quote?: string;
}

export interface PointerEntry {
  pointer: PointerPath;
  confidence: number;
  provenance?: PointerProvenance;
  value_ref?: VaultPointer;
  value_text?: string;
  value_num?: number;
}

export interface PointerIndexEntry {
  object_id: string;
  owner_id?: string;
  record_type: string;
  status: string;
  pointer: PointerPath;
  value_type: 'text' | 'number' | 'boolean' | 'json' | 'unknown';
  value_text?: string;
  value_num?: number;
  confidence: number;
  relevance: RelevanceLevel;
  updated_at: string;
}

export interface CandidateVaultObject {
  object_id: string;
  score: number;
  satisfiedPointers: PointerPath[];
  relevance: RelevanceLevel;
  confidence: number;
}

export interface ReadinessResult {
  requiredPointersMissing: PointerPath[];
  optionalPointersMissing: PointerPath[];
  candidateVaultObjects: CandidateVaultObject[];
  suggestedBindings: Array<{ pointer: PointerPath; object_id: string }>;
}

/* ─── Ranking Heuristic ───────────────────────────────── */

const RELEVANCE_WEIGHT: Record<RelevanceLevel, number> = {
  high: 1.0,
  medium: 0.6,
  low: 0.2,
};

/**
 * Score a candidate vault object for a Skill.
 *
 * score = 0.45 * relevanceWeight
 *       + 0.35 * confidenceNormalized
 *       + 0.15 * pointerCoverage
 *       + 0.05 * recencyBoost
 */
export function scoreCandidate(
  relevance: RelevanceLevel,
  confidence: number,
  pointerCoverage: number,
  updatedAt: string,
): number {
  const relevanceScore = RELEVANCE_WEIGHT[relevance] ?? 0.2;
  const confidenceNorm = Math.max(0, Math.min(1, confidence));
  const coverageNorm = Math.max(0, Math.min(1, pointerCoverage));

  // Recency boost: 1.0 if updated in last hour, decaying to 0 over 30 days
  const ageMs = Date.now() - new Date(updatedAt).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  const recencyBoost = Math.max(0, 1 - ageDays / 30);

  return (
    0.45 * relevanceScore +
    0.35 * confidenceNorm +
    0.15 * coverageNorm +
    0.05 * recencyBoost
  );
}

/**
 * Compute readiness for a Skill given available vault objects.
 *
 * @param requiredPointers - pointers the Skill requires
 * @param optionalPointers - pointers the Skill can optionally use
 * @param index - client-side pointer index entries
 */
export function computePointerReadiness(
  requiredPointers: PointerPath[],
  optionalPointers: PointerPath[],
  index: PointerIndexEntry[],
): ReadinessResult {
  // Group index entries by object_id
  const byObject = new Map<string, PointerIndexEntry[]>();
  index.forEach((entry) => {
    const list = byObject.get(entry.object_id) ?? [];
    list.push(entry);
    byObject.set(entry.object_id, list);
  });

  // Find which required pointers are missing from ALL objects
  const allPointers = new Set(index.map((e) => e.pointer));
  const requiredPointersMissing = requiredPointers.filter((p) => !allPointers.has(p));
  const optionalPointersMissing = optionalPointers.filter((p) => !allPointers.has(p));

  // Score each object
  const candidates: CandidateVaultObject[] = [];
  byObject.forEach((entries, object_id) => {
    const entryPointers = new Set(entries.map((e) => e.pointer));
    const satisfiedRequired = requiredPointers.filter((p) => entryPointers.has(p));
    const satisfiedOptional = optionalPointers.filter((p) => entryPointers.has(p));
    const totalRequired = requiredPointers.length || 1;
    const coverage = satisfiedRequired.length / totalRequired;

    // Use the best confidence and relevance from entries
    const bestConfidence = Math.max(0, ...entries.map((e) => e.confidence));
    const bestRelevance = entries.reduce<RelevanceLevel>((best, e) => {
      if (e.relevance === 'high') return 'high';
      if (e.relevance === 'medium' && best !== 'high') return 'medium';
      return best;
    }, 'low');
    const latestUpdate = entries.reduce((latest, e) =>
      e.updated_at > latest ? e.updated_at : latest, entries[0].updated_at);

    const score = scoreCandidate(bestRelevance, bestConfidence, coverage, latestUpdate);

    candidates.push({
      object_id,
      score,
      satisfiedPointers: [...satisfiedRequired, ...satisfiedOptional],
      relevance: bestRelevance,
      confidence: bestConfidence,
    });
  });

  // Sort by score descending
  candidates.sort((a, b) => b.score - a.score);

  // Suggest bindings: for each required pointer, pick the top-scoring object that has it
  const suggestedBindings: Array<{ pointer: PointerPath; object_id: string }> = [];
  const usedObjects = new Set<string>();

  requiredPointers.forEach((pointer) => {
    const candidate = candidates.find(
      (c) => c.satisfiedPointers.includes(pointer) && !usedObjects.has(c.object_id),
    );
    if (candidate) {
      suggestedBindings.push({ pointer, object_id: candidate.object_id });
      usedObjects.add(candidate.object_id);
    }
  });

  return {
    requiredPointersMissing,
    optionalPointersMissing,
    candidateVaultObjects: candidates,
    suggestedBindings,
  };
}
