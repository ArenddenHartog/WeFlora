/**
 * Cognition Smoke Test (dev-only)
 *
 * Route: /debug/cognition-smoke
 *
 * Tests the complete cognition layer:
 * 1. computePointerReadiness on a known skill
 * 2. Displays top candidates + why
 * 3. Runs deterministic runner and renders resulting graph
 * 4. Shows evidence, outcomes, reasoning steps
 *
 * This is a verification deliverable for the Cognition Layer v1.0.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircleIcon, AlertTriangleIcon, RefreshIcon, SparklesIcon } from '../icons';
import PageShell from '../ui/PageShell';
import {
  btnPrimary,
  btnSecondary,
  statusReady,
  statusWarning,
  statusError,
  muted,
  cognitiveLoopBadge,
  loopMemory,
  loopReason,
  loopAct,
} from '../../src/ui/tokens';
import { agentProfilesContract } from '../../src/agentic/registry/agents';
import { buildSkillContractMeta } from '../../src/agentic/contracts/contractCatalog';
import {
  computePointerReadiness,
  suggestInputs,
  autoFillMapping,
  type PointerIndexEntry,
  type SkillPointerRequirements,
} from '../../src/agentic/vault/pointerIndex';
import {
  DeterministicRunner,
  ModelPlannerRunner,
  MultiAgentRunner,
} from '../../src/agentic/runtime/runner';
import type { RunContext } from '../../src/agentic/contracts/run_context';
import type { ReasoningGraph, RunnerResult } from '../../src/agentic/contracts/reasoning';
import { processRunCompletion, learningEventsToReasoningEvents } from '../../src/agentic/runtime/learningLoop';
import { getDebugState } from '../../utils/safeAction';

type TestStatus = 'idle' | 'running' | 'pass' | 'fail';

interface TestResult {
  name: string;
  status: TestStatus;
  duration?: number;
  data?: any;
  error?: string;
}

const CognitionSmoke: React.FC = () => {
  const [tests, setTests] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedSkillId, setSelectedSkillId] = useState(agentProfilesContract[0]?.id ?? '');
  const [runnerGraph, setRunnerGraph] = useState<ReasoningGraph | null>(null);

  const selectedProfile = agentProfilesContract.find((p) => p.id === selectedSkillId);
  const contractMeta = selectedProfile ? buildSkillContractMeta(selectedProfile as any) : null;

  // Build mock pointer index entries for testing
  const mockPointerIndex: PointerIndexEntry[] = useMemo(() => {
    if (!contractMeta) return [];
    return contractMeta.requiredContext.map((ctx, idx) => ({
      object_id: `mock-vault-${idx}-${ctx.recordType.toLowerCase()}`,
      record_type: ctx.recordType,
      status: 'accepted',
      pointer: `/inputs/${ctx.recordType.toLowerCase()}` as `/${string}`,
      value_type: 'json' as const,
      confidence: 0.75 + Math.random() * 0.2,
      relevance: 'high' as const,
      updated_at: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      label: `${ctx.recordType} Test Record`,
    }));
  }, [contractMeta]);

  const skillRequirements: SkillPointerRequirements | null = useMemo(() => {
    if (!contractMeta) return null;
    return {
      required: contractMeta.requiredContext
        .filter((ctx) => !ctx.optional)
        .map((ctx) => `/inputs/${ctx.recordType.toLowerCase()}` as `/${string}`),
      optional: contractMeta.requiredContext
        .filter((ctx) => ctx.optional)
        .map((ctx) => `/inputs/${ctx.recordType.toLowerCase()}` as `/${string}`),
      allowedRecordTypes: contractMeta.requiredContext.map((ctx) => ctx.recordType),
      minConfidenceThreshold: 0.60,
    };
  }, [contractMeta]);

  const updateTest = useCallback((name: string, result: Partial<TestResult>) => {
    setTests((prev) => {
      const existing = prev.findIndex((t) => t.name === name);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { ...updated[existing], ...result };
        return updated;
      }
      return [...prev, { name, status: 'idle', ...result }];
    });
  }, []);

  const runAllTests = useCallback(async () => {
    if (!selectedProfile || !contractMeta || !skillRequirements) return;
    setIsRunning(true);
    setTests([]);
    setRunnerGraph(null);

    // Test 1: computePointerReadiness
    {
      const name = '1. computePointerReadiness';
      updateTest(name, { status: 'running' });
      const start = Date.now();
      try {
        const readiness = computePointerReadiness(
          skillRequirements.required,
          skillRequirements.optional,
          mockPointerIndex,
          0.60,
        );
        const duration = Date.now() - start;
        updateTest(name, {
          status: readiness.candidateVaultObjects.length > 0 ? 'pass' : 'fail',
          duration,
          data: {
            candidates: readiness.candidateVaultObjects.length,
            missingRequired: readiness.requiredPointersMissing.length,
            suggestedBindings: readiness.suggestedBindings.length,
            topCandidate: readiness.candidateVaultObjects[0],
          },
        });
      } catch (err: any) {
        updateTest(name, { status: 'fail', duration: Date.now() - start, error: err.message });
      }
    }

    // Test 2: suggestInputs
    {
      const name = '2. suggestInputs';
      updateTest(name, { status: 'running' });
      const start = Date.now();
      try {
        const suggestions = suggestInputs(skillRequirements, mockPointerIndex);
        const duration = Date.now() - start;
        updateTest(name, {
          status: suggestions.length > 0 && suggestions.some((s) => s.candidates.length > 0) ? 'pass' : 'fail',
          duration,
          data: {
            suggestionsCount: suggestions.length,
            withCandidates: suggestions.filter((s) => s.candidates.length > 0).length,
            provenanceAvailable: suggestions.filter((s) => s.provenanceAvailable).length,
            topSuggestion: suggestions[0],
          },
        });
      } catch (err: any) {
        updateTest(name, { status: 'fail', duration: Date.now() - start, error: err.message });
      }
    }

    // Test 3: autoFillMapping
    {
      const name = '3. autoFillMapping';
      updateTest(name, { status: 'running' });
      const start = Date.now();
      try {
        const autoFill = autoFillMapping(skillRequirements, mockPointerIndex);
        const duration = Date.now() - start;
        updateTest(name, {
          status: autoFill.bindings.length > 0 ? 'pass' : 'fail',
          duration,
          data: {
            boundCount: autoFill.bindings.length,
            unboundCount: autoFill.unbound.length,
            explanation: autoFill.explanation,
            bindings: autoFill.bindings,
          },
        });
      } catch (err: any) {
        updateTest(name, { status: 'fail', duration: Date.now() - start, error: err.message });
      }
    }

    // Test 4: DeterministicRunner
    {
      const name = '4. DeterministicRunner.execute';
      updateTest(name, { status: 'running' });
      const start = Date.now();
      try {
        const autoFill = autoFillMapping(skillRequirements, mockPointerIndex);
        const inputBindings: Record<string, any> = {};
        autoFill.bindings.forEach((b) => {
          inputBindings[b.pointer] = {
            ref: { vault_id: b.object_id, version: 1 },
            label: b.label,
          };
        });

        const runContext: RunContext = {
          run_id: `smoke-${Date.now()}`,
          scope_id: 'cognition-smoke-test',
          kind: 'skill',
          title: `Smoke: ${selectedProfile.title}`,
          skill_id: selectedProfile.id,
          created_at: new Date().toISOString(),
          created_by: { kind: 'system', reason: 'cognition-smoke-test' },
          runtime: { locale: 'en-US' },
          input_bindings: inputBindings,
        };

        const runner = new DeterministicRunner();
        const result = await runner.execute(runContext, mockPointerIndex);
        const duration = Date.now() - start;

        // Validate graph completeness
        const hasRunStarted = result.graph.events.some((e) => e.kind === 'run.started');
        const hasRunCompleted = result.graph.events.some((e) => e.kind === 'run.completed');
        const hasCandidatesRanked = result.graph.events.some((e) => e.kind === 'evidence.candidates_ranked');
        const hasEvidenceBound = result.graph.events.some((e) => e.kind === 'evidence.bound');
        const hasReasoningStep = result.graph.events.some((e) => e.kind === 'reasoning.step');
        const hasOutcomeProposed = result.graph.events.some((e) => e.kind === 'outcome.proposed');
        const hasOutcomeFinalized = result.graph.events.some((e) => e.kind === 'outcome.finalized');
        const hasEvidence = result.graph.evidence.length > 0;
        const hasOutcome = result.graph.outcomes.length > 0;
        const outcomeHasConfidence = result.graph.outcomes[0]?.confidence != null || result.graph.outcomes[0]?.confidence_reason != null;
        // v1.1 checks
        const outcomeHasContributions = (result.graph.outcomes[0]?.evidence_contributions?.length ?? 0) > 0;
        const evidenceHasHistorical = result.graph.evidence.some((e) => e.score_snapshot?.historical != null);

        const allRequired = hasRunStarted && hasRunCompleted && hasCandidatesRanked &&
          hasEvidenceBound && hasReasoningStep && hasOutcomeProposed &&
          hasOutcomeFinalized && hasEvidence && hasOutcome && outcomeHasConfidence;

        setRunnerGraph(result.graph);

        updateTest(name, {
          status: allRequired ? 'pass' : 'fail',
          duration,
          data: {
            status: result.status,
            eventCount: result.graph.events.length,
            evidenceCount: result.graph.evidence.length,
            outcomeCount: result.graph.outcomes.length,
            checks: {
              run_started: hasRunStarted,
              run_completed: hasRunCompleted,
              candidates_ranked: hasCandidatesRanked,
              evidence_bound: hasEvidenceBound,
              reasoning_step: hasReasoningStep,
              outcome_proposed: hasOutcomeProposed,
              outcome_finalized: hasOutcomeFinalized,
              has_evidence: hasEvidence,
              has_outcome: hasOutcome,
              outcome_has_confidence: outcomeHasConfidence,
              'v1.1_outcome_has_contributions': outcomeHasContributions,
              'v1.1_evidence_has_historical': evidenceHasHistorical,
            },
          },
        });
      } catch (err: any) {
        updateTest(name, { status: 'fail', duration: Date.now() - start, error: err.message });
      }
    }

    // Test 5: ModelPlannerRunner (stub)
    {
      const name = '5. ModelPlannerRunner (stub)';
      updateTest(name, { status: 'running' });
      const start = Date.now();
      try {
        const runContext: RunContext = {
          run_id: `smoke-planner-${Date.now()}`,
          scope_id: 'cognition-smoke-test',
          kind: 'skill',
          title: `Planner Smoke: ${selectedProfile.title}`,
          skill_id: selectedProfile.id,
          created_at: new Date().toISOString(),
          created_by: { kind: 'system', reason: 'cognition-smoke-test' },
          runtime: {},
          input_bindings: {},
        };
        const runner = new ModelPlannerRunner();
        const result = await runner.execute(runContext, []);
        const hasPlannerNote = result.graph.events.some(
          (e) => e.kind === 'reasoning.step' && e.summary?.includes('Planner not enabled'),
        );
        updateTest(name, {
          status: hasPlannerNote ? 'pass' : 'fail',
          duration: Date.now() - start,
          data: {
            hasPlannerNote,
            eventCount: result.graph.events.length,
          },
        });
      } catch (err: any) {
        updateTest(name, { status: 'fail', duration: Date.now() - start, error: err.message });
      }
    }

    // Test 6: MultiAgentRunner (scaffold)
    {
      const name = '6. MultiAgentRunner (scaffold)';
      updateTest(name, { status: 'running' });
      const start = Date.now();
      try {
        const runContext: RunContext = {
          run_id: `smoke-multi-${Date.now()}`,
          scope_id: 'cognition-smoke-test',
          kind: 'skill',
          title: `Multi Smoke: ${selectedProfile.title}`,
          skill_id: selectedProfile.id,
          created_at: new Date().toISOString(),
          created_by: { kind: 'system', reason: 'cognition-smoke-test' },
          runtime: {},
          input_bindings: {},
        };
        const runner = new MultiAgentRunner();
        const result = await runner.execute(runContext, []);
        const hasScaffoldNote = result.graph.events.some(
          (e) => e.kind === 'reasoning.step' && e.summary?.includes('Multi-agent runner is scaffolded'),
        );
        updateTest(name, {
          status: hasScaffoldNote ? 'pass' : 'fail',
          duration: Date.now() - start,
          data: {
            hasScaffoldNote,
            eventCount: result.graph.events.length,
          },
        });
      } catch (err: any) {
        updateTest(name, { status: 'fail', duration: Date.now() - start, error: err.message });
      }
    }

    // Test 7: Learning loop (vault.mutated events)
    {
      const name = '7. Learning Loop (vault.mutated)';
      updateTest(name, { status: 'running' });
      const start = Date.now();
      try {
        const autoFill = autoFillMapping(skillRequirements, mockPointerIndex);
        const inputBindings: Record<string, any> = {};
        autoFill.bindings.forEach((b) => {
          inputBindings[b.pointer] = {
            ref: { vault_id: b.object_id, version: 1 },
            label: b.label,
          };
        });
        const runContext: RunContext = {
          run_id: `smoke-learn-${Date.now()}`,
          scope_id: 'cognition-smoke-test',
          kind: 'skill',
          title: `Learn Smoke: ${selectedProfile.title}`,
          skill_id: selectedProfile.id,
          created_at: new Date().toISOString(),
          created_by: { kind: 'system', reason: 'cognition-smoke-test' },
          runtime: {},
          input_bindings: inputBindings,
        };
        const runner = new DeterministicRunner();
        const result = await runner.execute(runContext, mockPointerIndex);
        const loopResult = processRunCompletion(runContext, result.graph);
        const learningEvents = learningEventsToReasoningEvents(loopResult, runContext.run_id);

        updateTest(name, {
          status: loopResult.events.length > 0 ? 'pass' : 'fail',
          duration: Date.now() - start,
          data: {
            mutationEvents: loopResult.events.length,
            persistedCount: loopResult.persistedCount,
            skippedCount: loopResult.skippedCount,
            reasoningEvents: learningEvents.length,
          },
        });
      } catch (err: any) {
        updateTest(name, { status: 'fail', duration: Date.now() - start, error: err.message });
      }
    }

    setIsRunning(false);
  }, [selectedProfile, contractMeta, skillRequirements, mockPointerIndex, updateTest]);

  const debugState = getDebugState();
  const allPassed = tests.length > 0 && tests.every((t) => t.status === 'pass');
  const anyFailed = tests.some((t) => t.status === 'fail');

  if (typeof window !== 'undefined' && !(import.meta as any).env?.DEV) {
    return (
      <PageShell icon={<SparklesIcon className="h-5 w-5" />} title="Cognition Smoke Test">
        <p className={muted}>Cognition smoke test is only available in development mode.</p>
      </PageShell>
    );
  }

  return (
    <PageShell
      icon={<SparklesIcon className="h-5 w-5" />}
      title="Cognition Smoke Test"
      meta="pointerIndex → suggestInputs → DeterministicRunner → ReasoningGraph"
      actions={
        <>
          <button type="button" onClick={runAllTests} disabled={isRunning || !selectedProfile} className={btnPrimary}>
            {isRunning && <RefreshIcon className="h-4 w-4 animate-spin" />}
            {isRunning ? 'Running…' : 'Run All Tests'}
          </button>
        </>
      }
    >
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Skill selector */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <label className="text-xs font-semibold text-slate-600">
            Select Skill to test
          </label>
          <select
            value={selectedSkillId}
            onChange={(e) => setSelectedSkillId(e.target.value)}
            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
          >
            {agentProfilesContract.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} (v{p.spec_version})
              </option>
            ))}
          </select>
          {contractMeta && (
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-500">
              <span>Context: {contractMeta.requiredContext.map((c) => c.recordType).join(', ')}</span>
              <span>·</span>
              <span>Mock entries: {mockPointerIndex.length}</span>
            </div>
          )}
        </div>

        {/* Summary banners */}
        {allPassed && (
          <div className={`rounded-xl border p-4 ${statusReady}`}>
            <div className="flex items-center gap-3">
              <CheckCircleIcon className="h-6 w-6 text-emerald-600" />
              <div>
                <p className="font-semibold text-emerald-700">All cognition tests passed!</p>
                <p className="text-sm text-emerald-600">
                  ReasoningGraph complete with events, evidence, outcomes, and reasoning steps.
                </p>
              </div>
            </div>
          </div>
        )}

        {anyFailed && !isRunning && (
          <div className={`rounded-xl border p-4 ${statusError}`}>
            <div className="flex items-center gap-3">
              <AlertTriangleIcon className="h-6 w-6 text-rose-600" />
              <div>
                <p className="font-semibold text-rose-700">Some tests failed</p>
                <p className="text-sm text-rose-600">Review the test details below.</p>
              </div>
            </div>
          </div>
        )}

        {/* Test results */}
        {tests.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="p-6 space-y-3">
              {tests.map((test) => (
                <div
                  key={test.name}
                  className={`rounded-lg border p-4 ${
                    test.status === 'pass' ? 'border-emerald-200 bg-emerald-50/50' :
                    test.status === 'fail' ? 'border-rose-200 bg-rose-50/50' :
                    test.status === 'running' ? 'border-blue-200 bg-blue-50/50' :
                    'border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {test.status === 'pass' && <CheckCircleIcon className="h-5 w-5 text-emerald-500" />}
                    {test.status === 'fail' && <AlertTriangleIcon className="h-5 w-5 text-rose-500" />}
                    {test.status === 'running' && <RefreshIcon className="h-5 w-5 text-blue-500 animate-spin" />}
                    {test.status === 'idle' && <div className="h-5 w-5 rounded-full border-2 border-slate-300" />}
                    <div className="flex-1">
                      <p className="font-semibold text-slate-800">{test.name}</p>
                      {test.duration != null && (
                        <span className="text-[11px] text-slate-500">{test.duration}ms</span>
                      )}
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      test.status === 'pass' ? 'bg-emerald-100 text-emerald-700' :
                      test.status === 'fail' ? 'bg-rose-100 text-rose-700' :
                      test.status === 'running' ? 'bg-blue-100 text-blue-700' :
                      'bg-slate-100 text-slate-500'
                    }`}>
                      {test.status}
                    </span>
                  </div>
                  {test.error && (
                    <p className="mt-2 text-xs text-rose-600">{test.error}</p>
                  )}
                  {test.data && (
                    <pre className="mt-2 rounded-md bg-slate-50 p-2 text-[11px] text-slate-600 overflow-auto max-h-[200px]">
                      {JSON.stringify(test.data, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rendered graph */}
        {runnerGraph && (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold text-slate-700 mb-3">ReasoningGraph Visualization</p>

            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className={`${cognitiveLoopBadge} ${loopMemory}`}>
                {runnerGraph.evidence.length} evidence
              </span>
              <span className="text-slate-300">→</span>
              <span className={`${cognitiveLoopBadge} ${loopReason}`}>
                {runnerGraph.events.filter((e) => e.kind === 'reasoning.step').length} reasoning
              </span>
              <span className="text-slate-300">→</span>
              <span className={`${cognitiveLoopBadge} ${loopAct}`}>
                {runnerGraph.outcomes.length} outcomes
              </span>
            </div>

            {/* Events */}
            <div className="mb-4">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Events ({runnerGraph.events.length})
              </p>
              <div className="space-y-1">
                {runnerGraph.events.map((event) => (
                  <div key={event.event_id} className="flex items-center gap-2 text-[11px]">
                    <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${
                      event.kind.startsWith('run.') ? 'bg-blue-50 text-blue-700' :
                      event.kind.startsWith('evidence.') ? 'bg-emerald-50 text-emerald-700' :
                      event.kind.startsWith('reasoning.') ? 'bg-violet-50 text-violet-700' :
                      event.kind.startsWith('outcome.') ? 'bg-amber-50 text-amber-700' :
                      'bg-slate-50 text-slate-600'
                    }`}>
                      {event.kind}
                    </span>
                    <span className="text-slate-700 truncate">{event.title}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Evidence */}
            <div className="mb-4">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Evidence ({runnerGraph.evidence.length})
              </p>
              {runnerGraph.evidence.map((ev) => (
                <div key={ev.evidence_id} className="rounded-md border border-slate-100 p-2 mb-1 text-[11px]">
                  <span className="font-semibold text-slate-700">{ev.label}</span>
                  <span className="ml-2 text-slate-400">{ev.kind}</span>
                  {ev.score_snapshot && (
                    <span className="ml-2 text-slate-500">
                      score: {ev.score_snapshot.total.toFixed(3)}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Outcomes */}
            <div>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Outcomes ({runnerGraph.outcomes.length})
              </p>
              {runnerGraph.outcomes.map((out) => (
                <div key={out.outcome_id} className="rounded-md border border-slate-100 p-2 mb-1 text-[11px]">
                  <p className="font-semibold text-slate-700">{out.headline}</p>
                  {out.summary && <p className="text-slate-600 mt-0.5">{out.summary}</p>}
                  <div className="flex gap-2 mt-1">
                    <span className="text-slate-500">confidence: {out.confidence?.toFixed(2) ?? 'null'}</span>
                    {out.confidence_reason && <span className="text-slate-400">({out.confidence_reason})</span>}
                    <span className="text-slate-500">render_as: {out.render_as}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Debug state */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold text-slate-700 mb-2">Debug State</p>
          <div className="space-y-1 text-[11px] text-slate-600">
            <div className="flex justify-between">
              <span>Last trace ID</span>
              <span className="font-mono">{debugState.lastTraceId ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span>Last error</span>
              <span className="font-mono text-rose-600">{debugState.lastError?.message ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span>Last RPC</span>
              <span className="font-mono">{debugState.lastRpcCall?.name ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span>Backend host</span>
              <span className="font-mono">{typeof window !== 'undefined' ? window.location.origin : '—'}</span>
            </div>
          </div>
        </div>

        <div className="text-center">
          <Link to="/debug/golden-flow" className="text-sm text-weflora-teal hover:underline mr-4">
            Golden Flow Test →
          </Link>
          <Link to="/" className="text-sm text-slate-500 hover:text-slate-700">
            ← Back to home
          </Link>
        </div>
      </div>
    </PageShell>
  );
};

export default CognitionSmoke;
