import React, { useMemo } from 'react';
import type { ArtifactRecord, StepRecord } from '../../src/agentic/contracts/zod.ts';

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

  return (
    <div className="space-y-8">
      {sortedSteps.map((step) => {
        const evidence = step.output.evidence ?? [];
        const assumptions = step.output.assumptions ?? [];
        const payload = step.output.payload as Record<string, unknown> | null | undefined;
        const summary = (payload?.summary as string | undefined) ?? 'No summary available.';
        const rationale = (payload?.rationale as string | undefined) ?? '';

        return (
          <section key={step.id} className="border-b border-slate-200 pb-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase text-slate-400">{agentNameById[step.agent_id] ?? step.agent_id}</p>
                <h3 className="mt-1 text-lg font-semibold text-slate-900">{step.status}</h3>
              </div>
              <span className="text-xs text-slate-400">{new Date(step.created_at).toLocaleString()}</span>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <p className="text-sm font-semibold text-slate-700">Conclusion</p>
                <p className="mt-2 text-sm text-slate-900">{summary}</p>
                {rationale ? <p className="mt-2 text-sm text-slate-600">{rationale}</p> : null}
                {step.output.mode === 'insufficient_data' && step.output.insufficient_data ? (
                  <div className="mt-3 border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    <p className="font-semibold">Missing</p>
                    <ul className="mt-2 list-disc pl-5">
                      {step.output.insufficient_data.missing.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                    {step.output.insufficient_data.recommended_next?.length ? (
                      <>
                        <p className="mt-3 font-semibold">Recommended next</p>
                        <ul className="mt-2 list-disc pl-5">
                          {step.output.insufficient_data.recommended_next.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-700">Evidence</p>
                {evidence.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">No evidence captured for this step.</p>
                ) : (
                  <ul className="mt-3 space-y-2 text-sm text-slate-600">
                    {evidence.map((item, index) => (
                      <li key={`${item.claim}-${index}`} className="border-b border-slate-100 pb-2">
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
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-700">Assumptions</p>
                {assumptions.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">No assumptions recorded.</p>
                ) : (
                  <div className="mt-3 space-y-2 text-sm text-slate-600">
                    {assumptions.map((assumption) => (
                      <div key={assumption.id} className="border-b border-slate-100 pb-2">
                        <p className="text-sm text-slate-800">{assumption.claim}</p>
                        <p className="text-xs text-slate-500 mt-1">Validate: {assumption.how_to_validate}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        );
      })}

      <section className="border-b border-slate-200 pb-6">
        <h3 className="text-sm font-semibold text-slate-700">Artifacts</h3>
        {artifacts.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No artifacts produced for this run.</p>
        ) : (
          <div className="mt-3 space-y-2 text-sm text-slate-600">
            {artifacts.map((artifact) => (
              <div key={artifact.id} className="border-b border-slate-100 pb-2">
                <p className="text-sm text-slate-800">{artifact.title ?? artifact.type}</p>
                <p className="text-xs text-slate-500">v{artifact.version} · {artifact.status}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default RunTimeline;
