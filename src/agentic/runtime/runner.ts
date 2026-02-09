/**
 * Runner Interface — Frontier-ready Agent Orchestration Blueprint
 *
 * The UI renders Events + Evidence + Outcomes.
 * The runner is free to become more advanced over time—Frontier models,
 * tools, multi-agent—because it only needs to emit the same record types.
 *
 * Orchestration modes (progressive):
 * - Mode A (today): DeterministicRunner — rules + templates, pointerIndex scoring
 * - Mode B (stub): ModelPlannerRunner — model-assisted planning, falls back to deterministic
 * - Mode C (scaffold): MultiAgentRunner — multi-agent planner with tool-use
 *
 * Contract: runners MUST only emit Events/Evidence/Outcomes — UI renders them blindly.
 *
 * Required minimum events per run:
 *   run.started, step.started, evidence.candidates_ranked, evidence.bound,
 *   reasoning.step, outcome.proposed, outcome.finalized, step.completed, run.completed
 */

import type { RunContext } from '../contracts/run_context';
import type {
  ReasoningEvent,
  EvidenceRecord,
  OutcomeRecord,
  EvidenceContribution,
  ReasoningGraph,
  RunnerResult,
  CandidateScoreBreakdown,
} from '../contracts/reasoning';
import type { PointerPath } from '../contracts/primitives';
import {
  scoreCandidate,
  computePointerReadiness,
  type PointerIndexEntry,
  type CandidateVaultObject,
  type ReadinessResult,
} from '../vault/pointerIndex';
import {
  computeEvidenceContributions,
  getHistoricalContribution,
} from './learningLoop';

/* ─── Runner Interface ────────────────────────────────── */

/**
 * IRunner — the contract all orchestration implementations must follow.
 *
 * Implementations emit ReasoningEvents, EvidenceRecords, and OutcomeRecords.
 * The Session UI renders these blindly — no implementation details leak.
 */
export interface IRunner {
  /** Human-readable name for diagnostics */
  readonly name: string;

  /** Execute a run and return the reasoning graph */
  execute(context: RunContext, pointerIndex?: PointerIndexEntry[]): Promise<RunnerResult>;

  /**
   * Optional: stream events as they happen (for live rendering).
   * Default implementations can batch everything in execute().
   */
  onEvent?: (callback: (event: ReasoningEvent) => void) => void;
  onEvidence?: (callback: (evidence: EvidenceRecord) => void) => void;
  onOutcome?: (callback: (outcome: OutcomeRecord) => void) => void;
}

/* ─── Helper: generate IDs ───────────────────────────── */
const genId = (prefix: string, runId: string, suffix: string) =>
  `${runId}-${prefix}-${suffix}`;

/* ─── Deterministic Runner (Mode A — today) ───────────── */

/**
 * DeterministicRunner — executes Skills/Flows using deterministic rules.
 *
 * Uses pointerIndex to:
 * - Rank candidates per required pointer with score breakdown
 * - Auto-bind required pointers when confidence >= threshold
 * - Emit evidence.candidates_ranked explaining what was tried
 * - Produce EvidenceRecords for bound vault inputs
 * - Produce OutcomeRecord with confidence (or null with reason)
 * - If missing required pointers: emit outcome.finalized with "Missing context" checklist
 */
export class DeterministicRunner implements IRunner {
  readonly name = 'DeterministicRunner';

