import React, { useMemo } from 'react';
import type { EventRecord } from '../../src/decision-program/contracts/types.ts';

interface RunTimelineProps {
  events: EventRecord[];
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

const sortEvents = (events: EventRecord[]) =>
  [...events].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

const LivingRecordRenderer: React.FC<RunTimelineProps> = ({ events, agentNameById }) => {
  const orderedEvents = useMemo(() => sortEvents(events), [events]);

  return (
    <div className="relative">
      <div className="absolute left-2 top-0 h-full w-px bg-slate-200" />
      <div className="space-y-10 pl-8">
      {orderedEvents.map((event) => {
        const agentLabel = event.agent_id ? agentNameById[event.agent_id] ?? event.agent_id : 'System';
        const status = event.kind === 'step.output' ? event.data.output?.mode ?? 'ok' : 'ok';
        const evidence = event.kind === 'step.output' ? event.data.output?.evidence ?? [] : [];
        const assumptions = event.kind === 'step.output' ? event.data.output?.assumptions ?? [] : [];
        const payload = event.kind === 'step.output' ? (event.data.output?.payload as Record<string, unknown> | undefined) : undefined;
        const summary = event.kind === 'step.output'
          ? (payload?.summary as string | undefined) ?? 'No summary available.'
          : event.kind === 'step.input_snapshot'
            ? 'Inputs captured for this step.'
            : event.kind === 'artifact.created'
              ? 'Artifact recorded.'
              : 'Event recorded.';
        const rationale = event.kind === 'step.output' ? (payload?.rationale as string | undefined) ?? '' : '';
        const inputs = event.kind === 'step.input_snapshot' ? (event.data.inputs as Record<string, unknown>) : {};
        const outputPointers = event.kind === 'step.output' ? toPointerEntries('/outputs', payload ?? {}) : [];
        const inputPointers = event.kind === 'step.input_snapshot' ? toPointerEntries('/inputs', inputs) : [];
        const artifactPayload = event.kind === 'artifact.created' ? event.data.artifact : null;

        return (
          <article key={event.id} className="relative pb-10">
            <div className="absolute left-[-28px] top-2 h-3 w-3 rounded-full border border-weflora-teal bg-white" />

            <header className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs text-slate-400">{new Date(event.created_at).toLocaleString()}</p>
                <p className="mt-2 text-base font-semibold text-slate-900">{agentLabel}</p>
              </div>
              <span
                className={`inline-flex items-center rounded-full border border-slate-200 px-2 py-0.5 text-xs ${
                  statusClasses[String(status)] ?? 'text-slate-600'
                }`}
              >
                {String(status)}
              </span>
            </header>

            <div className="mt-5 space-y-5">
              <section>
                <p className="mt-2 text-sm text-slate-900">{summary}</p>
                {rationale ? <p className="mt-2 text-sm text-slate-600">{rationale}</p> : null}
              </section>

              {event.kind === 'step.output' && event.data.output?.mode === 'insufficient_data' && event.data.output?.insufficient_data ? (
                <section className="space-y-3">
                  <div>
                    <ul className="mt-2 list-disc pl-5 text-sm text-slate-700">
                      {event.data.output.insufficient_data.missing.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="mt-2 text-sm text-slate-600">These inputs are required to complete this step.</p>
                  </div>
                  <div>
                    {event.data.output.insufficient_data.recommended_next?.length ? (
                      <ul className="mt-2 list-disc pl-5 text-sm text-slate-700">
                        {event.data.output.insufficient_data.recommended_next.map((item) => (
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
                {artifactPayload ? (
                  <div className="mt-2 text-sm text-slate-600">
                    {artifactPayload.title ?? artifactPayload.type}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">No artifacts or actions emitted.</p>
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
