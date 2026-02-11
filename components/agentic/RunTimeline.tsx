import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { EventRecord, StepCompletedEvent, StepStartedEvent } from '../../src/agentic/contracts/ledger';
import type { VaultPointer } from '../../src/agentic/contracts/vault';
import { normalizeEvents } from '../../src/agentic/ledger/normalizeEvents';
import {
  extractReasoningGraph,
  type ReasoningGraph,
  type ReasoningEvent,
  type EvidenceRecord,
  type EvidenceContribution,
  type OutcomeRecord,
  type RunnerResult,
} from '../../src/agentic/contracts/reasoning';
import { isDev } from '@/utils/env';
import {
  h2,
  muted,
  body,
  label as labelToken,
  btnSecondary,
  btnLink,
  chip,
  surface,
  surfaceBordered,
  surfaceInset,
  divider,
  evidenceRail,
  railSection,
  railSectionHeader,
  statusReady,
  statusWarning,
  statusError,
  statusNeutral,
  cognitiveLoopBadge,
  loopMemory,
  loopUnderstand,
  loopReason,
  loopAct,
  loopLearn,
  formatConfidence,
  relevanceHigh,
  relevanceMedium,
  relevanceLow,
} from '../../src/ui/tokens';

interface RunTimelineProps {
  events: EventRecord[];
  /** Optional: raw RunnerResult for richer evidence display */
  runnerResult?: RunnerResult;
}

const statusClasses: Record<string, string> = {
  ok: statusReady,
  complete: statusReady,
  insufficient_data: statusWarning,
  partial: statusWarning,
  rejected: statusError,
  error: statusError,
  failed: statusError,
  running: statusNeutral,
};

const asStepStarted = (event: EventRecord): event is StepStartedEvent => event.type === 'step.started';
const asStepCompleted = (event: EventRecord): event is StepCompletedEvent => event.type === 'step.completed';

/**
 * ContributionBar — tiny horizontal bar showing contribution weight (0–1).
 */