  async execute(context: RunContext, pointerIndex?: PointerIndexEntry[]): Promise<RunnerResult> {
    const run_id = context.run_id;
    const events: ReasoningEvent[] = [];
    const evidence: EvidenceRecord[] = [];
    const outcomes: OutcomeRecord[] = [];
    const ts = new Date().toISOString();

    // ── 1. run.started ─────────────────────────────────
    events.push({
      event_id: genId('evt', run_id, 'run-started'),
      run_id,
      ts,
      kind: 'run.started',
      title: context.title,
      reads: Object.keys(context.input_bindings) as PointerPath[],
    });

    // ── 2. step.started ────────────────────────────────
    const stepId = genId('step', run_id, '1');
    events.push({
      event_id: genId('evt', run_id, 'step-started'),
      run_id,
      ts,
      kind: 'step.started',
      step_id: stepId,
      agent_id: context.skill_id,
      title: `Analyze inputs for ${context.title}`,
    });

    // ── 3. Candidate scoring + ranking ─────────────────
    const requiredPointers = Object.keys(context.input_bindings) as PointerPath[];
    const candidateBreakdowns: CandidateScoreBreakdown[] = [];
    let readinessResult: ReadinessResult | undefined;

    if (pointerIndex && pointerIndex.length > 0) {
      readinessResult = computePointerReadiness(
        requiredPointers,
        [], // optional pointers
        pointerIndex
      );

      // Build score breakdowns for explainability (v1.1: includes historical)
      readinessResult.candidateVaultObjects.forEach((candidate) => {
        // Prefer the pre-computed breakdown from pointerIndex (already includes historical)
        if (candidate.scoreBreakdown) {
          candidateBreakdowns.push({ ...candidate.scoreBreakdown });
        } else {
          const entries = pointerIndex.filter((e) => e.object_id === candidate.object_id);
          const latestUpdate = entries.reduce(
            (latest, e) => (e.updated_at > latest ? e.updated_at : latest),
            entries[0]?.updated_at ?? ts
          );
          const ageMs = Date.now() - new Date(latestUpdate).getTime();
          const ageDays = ageMs / (1000 * 60 * 60 * 24);
          const recencyBoost = Math.max(0, 1 - ageDays / 30);
          const relevanceWeight = candidate.relevance === 'high' ? 1.0 : candidate.relevance === 'medium' ? 0.6 : 0.2;
          const totalRequired = requiredPointers.length || 1;
          const coverage = candidate.satisfiedPointers.filter((p) => requiredPointers.includes(p)).length / totalRequired;
          const historical = getHistoricalContribution(candidate.object_id);

          candidateBreakdowns.push({
            object_id: candidate.object_id,
            label: entries[0]?.record_type ?? candidate.object_id,
            relevance: 0.35 * relevanceWeight,
            confidence: 0.25 * Math.max(0, Math.min(1, candidate.confidence)),
            coverage: 0.10 * coverage,
            recency: 0.10 * recencyBoost,
            historical: 0.20 * Math.max(0, Math.min(1, historical)),
            total: candidate.score,
            selected: false,
            reason: undefined,
          });
        }
      });
    }

    // ── 4. evidence.candidates_ranked ──────────────────
    const topCandidates = candidateBreakdowns.slice(0, 5);
    events.push({
      event_id: genId('evt', run_id, 'candidates-ranked'),
      run_id,
      ts,
      kind: 'evidence.candidates_ranked',
      step_id: stepId,
      title: 'Candidates ranked by semantic memory',
      summary: topCandidates.length > 0
        ? `Ranked ${candidateBreakdowns.length} candidates. Top: ${topCandidates.map((c) => `${c.label} (${c.total.toFixed(3)})`).join(', ')}`
        : 'No candidates available from pointer index',
      data: { candidates: topCandidates },
    });

    // ── 5. evidence.bound — build evidence from input bindings ──
    const evidenceIds: string[] = [];
    const bindingEntries = Object.entries(context.input_bindings);
    bindingEntries.forEach(([pointer, vault], idx) => {
      const eid = genId('ev', run_id, String(idx));
      evidenceIds.push(eid);

      // Find matching candidate for score snapshot
      const candidateMatch = candidateBreakdowns.find((c) => c.object_id === vault.ref.vault_id);
      if (candidateMatch) {
        candidateMatch.selected = true;
        candidateMatch.reason = 'Best match for pointer binding';
      }

      // Find provenance from pointer index
      const indexEntry = pointerIndex?.find(
        (e) => e.object_id === vault.ref.vault_id && e.pointer === pointer
      );

      // v1.1: fetch historical reliability for this evidence
      const historicalReliability = getHistoricalContribution(vault.ref.vault_id);

      evidence.push({
        evidence_id: eid,
        run_id,
        ts,
        kind: 'vault.object',
        source_ref: vault.ref.vault_id,
        vault_object_id: vault.ref.vault_id,
        pointer: pointer as PointerPath,
        label: vault.label ?? vault.ref.vault_id,
        confidence: indexEntry?.confidence ?? candidateMatch?.total,
        relevance: indexEntry?.relevance,
        score_snapshot: candidateMatch
          ? {
              relevance: candidateMatch.relevance,
              confidence: candidateMatch.confidence,
              coverage: candidateMatch.coverage,
              recency: candidateMatch.recency,
              historical: candidateMatch.historical,
              total: candidateMatch.total,
            }
          : undefined,
        historical_reliability: historicalReliability > 0 ? historicalReliability : undefined,
      });

      events.push({
        event_id: genId('evt', run_id, `ev-bound-${idx}`),
        run_id,
        ts,
        kind: 'evidence.bound',
        step_id: stepId,
        title: `Bound: ${vault.label ?? vault.ref.vault_id}`,
        summary: `Pointer ${pointer} → vault ${vault.ref.vault_id}`,
        evidence_ids: [eid],
      });
    });

    // ── 6. Check for missing required pointers ─────────
    const missingPointers = readinessResult?.requiredPointersMissing ?? [];
    const hasMissingRequired = missingPointers.length > 0 && bindingEntries.length === 0;

    // ── 7. reasoning.step — explain candidate selection ──
    events.push({
      event_id: genId('evt', run_id, 'reasoning-selection'),
      run_id,
      ts,
      kind: 'reasoning.step',
      step_id: stepId,
      title: 'Evidence selection reasoning',
      summary: hasMissingRequired
        ? `Missing required memory pointers: ${missingPointers.join(', ')}. Cannot proceed with full confidence.`
        : candidateBreakdowns.length > 0
          ? `Selected ${evidenceIds.length} evidence items. Scoring: 0.35*relevance + 0.25*confidence + 0.10*coverage + 0.10*recency + 0.20*historical. ${candidateBreakdowns.filter((c) => c.selected).map((c) => `${c.label}: ${c.total.toFixed(3)} (selected, hist=${c.historical.toFixed(3)})`).join('; ')}`
          : `Bound ${evidenceIds.length} vault inputs directly from run context.`,
      data: {
        scoring_formula: '0.35*relevance + 0.25*confidence + 0.10*coverage + 0.10*recency + 0.20*historical',
        candidates_evaluated: candidateBreakdowns.length,
        evidence_bound: evidenceIds.length,
        missing_pointers: missingPointers,
      },
      evidence_ids: evidenceIds,
    });

    // ── 8. outcome.proposed ────────────────────────────
    const completeTs = new Date().toISOString();
    const outcomeId = genId('out', run_id, 'primary');

    if (hasMissingRequired) {
      // Missing context outcome
      events.push({
        event_id: genId('evt', run_id, 'outcome-proposed'),
        run_id,
        ts: completeTs,
        kind: 'outcome.proposed',
        step_id: stepId,
        title: 'Missing context detected',
        summary: `Cannot complete: ${missingPointers.length} required pointer(s) missing`,
      });

      outcomes.push({
        outcome_id: outcomeId,
        run_id,
        ts: completeTs,
        kind: 'json',
        render_as: 'json',
        headline: 'Missing context — cannot complete',
        summary: `Required memory pointers are not satisfied. Upload or link the missing data to proceed.`,
        result: {
          status: 'incomplete',
          missing_pointers: missingPointers,
          checklist: missingPointers.map((p) => ({
            pointer: p,
            action: 'Upload or link vault record',
            status: 'missing',
          })),
          suggestions: candidateBreakdowns.slice(0, 3).map((c) => ({
            object_id: c.object_id,
            label: c.label,
            score: c.total,
          })),
        },
        confidence: null,
        confidence_reason: 'Cannot compute confidence: required inputs missing',
        evidence_ids: evidenceIds,
      });
    } else {
      // Success outcome
      events.push({
        event_id: genId('evt', run_id, 'outcome-proposed'),
        run_id,
        ts: completeTs,
        kind: 'outcome.proposed',
        step_id: stepId,
        title: `Outcome proposed: ${context.title}`,
        summary: `Deterministic run with ${evidence.length} evidence items`,
        evidence_ids: evidenceIds,
      });

      // Compute confidence from evidence scores
      const avgConfidence =
        evidence.length > 0
          ? evidence.reduce((sum, e) => sum + (e.score_snapshot?.total ?? e.confidence ?? 0.5), 0) / evidence.length
          : null;

      // v1.1: compute per-evidence contribution weights
      const contributions = computeEvidenceContributions(evidence, avgConfidence);

      outcomes.push({
        outcome_id: outcomeId,
        run_id,
        ts: completeTs,
        kind: 'json',
        render_as: 'text',
        headline: context.title,
        summary: `Deterministic run completed with ${evidence.length} evidence items.`,
        result: `Run completed successfully with ${evidence.length} bound inputs.`,
        confidence: avgConfidence,
        confidence_reason: avgConfidence != null
          ? `Average evidence score across ${evidence.length} bound inputs`
          : 'Skill does not output confidence yet',
        explanation: `Deterministic analysis using ${evidence.length} vault sources.`,
        evidence_ids: evidenceIds,
        evidence_contributions: contributions,
      });
    }

    // ── 9. outcome.finalized ───────────────────────────
    events.push({
      event_id: genId('evt', run_id, 'outcome-finalized'),
      run_id,
      ts: completeTs,
      kind: 'outcome.finalized',
      step_id: stepId,
      title: hasMissingRequired ? 'Missing context' : 'Outcome finalized',
      summary: hasMissingRequired
        ? `Run blocked: ${missingPointers.length} required pointer(s) missing`
        : `Run completed with ${evidence.length} evidence items`,
      outcome_ids: [outcomeId],
      evidence_ids: evidenceIds,
    });

    // ── 10. step.completed ─────────────────────────────
    events.push({
      event_id: genId('evt', run_id, 'step-completed'),
      run_id,
      ts: completeTs,
      kind: 'step.completed',
      step_id: stepId,
      agent_id: context.skill_id,
      title: `Step completed: ${context.skill_id ?? context.title}`,
      summary: hasMissingRequired
        ? 'Step completed with missing inputs'
        : `Step completed successfully with ${evidence.length} evidence items`,
      evidence_ids: evidenceIds,
      outcome_ids: [outcomeId],
    });

    // ── 11. run.completed ──────────────────────────────
    events.push({
      event_id: genId('evt', run_id, 'run-completed'),
      run_id,
      ts: completeTs,
      kind: 'run.completed',
      title: 'Run completed',
      summary: hasMissingRequired
        ? `Run completed with missing context. ${missingPointers.length} required pointer(s) not satisfied.`
        : `Deterministic run completed with ${evidence.length} evidence items.`,
    });

    return {
      graph: { run_id, events, evidence, outcomes },
      status: hasMissingRequired ? 'partial' : 'complete',
      message: hasMissingRequired
        ? `Missing required pointers: ${missingPointers.join(', ')}`
        : undefined,
    };
  }
}

