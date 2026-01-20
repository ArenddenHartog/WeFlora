import React, { useMemo } from 'react';
import type { ArtifactRecord, StepRecord } from '../../src/agentic/contracts/zod.ts';

interface RunTimelineProps {
  steps: StepRecord[];
  artifacts: ArtifactRecord[];
  agentNameById: Record<string, string>;
}

const statusClasses: Record<string, string> = {
  ok: 'text-emerald-700',
  insufficient_data: 'text-amber-700',
  rejected: 'text-rose-700',
  error: 'text-rose-700',
  running: 'text-slate-700'
};

const formatPointerValue = (value: unknown) => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value === null || value === undefined) return 'null';
  return JSON.stringify(value);
};

const toPointerEntries = (prefix: string, obj: Record<string, unknown>) =>
  Object.entries(obj).map(([key, value]) => ({ pointer: `${prefix}/${key}`, value }));

const LivingRecordRenderer: React.FC<RunTimelineProps> = ({ steps, artifacts, agentNameById }) => {
  const sortedSteps = useMemo(
    () => [...steps].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [steps]
  );

  return (
    <div className="relative">
      <div className="absolute left-2 top-0 h-full w-px bg-slate-200" />
      <div className="space-y-10 pl-8">
      {sortedSteps.map((step) => {
        const evidence = step.output.evidence ?? [];
        const assumptions = step.output.assumptions ?? [];
        const payload = step.output.payload as Record<string, unknown> | null | undefined;
        const summary = (payload?.summary as string | undefined) ?? 'No summary available.';
        const rationale = (payload?.rationale as string | undefined) ?? '';
        const inputs = step.inputs ?? {};
        const inputPointers = toPointerEntries('/inputs', inputs);
        const outputPointers = toPointerEntries('/outputs', payload ?? {});

        return (
          <article key={step.id} className="relative pb-10">
            <div className="absolute left-[-28px] top-2 h-3 w-3 rounded-full border border-weflora-teal bg-white" />

            <header className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs text-slate-400">{new Date(step.created_at).toLocaleString()}</p>
                <p className="mt-2 text-base font-semibold text-slate-900">
                  {agentNameById[step.agent_id] ?? step.agent_id}
                </p>
              </div>
              <span
                className={`inline-flex items-center rounded-full border border-slate-200 px-2 py-0.5 text-xs ${
                  statusClasses[step.status] ?? 'text-slate-600'
                }`}
              >
                {step.status}
              </span>
            </header>

            <div className="mt-5 space-y-5">
              <section>
                <h4 className="text-sm font-semibold text-slate-700">What happened</h4>
                <p className="mt-2 text-sm text-slate-900">{summary}</p>
                {rationale ? <p className="mt-2 text-sm text-slate-600">{rationale}</p> : null}
              </section>

              {step.output.mode === 'insufficient_data' && step.output.insufficient_data ? (
                <section className="space-y-3">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-700">Missing</h4>
                    <ul className="mt-2 list-disc pl-5 text-sm text-slate-700">
                      {step.output.insufficient_data.missing.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-700">Why this matters</h4>
                    <p className="mt-2 text-sm text-slate-600">These inputs are required to complete this step.</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-700">Recommended next</h4>
                    {step.output.insufficient_data.recommended_next?.length ? (
                      <ul className="mt-2 list-disc pl-5 text-sm text-slate-700">
                        {step.output.insufficient_data.recommended_next.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-sm text-slate-600">Provide the missing inputs to continue.</p>
                    )}
                  </div>
                </section>
              ) : null}

              <section>
                <h4 className="text-sm font-semibold text-slate-700">Inputs</h4>
                {inputPointers.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">No inputs captured for this step.</p>
                ) : (
                  <ul className="mt-2 space-y-1 text-xs text-slate-700">
                    {inputPointers.map((item) => (
                      <li key={item.pointer} className="font-mono">
                        {item.pointer} = {formatPointerValue(item.value)}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <h4 className="text-sm font-semibold text-slate-700">Outputs</h4>
                {outputPointers.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">No outputs recorded for this step.</p>
                ) : (
                  <ul className="mt-2 space-y-1 text-xs text-slate-700">
                    {outputPointers.map((item) => (
                      <li key={item.pointer} className="font-mono">
                        {item.pointer} = {formatPointerValue(item.value)}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <h4 className="text-sm font-semibold text-slate-700">Evidence</h4>
                {evidence.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">No evidence captured for this step.</p>
                ) : (
                  <ul className="mt-3 space-y-2 text-sm text-slate-600">
                    {evidence.map((item, index) => (
                      <li key={`${item.claim}-${index}`}>
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

              <section>
                <h4 className="text-sm font-semibold text-slate-700">Assumptions</h4>
                {assumptions.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">No assumptions recorded.</p>
                ) : (
                  <div className="mt-3 space-y-2 text-sm text-slate-600">
                    {assumptions.map((assumption) => (
                      <div key={assumption.id}>
                        <p className="text-sm text-slate-800">{assumption.claim}</p>
                        <p className="text-xs text-slate-500 mt-1">Validate: {assumption.how_to_validate}</p>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section>
                <h4 className="text-sm font-semibold text-slate-700">Artifacts / Actions</h4>
                {artifacts.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">No artifacts or actions emitted.</p>
                ) : (
                  <ul className="mt-2 space-y-1 text-sm text-slate-600">
                    {artifacts.map((artifact) => (
                      <li key={artifact.id}>{artifact.title ?? artifact.type}</li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </article>
        );
      })}
      </div>
    </div>
  );
};

export default LivingRecordRenderer;