const ContributionBar: React.FC<{ weight: number }> = ({ weight }) => {
  const pct = Math.round(Math.max(0, Math.min(1, weight)) * 100);
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1.5 w-16 rounded-full bg-slate-200 overflow-hidden">
        <div
          className={`h-full rounded-full ${
            pct >= 60 ? 'bg-weflora-teal' : pct >= 30 ? 'bg-weflora-amber' : 'bg-slate-400'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[9px] font-semibold text-slate-600">{pct}%</span>
    </div>
  );
};

/**
 * EvidenceCard — renders a single EvidenceRecord from the ReasoningGraph.
 *
 * v1.1: Shows contribution weight, historical reliability, full score breakdown,
 * provenance details, and explains *why* this evidence was chosen.
 */
const EvidenceCard: React.FC<{
  evidence: EvidenceRecord;
  contribution?: EvidenceContribution;
}> = ({ evidence, contribution }) => (
  <div className="rounded-lg border border-slate-100 p-3">
    {/* Header: label + kind + badges */}
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-700">{evidence.label ?? 'Evidence'}</p>
        <div className="mt-1 flex flex-wrap gap-1">
          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
            evidence.kind === 'vault.object' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
            evidence.kind === 'tool.call' ? 'bg-violet-50 text-violet-700 border border-violet-200' :
            'bg-slate-50 text-slate-600 border border-slate-200'
          }`}>
            {evidence.kind}
          </span>
          {evidence.relevance && (
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
              evidence.relevance === 'high' ? relevanceHigh :
              evidence.relevance === 'medium' ? relevanceMedium :
              relevanceLow
            }`}>
              {evidence.relevance}
            </span>
          )}
          {evidence.confidence != null && (
            <span className="rounded-full bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
              conf: {evidence.confidence.toFixed(2)}
            </span>
          )}
        </div>
      </div>
    </div>

    {/* Contribution weight (v1.1: how strongly this evidence contributed) */}
    {contribution && (
      <div className="mt-2 flex items-center gap-2">
        <span className="text-[10px] font-semibold text-slate-500">Contribution:</span>
        <ContributionBar weight={contribution.weight} />
      </div>
    )}

    {/* Historical reliability (v1.1: avg contribution across past runs) */}
    {evidence.historical_reliability != null && evidence.historical_reliability > 0 && (
      <div className="mt-1.5 flex items-center gap-2">
        <span className="text-[10px] font-semibold text-slate-500">Historical reliability:</span>
        <ContributionBar weight={evidence.historical_reliability} />
        <span className="text-[9px] text-slate-400">(avg across past runs)</span>
      </div>
    )}

    {/* Score snapshot breakdown (v1.1: 6 components including historical) */}
    {evidence.score_snapshot && (
      <div className="mt-2 flex flex-wrap gap-1">
        <span className="rounded bg-blue-50 px-1 py-0.5 text-[9px] text-blue-700">
          rel {evidence.score_snapshot.relevance.toFixed(3)}
        </span>
        <span className="rounded bg-emerald-50 px-1 py-0.5 text-[9px] text-emerald-700">
          conf {evidence.score_snapshot.confidence.toFixed(3)}
        </span>
        <span className="rounded bg-amber-50 px-1 py-0.5 text-[9px] text-amber-700">
          cov {evidence.score_snapshot.coverage.toFixed(3)}
        </span>
        <span className="rounded bg-slate-50 px-1 py-0.5 text-[9px] text-slate-600">
          rec {evidence.score_snapshot.recency.toFixed(3)}
        </span>
        {evidence.score_snapshot.historical > 0 && (
          <span className="rounded bg-violet-50 px-1 py-0.5 text-[9px] text-violet-700">
            hist {evidence.score_snapshot.historical.toFixed(3)}
          </span>
        )}
        <span className="rounded bg-weflora-mint/20 px-1 py-0.5 text-[9px] font-bold text-weflora-dark">
          total {evidence.score_snapshot.total.toFixed(3)}
        </span>
      </div>
    )}

    {/* Provenance details */}
    {evidence.provenance && (
      <div className="mt-2 rounded-md bg-slate-50 p-2 text-[11px] text-slate-600">
        {evidence.provenance.quote && (
          <p className="italic">"{evidence.provenance.quote}"</p>
        )}
        <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-slate-500">
          {evidence.provenance.file_page != null && <span>Page {evidence.provenance.file_page}</span>}
          {evidence.provenance.line_start != null && <span>Lines {evidence.provenance.line_start}–{evidence.provenance.line_end ?? '?'}</span>}
          {evidence.provenance.char_start != null && <span>Chars {evidence.provenance.char_start}–{evidence.provenance.char_end ?? '?'}</span>}
        </div>
      </div>
    )}

    {/* Vault link */}
    {evidence.vault_object_id && (
      <Link
        to={`/vault/${evidence.vault_object_id}`}
        className="mt-2 inline-block text-xs text-weflora-teal hover:underline"
      >
        Open in Vault →
      </Link>
    )}
  </div>
);

/**
 * ReasoningStepCard — renders a reasoning.step event
 */
const ReasoningStepCard: React.FC<{ event: ReasoningEvent }> = ({ event }) => (
  <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-3">
    <div className="flex items-center gap-2">
      <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">
        {event.kind}
      </span>
      <span className="text-[10px] text-slate-400">{new Date(event.ts).toLocaleTimeString()}</span>
    </div>
    <p className="mt-1 text-xs font-semibold text-slate-700">{event.title}</p>
    {event.summary && (
      <p className="mt-1 text-[11px] text-slate-600 leading-relaxed">{event.summary}</p>
    )}
    {event.evidence_ids && event.evidence_ids.length > 0 && (
      <p className="mt-1 text-[10px] text-slate-400">
        References: {event.evidence_ids.length} evidence item(s)
      </p>
    )}
  </div>
);

/**
 * Session Outcome-first two-column layout (Part 3 mandatory).
 *
 * LEFT (Primary): Outcome / Decision / Conclusions / Confidence / Actions / Artifacts / Execution summary
 * RIGHT (Always visible): Vault sources / Input mappings / Evidence / Reasoning steps / Provenance / Mutations
 *
 * No tabs. No hiding. Both columns always visible.
 * On small screens: stacks vertically (Outcome first, Evidence second) with sticky mini header.
 */
const LivingRecordRenderer: React.FC<RunTimelineProps> = ({ events, runnerResult }) => {
  const orderedEvents = useMemo(() => normalizeEvents(events), [events]);

  // Extract the canonical reasoning graph
  // Prefer RunnerResult graph if available (preserves Evidence/Outcome fidelity)
  const reasoningGraph = useMemo(() => {
    if (runnerResult?.graph) {
      return runnerResult.graph;
    }
    return extractReasoningGraph(events);
  }, [events, runnerResult]);

  // Extract structured data from events
  const analysis = useMemo(() => {
    let runTitle = '';
    let runStatus = 'running';
    let runSummary = '';
    const steps: Array<{
      stepId: string;
      agentId: string;
      title: string;
      status: string;
      summary: string;
      inputs: Record<string, VaultPointer>;
      mutations: Array<{ op: string; path: string; value?: VaultPointer; reason?: string }>;
      evidence: Array<{ label: string; kind?: string; pointer?: VaultPointer; url?: string; inline_excerpt?: string; source_id?: string }>;
      assumptions: Array<{ statement: string; validate_next?: string }>;
      actions: Array<{ action_id: string; label: string }>;
      outputs: Array<{ path: string; pointer: VaultPointer }>;
      confidence?: number;
    }> = [];

    // All vault IDs referenced as inputs
    const vaultSourceIds = new Set<string>();
    // All input mappings
    const allInputs: Array<{ path: string; label: string; vaultId: string }> = [];

    orderedEvents.forEach((event) => {
      if (event.type === 'run.started') {
        runTitle = (event.payload as any).title ?? '';
        const inputBindings = (event.payload as any).input_bindings ?? {};
        Object.entries(inputBindings).forEach(([path, pointer]: [string, any]) => {
          const vaultId = pointer?.ref?.vault_id ?? '';
          const label = pointer?.label ?? vaultId;
          if (vaultId) {
            vaultSourceIds.add(vaultId);
            allInputs.push({ path, label, vaultId });
          }
        });
      }
      if (event.type === 'run.completed') {
        runStatus = (event.payload as any).status ?? 'complete';
        runSummary = (event.payload as any).summary ?? '';
      }
      if (asStepStarted(event)) {
        const stepId = event.payload.step_id;
        if (!steps.find((s) => s.stepId === stepId)) {
          const inputs: Record<string, VaultPointer> = event.payload.inputs ?? {};
          Object.values(inputs).forEach((pointer) => {
            if (pointer?.ref?.vault_id) vaultSourceIds.add(pointer.ref.vault_id);
          });
          steps.push({
            stepId,
            agentId: event.payload.agent_id,
            title: event.payload.title ?? event.payload.agent_id,
            status: 'running',
            summary: '',
            inputs,
            mutations: [],
            evidence: [],
            assumptions: [],
            actions: [],
            outputs: [],
          });
        }
      }
      if (asStepCompleted(event)) {
        const existing = steps.find((s) => s.stepId === event.payload.step_id);
        if (existing) {
          existing.status = event.payload.status;
          existing.summary = event.payload.summary ?? '';
          existing.mutations = event.payload.mutations ?? [];
          existing.evidence = (event.payload.evidence ?? []).map((e: any) => ({
            label: e.label,
            kind: e.kind,
            pointer: e.pointer,
            url: e.url,
            inline_excerpt: e.inline_excerpt,
            source_id: e.source_id,
          }));
          existing.assumptions = event.payload.assumptions ?? [];
          existing.actions = event.payload.actions ?? [];
          existing.confidence = (event.payload as any).confidence;
          if (event.payload.output) {
            existing.outputs.push({
              path: '/outputs/agent_output',
              pointer: event.payload.output.pointer,
            });
          }
          // Track vault sources from evidence
          existing.evidence.forEach((ev) => {
            if (ev.pointer?.ref?.vault_id) vaultSourceIds.add(ev.pointer.ref.vault_id);
            if (ev.source_id) vaultSourceIds.add(ev.source_id);
          });
          existing.mutations.forEach((m) => {
            if (m.value?.ref?.vault_id) vaultSourceIds.add(m.value.ref.vault_id);
          });
        }
      }
    });

    // Aggregate across steps
    const allEvidence = steps.flatMap((s) => s.evidence);
    const allAssumptions = steps.flatMap((s) => s.assumptions);
    const allActions = steps.flatMap((s) => s.actions);
    const allMutations = steps.flatMap((s) => s.mutations);
    const allOutputs = steps.flatMap((s) => s.outputs);

    // Best confidence (take highest from any step)
    const confidenceValues = steps.map((s) => s.confidence).filter((c): c is number => c != null);
    const overallConfidence = confidenceValues.length > 0 ? Math.max(...confidenceValues) : null;

    return {
      runTitle,
      runStatus,
      runSummary,
      steps,
      vaultSourceIds: Array.from(vaultSourceIds),
      allInputs,
      allEvidence,
      allAssumptions,
      allActions,
      allMutations,
      allOutputs,
      overallConfidence,
    };
  }, [orderedEvents]);

  // Extract reasoning steps + evidence from the graph
  const graphEvidence = reasoningGraph.evidence;
  const graphOutcomes = reasoningGraph.outcomes;
  const reasoningSteps = reasoningGraph.events.filter(
    (e) => e.kind === 'reasoning.step' || e.kind === 'evidence.candidates_ranked'
  );

  // Merge vault source IDs from graph evidence too
  const allVaultSourceIds = useMemo(() => {
    const ids = new Set(analysis.vaultSourceIds);
    graphEvidence.forEach((ev) => {
      if (ev.vault_object_id) ids.add(ev.vault_object_id);
      if (ev.source_ref) ids.add(ev.source_ref);
    });
    return Array.from(ids);
  }, [analysis.vaultSourceIds, graphEvidence]);

  // Build contribution map from outcomes (v1.1)
  const contributionMap = useMemo(() => {
    const map = new Map<string, EvidenceContribution>();
    graphOutcomes.forEach((outcome) => {
      outcome.evidence_contributions?.forEach((c) => {
        const existing = map.get(c.evidence_id);
        if (!existing || c.weight > existing.weight) {
          map.set(c.evidence_id, c);
        }
      });
    });
    return map;
  }, [graphOutcomes]);

  // Get primary outcome from graph
  const primaryOutcome = graphOutcomes[0];

  // Confidence: prefer graph outcome, then analysis. NEVER render NaN.
  const rawConfidence = primaryOutcome?.confidence ?? analysis.overallConfidence;
  const safeConfidence = formatConfidence(rawConfidence);
  const confidenceReason = primaryOutcome?.confidence_reason ?? (safeConfidence.isReal ? undefined : 'No confidence score reported by agents.');

  const statusBadgeFor = (status: string) =>
    statusClasses[status] ?? statusNeutral;

  return (
    <div className="space-y-6">
      {/* ── Cognitive loop indicator ──────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <span className={`${cognitiveLoopBadge} ${loopMemory}`}>Memory</span>
        <span className="text-slate-300">→</span>
        <span className={`${cognitiveLoopBadge} ${loopUnderstand}`}>Understand</span>
        <span className="text-slate-300">→</span>
        <span className={`${cognitiveLoopBadge} ${loopReason}`}>Reason</span>
        <span className="text-slate-300">→</span>
        <span className={`${cognitiveLoopBadge} ${loopAct}`}>Act</span>
        <span className="text-slate-300">→</span>
        <span className={`${cognitiveLoopBadge} ${loopLearn}`}>Learn</span>
        <span className="text-slate-300">→</span>
        <span className={`${cognitiveLoopBadge} ${loopMemory}`}>Memory</span>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
      {/* ════════════ LEFT — OUTCOME (Primary) ════════════ */}
      <div className="space-y-6">
        {/* 1. Decision / Outcome headline */}
        <section className={`${surfaceBordered} p-5`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Outcome</p>
              <h2 className={`mt-2 ${h2}`}>
                {primaryOutcome?.headline ?? analysis.runTitle ?? 'Session result'}
              </h2>
            </div>
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeFor(analysis.runStatus)}`}>
              {analysis.runStatus}
            </span>
          </div>
          {(primaryOutcome?.summary ?? analysis.runSummary) && (
            <p className={`mt-3 ${body}`}>
              {primaryOutcome?.summary ?? analysis.runSummary}
            </p>
          )}
        </section>

        {/* 2. Key conclusions (step summaries) */}
        {analysis.steps.length > 0 && (
          <section className="rounded-xl border border-slate-100 bg-white p-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Key Conclusions</p>
            <div className="space-y-3">
              {analysis.steps.map((step) => (
                <div key={step.stepId} className="flex items-start gap-3">
                  <span className={`mt-0.5 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusBadgeFor(step.status)}`}>
                    {step.status}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{step.title}</p>
                    {step.summary && <p className={`mt-1 ${muted}`}>{step.summary}</p>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 3. Confidence score + reasoning (NaN-safe) */}
        <section className={`${surfaceBordered} p-5`}>
          <p className={`${labelToken} mb-3`}>Confidence</p>
          {safeConfidence.isReal ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 10 }, (_, i) => (
                  <span
                    key={i}
                    className={`h-3 w-3 rounded-sm ${i < Math.round(Number(rawConfidence) * 10) ? 'bg-weflora-teal' : 'bg-slate-100'}`}
                  />
                ))}
              </div>
              <span className="text-sm font-semibold text-slate-700">{safeConfidence.display}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-slate-300">{safeConfidence.display}</span>
              <span className={muted}>{confidenceReason}</span>
            </div>
          )}
          {confidenceReason && safeConfidence.isReal && (
            <p className="mt-2 text-xs text-slate-500">{confidenceReason}</p>
          )}
          {analysis.allAssumptions.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold text-slate-600 mb-2">Assumptions made</p>
              <ul className="space-y-2">
                {analysis.allAssumptions.map((a, i) => (
                  <li key={i} className="text-sm text-slate-700">
                    <p>{a.statement}</p>
                    {a.validate_next && (
                      <p className="text-xs text-slate-500 mt-0.5">Next: {a.validate_next}</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* 4. Suggested actions / recommendations */}
        {analysis.allActions.length > 0 && (
          <section className="rounded-xl border border-slate-100 bg-white p-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Recommended Actions</p>
            <ul className="space-y-2">
              {analysis.allActions.map((action) => (
                <li key={action.action_id} className="flex items-center gap-2 text-sm text-slate-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-weflora-teal flex-shrink-0" />
                  {action.label}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* 5. Generated artifacts / outputs */}
        {analysis.allOutputs.length > 0 && (
          <section className="rounded-xl border border-slate-100 bg-white p-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Generated Artifacts</p>
            <ul className="space-y-2">
              {analysis.allOutputs.map((output, i) => (
                <li key={i} className="text-xs text-slate-700 font-mono">
                  {output.path} → {output.pointer.label ?? output.pointer.ref.vault_id}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* 6. Execution summary (step timeline) */}
        <section className="rounded-xl border border-slate-100 bg-white p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Execution Summary</p>
          <div className="relative">
            <div className="absolute left-2 top-0 h-full w-px bg-slate-200" />
            <div className="space-y-4 pl-7">
              {orderedEvents.map((event) => {
                const isRun = event.type === 'run.started' || event.type === 'run.completed';
                const isStep = asStepStarted(event) || asStepCompleted(event);
                const title = isRun
                  ? event.type === 'run.started' ? 'Run started' : 'Run completed'
                  : isStep
                    ? `${event.type.replace('.', ' ')} — ${(event.payload as any).title ?? (event.payload as any).agent_id ?? ''}`
                    : event.type.replace('.', ' ');
                const status = isRun
                  ? (event.type === 'run.completed' ? (event.payload as any).status : 'running')
                  : isStep && asStepCompleted(event)
                    ? event.payload.status
                    : 'running';
                return (
                  <div key={event.event_id} className="relative flex items-start gap-3">
                    <div className="absolute left-[-22px] top-1.5 h-2.5 w-2.5 rounded-full border border-weflora-teal bg-white" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${statusBadgeFor(String(status))}`}>
                          {String(status)}
                        </span>
                        <span className="text-xs text-slate-500">{new Date(event.at).toLocaleTimeString()}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-700">{title}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      {/* ════════════ RIGHT — EVIDENCE RAIL (Always visible) ══════ */}
      <div className={evidenceRail}>
        {/* Sticky mini header on small screens */}
        <div className={`${surfaceInset} p-3 lg:hidden`}>
          <p className="text-xs font-semibold text-slate-700">Evidence & Reasoning</p>
          <p className="text-[11px] text-slate-500">
            {graphEvidence.length} evidence · {reasoningSteps.length} reasoning
          </p>
        </div>

        {/* 1. Vault sources used */}
        <section className="rounded-xl border border-slate-100 bg-white p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Vault Sources</p>
          {allVaultSourceIds.length === 0 ? (
            <p className={muted}>No vault sources referenced.</p>
          ) : (
            <ul className="space-y-2">
              {allVaultSourceIds.map((id) => (
                <li key={id} className="flex items-center gap-2">
                  <Link
                    to={`/vault/${id}`}
                    className="text-xs text-weflora-teal font-mono hover:underline truncate"
                  >
                    {id}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 2. Input mappings (JsonPointers) */}
        <section className="rounded-xl border border-slate-100 bg-white p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Input Mappings</p>
          {analysis.allInputs.length === 0 ? (
            <p className={muted}>No input bindings captured.</p>
          ) : (
            <div className="space-y-2">
              {analysis.allInputs.map((input, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className="font-mono text-slate-600 flex-shrink-0">{input.path}</span>
                  <span className="text-slate-400">→</span>
                  <Link to={`/vault/${input.vaultId}`} className="text-weflora-teal hover:underline truncate">
                    {input.label}
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 3. Evidence from ReasoningGraph (real evidence, always shown) */}
        <section className="rounded-xl border border-slate-100 bg-white p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Evidence ({graphEvidence.length})
          </p>
          {graphEvidence.length === 0 ? (
            <div className={`${surfaceInset} p-3`}>
              <p className="text-xs font-semibold text-slate-600">No evidence emitted</p>
              <p className="mt-1 text-[11px] text-slate-500">
                {reasoningSteps.length > 0
                  ? 'The deterministic runner did not produce evidence records. See reasoning steps below for details.'
                  : 'No vault inputs were bound to this run. Evidence is only emitted when the runner binds vault objects as inputs.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {graphEvidence.map((ev) => (
                <EvidenceCard
                  key={ev.evidence_id}
                  evidence={ev}
                  contribution={contributionMap.get(ev.evidence_id)}
                />
              ))}
            </div>
          )}
        </section>

        {/* 4. Reasoning steps (from ReasoningGraph) */}
        <section className="rounded-xl border border-slate-100 bg-white p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Reasoning Steps ({reasoningSteps.length})
          </p>
          {reasoningSteps.length === 0 ? (
            <div className={`${surfaceInset} p-3`}>
              <p className="text-xs text-slate-500">No explicit reasoning steps emitted (Mode A deterministic run).</p>
              <p className="text-[11px] text-slate-400 mt-1">The deterministic runner auto-bound inputs without model-assisted planning.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reasoningSteps.map((step) => (
                <ReasoningStepCard key={step.event_id} event={step} />
              ))}
            </div>
          )}
        </section>

        {/* 5. Steps Executed */}
        <section className="rounded-xl border border-slate-100 bg-white p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Steps Executed</p>
          {analysis.steps.length === 0 ? (
            <p className={muted}>No steps recorded.</p>
          ) : (
            <ol className="space-y-2">
              {analysis.steps.map((step, i) => (
                <li key={step.stepId} className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold text-slate-400 w-5 text-right">{i + 1}.</span>
                  <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${statusBadgeFor(step.status)}`}>
                    {step.status}
                  </span>
                  <span className="text-xs text-slate-700 truncate">{step.title}</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* 6. Provenance (page/line when available) */}
        <section className="rounded-xl border border-slate-100 bg-white p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Provenance</p>
          {graphEvidence.filter((ev) => ev.provenance).length === 0 &&
           analysis.allEvidence.filter((ev) => ev.pointer?.selector || ev.pointer?.ref?.vault_id).length === 0 ? (
            <p className={muted}>No provenance metadata available yet.</p>
          ) : (
            <ul className="space-y-2">
              {graphEvidence
                .filter((ev) => ev.provenance)
                .map((ev) => (
                  <li key={ev.evidence_id} className="text-xs text-slate-600">
                    <span className="font-semibold">{ev.label ?? 'Source'}</span>
                    {ev.provenance?.file_page != null && <span className="ml-2 font-mono text-slate-400">p.{ev.provenance.file_page}</span>}
                    {ev.provenance?.line_start != null && <span className="ml-1 font-mono text-slate-400">L{ev.provenance.line_start}</span>}
                    {ev.provenance?.quote && <p className="mt-0.5 text-[11px] text-slate-500 italic">"{ev.provenance.quote}"</p>}
                  </li>
                ))}
              {analysis.allEvidence
                .filter((ev) => ev.pointer?.ref?.vault_id)
                .map((ev, i) => (
                  <li key={`legacy-${i}`} className="text-xs text-slate-600">
                    <Link to={`/vault/${ev.pointer!.ref.vault_id}`} className="text-weflora-teal hover:underline">
                      {ev.label}
                    </Link>
                    {ev.pointer?.selector && (
                      <span className="ml-2 font-mono text-slate-400">
                        {ev.pointer.selector.kind === 'page_range'
                          ? `pp. ${ev.pointer.selector.from}–${ev.pointer.selector.to}`
                          : ev.pointer.selector.kind === 'text_span'
                            ? `chars ${ev.pointer.selector.start}–${ev.pointer.selector.end}`
                            : ev.pointer.selector.kind}
                      </span>
                    )}
                  </li>
                ))}
            </ul>
          )}
        </section>

        {/* 7. Mutations & Outputs */}
        <section className="rounded-xl border border-slate-100 bg-white p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Mutations & Outputs</p>
          {analysis.allMutations.length === 0 && analysis.allOutputs.length === 0 ? (
            <p className={muted}>No mutations or outputs recorded.</p>
          ) : (
            <ul className="space-y-2">
              {analysis.allMutations.map((m, i) => (
                <li key={`mut-${i}`} className="text-xs font-mono text-slate-600">
                  <span className="text-slate-500">{m.op}</span>{' '}
                  <span>{m.path}</span>
                  {m.value?.ref?.vault_id && (
                    <>
                      {' → '}
                      <Link to={`/vault/${m.value.ref.vault_id}`} className="text-weflora-teal hover:underline">
                        {m.value.label ?? m.value.ref.vault_id}
                      </Link>
                    </>
                  )}
                </li>
              ))}
              {analysis.allOutputs.map((o, i) => (
                <li key={`out-${i}`} className="text-xs font-mono text-slate-600">
                  <span className="text-slate-500">write</span>{' '}
                  <span>{o.path}</span>
                  {' → '}
                  <Link to={`/vault/${o.pointer.ref.vault_id}`} className="text-weflora-teal hover:underline">
                    {o.pointer.label ?? o.pointer.ref.vault_id}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 8. Diagnostics */}
        <section className="rounded-xl border border-slate-100 bg-white p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Diagnostics</p>
          <div className="space-y-2 text-xs text-slate-600">
            {orderedEvents.length > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-500">Session ID</span>
                <span className="font-mono text-slate-700 truncate max-w-[200px]">{orderedEvents[0].session_id}</span>
              </div>
            )}
            {orderedEvents.length > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-500">Run ID</span>
                <span className="font-mono text-slate-700 truncate max-w-[200px]">{orderedEvents[0].run_id}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-500">Ledger Events</span>
              <span className="font-mono text-slate-700">{orderedEvents.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Graph Events</span>
              <span className="font-mono text-slate-700">{reasoningGraph.events.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Evidence Records</span>
              <span className="font-mono text-slate-700">{graphEvidence.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Outcomes</span>
              <span className="font-mono text-slate-700">{graphOutcomes.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Reasoning Steps</span>
              <span className="font-mono text-slate-700">{reasoningSteps.length}</span>
            </div>
            {analysis.steps.length > 0 && (
              <div className="mt-3">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Step Timing</p>
                {analysis.steps.map((step, i) => {
                  const startEvt = orderedEvents.find((e) => e.type === 'step.started' && (e.payload as any).step_id === step.stepId);
                  const endEvt = orderedEvents.find((e) => e.type === 'step.completed' && (e.payload as any).step_id === step.stepId);
                  const startTime = startEvt ? new Date(startEvt.at).getTime() : null;
                  const endTime = endEvt ? new Date(endEvt.at).getTime() : null;
                  const durationMs = startTime && endTime ? endTime - startTime : null;
                  return (
                    <div key={step.stepId} className="flex justify-between py-0.5">
                      <span className="text-slate-500 truncate max-w-[160px]">{step.title}</span>
                      <span className="font-mono text-slate-700">
                        {durationMs != null ? `${(durationMs / 1000).toFixed(1)}s` : '—'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
    </div>
  );
};

export default LivingRecordRenderer;
