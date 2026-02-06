/**
 * Vault Pointer Indexing Model v1 (deterministic, no embeddings)
 *
 * Given an AgentProfile (reads pointers + record types), produces:
 * - readiness (missing fields)
 * - ranked candidates (relevance-based)
 * - explicit mapping suggestions (pointer-level)
 * - explainable score breakdowns per candidate
 *
 * Ranking heuristic (deterministic):
 * score = 0.45 * relevanceWeight
 *       + 0.35 * confidenceNormalized
 *       + 0.15 * pointerCoverage
 *       + 0.05 * recencyBoost
 *
 * Enforced explainability:
 * - Every scoring decision emits a breakdown
 * - Top N candidates are always reported
 * - Selection reason is always stated
 */

import type { PointerPath, Json } from '../contracts/primitives';
import type { VaultPointer } from '../contracts/vault';
import type { CandidateScoreBreakdown } from '../contracts/reasoning';

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
  provenance?: PointerProvenance;
  label?: string;
}

export interface CandidateVaultObject {
  object_id: string;
  score: number;
  satisfiedPointers: PointerPath[];
  relevance: RelevanceLevel;
  confidence: number;
  /** Explainable score breakdown */
  scoreBreakdown?: CandidateScoreBreakdown;
}

export interface ReadinessResult {
  requiredPointersMissing: PointerPath[];
  optionalPointersMissing: PointerPath[];
  candidateVaultObjects: CandidateVaultObject[];
  suggestedBindings: Array<{ pointer: PointerPath; object_id: string; score: number; reason: string }>;
}

/** Skill pointer requirements (from contract) */
export interface SkillPointerRequirements {
  required: PointerPath[];
  optional: PointerPath[];
  allowedRecordTypes?: string[];
  minConfidenceThreshold?: number;
}

/** Suggestion result for UI display */
export interface SuggestionResult {
  pointer: PointerPath;
  required: boolean;
  candidates: CandidateScoreBreakdown[];
  bestCandidate?: CandidateScoreBreakdown;
  provenanceAvailable: boolean;
}

/** Auto-fill mapping result */
export interface AutoFillResult {
  bindings: Array<{ pointer: PointerPath; object_id: string; label: string; score: number; reason: string }>;
  unbound: PointerPath[];
  explanation: string;
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
 * Score a candidate with full breakdown for explainability.
 */
export function scoreCandidateWithBreakdown(
  objectId: string,
  label: string,
  relevance: RelevanceLevel,
  confidence: number,
  pointerCoverage: number,
  updatedAt: string,
): CandidateScoreBreakdown {
  const relevanceScore = RELEVANCE_WEIGHT[relevance] ?? 0.2;
  const confidenceNorm = Math.max(0, Math.min(1, confidence));
  const coverageNorm = Math.max(0, Math.min(1, pointerCoverage));

  const ageMs = Date.now() - new Date(updatedAt).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  const recencyBoost = Math.max(0, 1 - ageDays / 30);

  return {
    object_id: objectId,
    label,
    relevance: 0.45 * relevanceScore,
    confidence: 0.35 * confidenceNorm,
    coverage: 0.15 * coverageNorm,
    recency: 0.05 * recencyBoost,
    total:
      0.45 * relevanceScore +
      0.35 * confidenceNorm +
      0.15 * coverageNorm +
      0.05 * recencyBoost,
    selected: false,
  };
}

/**
 * Compute readiness for a Skill given available vault objects.
 *
 * @param requiredPointers - pointers the Skill requires
 * @param optionalPointers - pointers the Skill can optionally use
 * @param index - client-side pointer index entries
 * @param minConfidence - minimum confidence threshold (default 0.60)
 */
export function computePointerReadiness(
  requiredPointers: PointerPath[],
  optionalPointers: PointerPath[],
  index: PointerIndexEntry[],
  minConfidence: number = 0.60,
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

  // Score each object with full breakdown
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
    const breakdown = scoreCandidateWithBreakdown(
      object_id,
      entries[0]?.label ?? entries[0]?.record_type ?? object_id,
      bestRelevance,
      bestConfidence,
      coverage,
      latestUpdate,
    );

    candidates.push({
      object_id,
      score,
      satisfiedPointers: [...satisfiedRequired, ...satisfiedOptional],
      relevance: bestRelevance,
      confidence: bestConfidence,
      scoreBreakdown: breakdown,
    });
  });

  // Sort by score descending
  candidates.sort((a, b) => b.score - a.score);

  // Suggest bindings: for each required pointer, pick the top-scoring object that has it
  // Only bind when confidence >= threshold
  const suggestedBindings: Array<{ pointer: PointerPath; object_id: string; score: number; reason: string }> = [];
  const usedObjects = new Set<string>();

  requiredPointers.forEach((pointer) => {
    const candidate = candidates.find(
      (c) =>
        c.satisfiedPointers.includes(pointer) &&
        !usedObjects.has(c.object_id) &&
        c.confidence >= minConfidence,
    );
    if (candidate) {
      suggestedBindings.push({
        pointer,
        object_id: candidate.object_id,
        score: candidate.score,
        reason: `Best match (score ${candidate.score.toFixed(3)}, confidence ${candidate.confidence.toFixed(2)} >= ${minConfidence})`,
      });
      usedObjects.add(candidate.object_id);
      if (candidate.scoreBreakdown) {
        candidate.scoreBreakdown.selected = true;
        candidate.scoreBreakdown.reason = `Auto-bound: confidence ${candidate.confidence.toFixed(2)} >= threshold ${minConfidence}`;
      }
    }
  });

  return {
    requiredPointersMissing,
    optionalPointersMissing,
    candidateVaultObjects: candidates,
    suggestedBindings,
  };
}

