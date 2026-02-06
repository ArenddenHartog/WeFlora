/**
 * Runner Interface — Frontier-ready Agent Orchestration Blueprint
 *
 * The UI renders Events + Evidence + Outcomes.
 * The runner is free to become more advanced over time—Frontier models,
 * tools, multi-agent—because it only needs to emit the same record types.
 *
 * Orchestration modes (progressive):
 * - Mode A (today): DeterministicRunner — rules + templates
 * - Mode B (soon): ModelPlannerRunner — model-assisted planning, deterministic execution
 * - Mode C (Frontier): multi-agent planner with tool-use, still event-driven
 *
 * Contract: runners MUST only emit Events/Evidence/Outcomes — UI renders them blindly.
 */

import type { RunContext } from '../contracts/run_context';
import type {
  ReasoningEvent,
  EvidenceRecord,
  OutcomeRecord,
  ReasoningGraph,
} from '../contracts/reasoning';

/* ─── Runner Result ───────────────────────────────────── */

export interface RunnerResult {
  graph: ReasoningGraph;
  /** Whether the run completed fully or was interrupted */
  status: 'complete' | 'partial' | 'failed';
  /** Optional diagnostic message */
  message?: string;
}

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
  execute(context: RunContext): Promise<RunnerResult>;

  /**
   * Optional: stream events as they happen (for live rendering).
   * Default implementations can batch everything in execute().
   */
  onEvent?: (callback: (event: ReasoningEvent) => void) => void;
  onEvidence?: (callback: (evidence: EvidenceRecord) => void) => void;
  onOutcome?: (callback: (outcome: OutcomeRecord) => void) => void;
}

/* ─── Deterministic Runner (Mode A — today) ───────────── */

/**
 * DeterministicRunner — executes Skills/Flows using deterministic rules.
 *
 * This is the current implementation. Skills are templates, not model calls.
 * All outputs are reproducible given the same inputs.
 */
export class DeterministicRunner implements IRunner {
  readonly name = 'DeterministicRunner';

  async execute(context: RunContext): Promise<RunnerResult> {
    const run_id = context.run_id;
    const events: ReasoningEvent[] = [];
    const evidence: EvidenceRecord[] = [];
    const outcomes: OutcomeRecord[] = [];
    const ts = new Date().toISOString();

    // Emit run.started
    events.push({
      event_id: `${run_id}-start`,
      run_id,
      ts,
      kind: 'run.started',
      title: context.title,
      reads: Object.keys(context.input_bindings) as Array<`/${string}`>,
    });

    // Build evidence from input bindings
    Object.entries(context.input_bindings).forEach(([pointer, vault], idx) => {
      const eid = `${run_id}-ev-${idx}`;
      evidence.push({
        evidence_id: eid,
        run_id,
        ts,
        kind: 'vault.object',
        vault_object_id: vault.ref.vault_id,
        pointer: pointer as `/${string}`,
        label: vault.label ?? vault.ref.vault_id,
      });
      events.push({
        event_id: `${run_id}-evbind-${idx}`,
        run_id,
        ts,
        kind: 'evidence.bound',
        title: `Bound: ${vault.label ?? vault.ref.vault_id}`,
        evidence_ids: [eid],
      });
    });

    // Emit run.completed
    const completeTs = new Date().toISOString();
    events.push({
      event_id: `${run_id}-complete`,
      run_id,
      ts: completeTs,
      kind: 'run.completed',
      title: 'Run completed',
      summary: `Deterministic run completed with ${evidence.length} evidence items.`,
    });

    // Emit outcome
    outcomes.push({
      outcome_id: `${run_id}-outcome`,
      run_id,
      ts: completeTs,
      kind: 'json',
      render_as: 'text',
      headline: context.title,
      result: `Run completed successfully.`,
      evidence_ids: evidence.map((e) => e.evidence_id),
    });

    return {
      graph: { run_id, events, evidence, outcomes },
      status: 'complete',
    };
  }
}

/* ─── Model Planner Runner (Mode B — future) ──────────── */

/**
 * ModelPlannerRunner — model-assisted planning, deterministic execution.
 *
 * Uses a Frontier model to:
 * - Analyze the RunContext
 * - Propose a plan (which Skills to run, in what order)
 * - Execute the plan deterministically
 *
 * Still emits standard Events/Evidence/Outcomes.
 *
 * TODO: Implement when model integration is available.
 */
export class ModelPlannerRunner implements IRunner {
  readonly name = 'ModelPlannerRunner';

  async execute(context: RunContext): Promise<RunnerResult> {
    // Placeholder: delegates to DeterministicRunner for now
    const deterministic = new DeterministicRunner();
    const result = await deterministic.execute(context);

    // Add a note that model planning was requested but fell back
    result.graph.events.push({
      event_id: `${context.run_id}-model-note`,
      run_id: context.run_id,
      ts: new Date().toISOString(),
      kind: 'run.completed',
      title: 'Model planner',
      summary: 'Model-assisted planning requested. Fell back to deterministic runner (Frontier integration pending).',
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