/* ─── Model Planner Runner (Mode B — stub, NOT empty) ──── */

/**
 * ModelPlannerRunner — model-assisted planning, deterministic execution.
 *
 * STUB: Must produce at least:
 * - reasoning.step: "Planner not enabled; fallback to deterministic"
 * - evidence.candidates_ranked (same as A)
 * - outcome.proposed (from deterministic)
 * - outcome.finalized
 *
 * Falls back to DeterministicRunner but annotates the graph.
 */
export class ModelPlannerRunner implements IRunner {
  readonly name = 'ModelPlannerRunner';

  async execute(context: RunContext, pointerIndex?: PointerIndexEntry[]): Promise<RunnerResult> {
    const deterministic = new DeterministicRunner();
    const result = await deterministic.execute(context, pointerIndex);
    const ts = new Date().toISOString();

    // Inject model planner reasoning step at the beginning (after run.started)
    const plannerEvent: ReasoningEvent = {
      event_id: genId('evt', context.run_id, 'planner-reasoning'),
      run_id: context.run_id,
      ts,
      kind: 'reasoning.step',
      title: 'Model planner assessment',
      summary: 'Planner not enabled; fallback to deterministic runner. Model-assisted planning requested but Frontier integration is pending. Using deterministic scoring for candidate ranking.',
      data: {
        planner_status: 'disabled',
        fallback: 'DeterministicRunner',
        reason: 'Frontier model integration pending',
      },
    };

    // Insert after run.started
    const runStartedIdx = result.graph.events.findIndex((e) => e.kind === 'run.started');
    result.graph.events.splice(runStartedIdx + 1, 0, plannerEvent);

    return result;
  }
}