/**
 * Generate input suggestions for a Skill — shows top 3 candidates per pointer with breakdown.
 *
 * Used by "Suggest inputs" button in SkillDetail.
 */
export function suggestInputs(
  requirements: SkillPointerRequirements,
  index: PointerIndexEntry[],
): SuggestionResult[] {
  const allPointers = [...requirements.required, ...requirements.optional];
  const minConf = requirements.minConfidenceThreshold ?? 0.60;
  const readiness = computePointerReadiness(
    requirements.required,
    requirements.optional,
    index,
    minConf,
  );

  return allPointers.map((pointer) => {
    const isRequired = requirements.required.includes(pointer);

    // Find candidates that satisfy this pointer
    const candidatesForPointer = readiness.candidateVaultObjects
      .filter((c) => c.satisfiedPointers.includes(pointer))
      .slice(0, 3);

    const breakdowns: CandidateScoreBreakdown[] = candidatesForPointer.map((c) => {
      const breakdown = c.scoreBreakdown ?? {
        object_id: c.object_id,
        label: c.object_id,
        relevance: 0,
        confidence: 0,
        coverage: 0,
        recency: 0,
        total: c.score,
        selected: false,
      };
      return breakdown;
    });

    // Check provenance availability
    const hasProvenance = index.some(
      (e) => candidatesForPointer.some((c) => c.object_id === e.object_id) && e.provenance != null,
    );

    return {
      pointer,
      required: isRequired,
      candidates: breakdowns,
      bestCandidate: breakdowns[0],
      provenanceAvailable: hasProvenance,
    };
  });
}

/**
 * Auto-fill input mapping — binds the best candidates and returns the mapping.
 *
 * Used by "Auto-fill mapping" button in SkillDetail.
 */
export function autoFillMapping(
  requirements: SkillPointerRequirements,
  index: PointerIndexEntry[],
): AutoFillResult {
  const minConf = requirements.minConfidenceThreshold ?? 0.60;
  const readiness = computePointerReadiness(
    requirements.required,
    requirements.optional,
    index,
    minConf,
  );

  const bindings = readiness.suggestedBindings.map((binding) => {
    const entry = index.find((e) => e.object_id === binding.object_id);
    return {
      pointer: binding.pointer,
      object_id: binding.object_id,
      label: entry?.label ?? entry?.record_type ?? binding.object_id,
      score: binding.score,
      reason: binding.reason,
    };
  });

  const boundPointers = new Set(bindings.map((b) => b.pointer));
  const unbound = requirements.required.filter((p) => !boundPointers.has(p));

  const explanation = unbound.length > 0
    ? `Auto-filled ${bindings.length}/${requirements.required.length} required pointers. ${unbound.length} pointer(s) could not be auto-filled: ${unbound.join(', ')}. No candidates met the minimum confidence threshold of ${minConf}.`
    : `All ${bindings.length} required pointers auto-filled. Scoring: 0.45*relevance + 0.35*confidence + 0.15*coverage + 0.05*recency.`;

  return { bindings, unbound, explanation };
}
