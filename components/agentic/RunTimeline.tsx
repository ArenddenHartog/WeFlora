import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { EventRecord, StepCompletedEvent, StepStartedEvent } from '../../src/agentic/contracts/ledger';
import type { VaultPointer } from '../../src/agentic/contracts/vault';
import { normalizeEvents } from '../../src/agentic/ledger/normalizeEvents';
import { isDev } from '@/utils/env';
import {
  h2,
  muted,
  body,
  btnSecondary,
  chip,
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
} from '../../src/ui/tokens';

interface RunTimelineProps {
  events: EventRecord[];
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
 * Session Outcome-first two-column layout (Part 3 mandatory).
 *
 * LEFT (Primary): Outcome / Decision / Conclusions / Confidence / Actions / Artifacts / Execution summary
 * RIGHT (Always visible): Vault sources / Input mappings / Evidence / Steps / Provenance / Mutations
 *
 * No tabs. No hiding. Both columns always visible.
 */
const LivingRecordRenderer: React.FC<RunTimelineProps> = ({ events }) => {
  const orderedEvents = useMemo(() => normalizeEvents(events), [events]);

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
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Outcome</p>
              <h2 className={`mt-2 ${h2}`}>{analysis.runTitle || 'Session result'}</h2>
            </div>
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeFor(analysis.runStatus)}`}>
              {analysis.runStatus}
            </span>
          </div>
          {analysis.runSummary && (
            <p className={`mt-3 ${body}`}>{analysis.runSummary}</p>
          )}
        </section>

        {/* 2. Key conclusions (step summaries) */}
        {analysis.steps.length > 0 && (
          <section className="rounded-xl border border-slate-200 bg-white p-5">
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

        {/* 3. Confidence score + reasoning */}
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Confidence</p>
          {analysis.overallConfidence != null ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 10 }, (_, i) => (
                  <span
                    key={i}
                    className={`h-3 w-3 rounded-sm ${i < Math.round(analysis.overallConfidence! * 10) ? 'bg-weflora-teal' : 'bg-slate-200'}`}
                  />
                ))}
              </div>
              <span className="text-sm font-semibold text-slate-700">{analysis.overallConfidence.toFixed(2)}</span>
            </div>
          ) : (
            <p className={muted}>No confidence score reported by agents.</p>
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
          <section className="rounded-xl border border-slate-200 bg-white p-5">
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
          <section className="rounded-xl border border-slate-200 bg-white p-5">
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
        <section className="rounded-xl border border-slate-200 bg-white p-5">
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

      {/* ════════════ RIGHT — EVIDENCE (Always visible) ════════════ */}
      <div className="space-y-6">
        {/* 1. Vault sources used */}
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Vault Sources</p>
          {analysis.vaultSourceIds.length === 0 ? (
            <p className={muted}>No vault sources referenced.</p>
          ) : (
            <ul className="space-y-2">
              {analysis.vaultSourceIds.map((id) => (
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
        <section className="rounded-xl border border-slate-200 bg-white p-5">
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

        {/* 3. Evidence snippets / extracted facts */}
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Evidence</p>
          {analysis.allEvidence.length === 0 ? (
            <p className={muted}>No evidence captured.</p>
          ) : (
            <ul className="space-y-3">
              {analysis.allEvidence.map((ev, i) => (
                <li key={i} className="rounded-lg border border-slate-100 p-3">
                  <p className="text-sm text-slate-700">{ev.label}</p>
                  {ev.inline_excerpt && (
                    <p className="mt-1 text-xs text-slate-500 italic">"{ev.inline_excerpt}"</p>
                  )}
                  {ev.pointer?.ref?.vault_id && (
                    <Link
                      to={`/vault/${ev.pointer.ref.vault_id}`}
                      className="mt-1 inline-block text-xs text-weflora-teal hover:underline"
                    >
                      Open in Vault →
                    </Link>
                  )}
                  {ev.source_id && !ev.pointer?.ref?.vault_id && (
                    <Link
                      to={`/vault/${ev.source_id}`}
                      className="mt-1 inline-block text-xs text-weflora-teal hover:underline"
                    >
                      Open in Vault →
                    </Link>
                  )}
                  {ev.url && (
                    <a href={ev.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs text-weflora-teal hover:underline">
                      Open source →
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 4. Skill/Flow steps executed */}
        <section className="rounded-xl border border-slate-200 bg-white p-5">
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

        {/* 5. Provenance (page/line when available) */}
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Provenance</p>
          {analysis.allEvidence.filter((ev) => ev.pointer?.selector || ev.pointer?.ref?.vault_id).length === 0 ? (
            <p className={muted}>No provenance metadata available yet.</p>
          ) : (
            <ul className="space-y-2">
              {analysis.allEvidence
                .filter((ev) => ev.pointer?.ref?.vault_id)
                .map((ev, i) => (
                  <li key={i} className="text-xs text-slate-600">
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

        {/* 6. Mutations / outputs written to Vault */}
        <section className="rounded-xl border border-slate-200 bg-white p-5">
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
      </div>
    </div>
    </div>
  );
};

export default LivingRecordRenderer;