/* ─── Multi-Agent Runner (Mode C — scaffold only) ──────── */

/**
 * Types for future multi-agent orchestration.
 * No real implementation needed, but ensures no UI changes required later.
 */

/** A call to a sub-agent within a multi-agent run */
export interface SubAgentCall {
  call_id: string;
  agent_id: string;
  input_context: Record<string, unknown>;
  output?: unknown;
  status: 'pending' | 'running' | 'complete' | 'failed';
}

/** A call to an external tool within a multi-agent run */
export interface ToolCall {
  call_id: string;
  tool_name: string;
  input: unknown;
  output?: unknown;
  status: 'pending' | 'running' | 'complete' | 'failed';
  latency_ms?: number;
}

/** Memory write-back from a multi-agent run */
export interface MemoryWriteBack {
  write_id: string;
  vault_object_id: string;
  pointer: string;
  value: unknown;
  provenance: {
    agent_id: string;
    run_id: string;
    step_id: string;
  };
  status: 'pending' | 'committed' | 'rejected';
}

/** Multi-agent run context extends RunContext */
export interface MultiAgentRunContext extends Omit<RunContext, 'kind'> {
  kind: 'multi_agent';
  agent_graph: {
    nodes: Array<{ id: string; agent_id: string; depends_on?: string[] }>;
    edges: Array<{ from: string; to: string; pointer?: string }>;
  };
  tool_permissions: string[];
  memory_write_permissions: string[];
}

