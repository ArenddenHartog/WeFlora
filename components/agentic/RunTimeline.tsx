import React, { useMemo, useState } from 'react';
import type { ArtifactRecord, StepRecord } from '../../src/agentic/contracts/zod.ts';
import StepCard from './StepCard';
import ArtifactCard from './ArtifactCard';

interface RunTimelineProps {
  steps: StepRecord[];
  artifacts: ArtifactRecord[];
  agentNameById: Record<string, string>;
}

const RunTimeline: React.FC<RunTimelineProps> = ({ steps, artifacts, agentNameById }) => {
  const sortedSteps = useMemo(
    () => [...steps].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [steps]
  );
  const [selectedId, setSelectedId] = useState(sortedSteps[0]?.id ?? null);

  const selectedStep = sortedSteps.find((step) => step.id === selectedId) ?? sortedSteps[0];
  const evidence = selectedStep?.output.evidence ?? [];
  const assumptions = selectedStep?.output.assumptions ?? [];
  const payload = selectedStep?.output.payload as Record<string, unknown> | null | undefined;
  const summary = (payload?.summary as string | undefined) ?? 'No summary available.';
  const rationale = (payload?.rationale as string | undefined) ?? '';

  return (
    <div className="flex h-full min-h-0 gap-6">
      <div className="w-full max-w-sm flex-shrink-0 overflow-y-auto pr-2 space-y-3">
        {sortedSteps.map((step) => (
          <StepCard
            key={step.id}
            step={step}
            agentName={agentNameById[step.agent_id] ?? step.agent_id}
            selected={step.id === selectedId}
            onSelect={() => setSelectedId(step.id)}
          />
        ))}
      </div>
      <div className="flex-1 min-w-0 overflow-y-auto pr-2">
        {selectedStep ? (
          <div className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700">What WeFlora concluded…</h3>
              <p className="mt-2 text-base text-slate-900">{summary}</p>
              {rationale ? <p className="mt-3 text-sm text-slate-600">{rationale}</p> : null}
              {selectedStep.output.mode === 'insufficient_data' && selectedStep.output.insufficient_data ? (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  <p className="font-semibold">Missing</p>
                  <ul className="mt-2 list-disc pl-5">
                    {selectedStep.output.insufficient_data.missing.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  {selectedStep.output.insufficient_data.recommended_next?.length ? (
                    <>
                      <p className="mt-3 font-semibold">Recommended next</p>
                      <ul className="mt-2 list-disc pl-5">
                        {selectedStep.output.insufficient_data.recommended_next.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                </div>
              ) : null}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700">Evidence</h3>
              {evidence.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">No evidence captured for this step.</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {evidence.map((item, index) => (
                    <li key={`${item.claim}-${index}`} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                      <p className="text-sm text-slate-800">{item.claim}</p>
                      {item.citations?.length ? (
                        <div className="mt-2 flex flex-col gap-1 text-xs text-slate-500">
                          {item.citations.map((citation, idx) =>
                            citation.vault_ref.kind === 'url' ? (
                              <a
                                key={`${citation.label}-${idx}`}
                                href={citation.vault_ref.ref}
                                target="_blank"
                                rel="noreferrer"
                                className="text-weflora-teal hover:text-weflora-dark underline"
                              >
                                {citation.label}
                              </a>
                            ) : (
                              <span key={`${citation.label}-${idx}`} className="text-slate-500">
                                {citation.label}
                              </span>
                            )
                          )}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700">Assumptions</h3>
              {assumptions.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">No assumptions recorded.</p>
              ) : (
                <div className="mt-3 space-y-3">
                  {assumptions.map((assumption) => (
                    <div key={assumption.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                      <p className="text-sm text-slate-800">{assumption.claim}</p>
                      <p className="text-xs text-slate-500 mt-1">Validate: {assumption.how_to_validate}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700">Artifacts</h3>
              {artifacts.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">No artifacts produced for this run.</p>
              ) : (
                <div className="mt-3 space-y-3">
                  {artifacts.map((artifact) => (
                    <ArtifactCard key={artifact.id} artifact={artifact} />
                  ))}
                </div>
              )}
            </section>
          </div>
        ) : (
          <div className="text-sm text-slate-500">No steps available.</div>
        )}
      </div>
    </div>
  );
};

export default RunTimeline;