/**
 * MultiAgentRunner — scaffold for future multi-agent orchestration.
 *
 * Provides interface + types only. Falls back to deterministic today.
 * The graph format is identical — UI renders blindly.
 */
export class MultiAgentRunner implements IRunner {
  readonly name = 'MultiAgentRunner';

  async execute(context: RunContext, pointerIndex?: PointerIndexEntry[]): Promise<RunnerResult> {
    // Scaffold: falls back to deterministic, emits a note
    const deterministic = new DeterministicRunner();
    const result = await deterministic.execute(context, pointerIndex);
    const ts = new Date().toISOString();

    result.graph.events.push({
      event_id: genId('evt', context.run_id, 'multiagent-scaffold'),
      run_id: context.run_id,
      ts,
      kind: 'reasoning.step',
      title: 'Multi-agent orchestration',
      summary: 'Multi-agent runner is scaffolded but not yet active. Using deterministic fallback. Sub-agent calls, tool calls, and memory write-backs will be supported in a future release.',
      data: {
        runner: 'MultiAgentRunner',
        status: 'scaffold',
        capabilities: ['subagent_calls', 'tool_calls', 'memory_write_backs'],
      },
    });

    return result;
  }
}

/* ─── Runner Registry ─────────────────────────────────── */

const runners = new Map<string, IRunner>();

export function registerRunner(runner: IRunner): void {
  runners.set(runner.name, runner);
}

export function getRunner(name?: string): IRunner {
  if (name && runners.has(name)) {
    return runners.get(name)!;
  }
  // Default: deterministic
  return new DeterministicRunner();
}

// Register defaults
registerRunner(new DeterministicRunner());
registerRunner(new ModelPlannerRunner());
registerRunner(new MultiAgentRunner());
