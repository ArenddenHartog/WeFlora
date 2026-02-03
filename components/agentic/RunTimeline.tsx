import React, { useMemo } from 'react';
import type { EventRecord, StepCompletedEvent, StepStartedEvent } from '../../src/agentic/contracts/ledger';
import type { VaultPointer } from '../../src/agentic/contracts/vault';
import { normalizeEvents } from '../../src/agentic/ledger/normalizeEvents';
import { isDev } from '@/utils/env';

interface RunTimelineProps {
  events: EventRecord[];
}

const statusClasses: Record<string, string> = {
  ok: 'bg-weflora-mint/20 text-weflora-teal border border-weflora-mint/40',
  insufficient_data: 'bg-amber-50 text-amber-700 border border-amber-200',
  partial: 'bg-amber-50 text-amber-700 border border-amber-200',
  rejected: 'bg-rose-50 text-rose-700 border border-rose-200',
  error: 'bg-rose-50 text-rose-700 border border-rose-200',
  running: 'bg-slate-50 text-slate-700 border border-slate-200'
};

const asStepStarted = (event: EventRecord): event is StepStartedEvent => event.type === 'step.started';
const asStepCompleted = (event: EventRecord): event is StepCompletedEvent => event.type === 'step.completed';

const LivingRecordRenderer: React.FC<RunTimelineProps> = ({ events }) => {
  const orderedEvents = useMemo(() => normalizeEvents(events), [events]);

  const timelineBlocks = useMemo(() => {
    const stepGroups = new Map<
      string,
      { order: number; stepId: string; stepStart?: StepStartedEvent; stepCompleted?: StepCompletedEvent }
    >();
    const blocks: Array<{ kind: 'step' | 'event'; order: number; stepId?: string; event?: EventRecord }> = [];

    orderedEvents.forEach((event, index) => {
      if (asStepStarted(event) || asStepCompleted(event)) {
        const stepId = event.payload.step_id;
        const existing = stepGroups.get(stepId);
        if (!existing) {
          const group = { order: index, stepId } as {
            order: number;
            stepId: string;
            stepStart?: StepStartedEvent;
            stepCompleted?: StepCompletedEvent;
          };
          if (asStepStarted(event)) group.stepStart = event;
          if (asStepCompleted(event)) group.stepCompleted = event;
          stepGroups.set(stepId, group);
          blocks.push({ kind: 'step', order: index, stepId });
        } else {
          if (asStepStarted(event) && !existing.stepStart) existing.stepStart = event;
          if (asStepCompleted(event) && !existing.stepCompleted) existing.stepCompleted = event;
        }
        return;
      }
      blocks.push({ kind: 'event', order: index, event });
    });

    return { blocks, stepGroups };
  }, [orderedEvents]);

  return (
    <div className="relative">
      <div className="absolute left-2 top-0 h-full w-px bg-slate-200" />
      <div className="space-y-10 pl-8">
        {timelineBlocks.blocks.map((block) => {
          if (block.kind === 'event' && block.event) {
            const event = block.event;
            const status = event.type === 'run.completed'
              ? event.payload.status
              : event.type === 'run.started'
                ? 'running'
                : 'ok';
            const title = event.type === 'run.started' ? event.payload.title : event.type.replace('.', ' ');
            return (
              <article key={event.event_id} id={`event-${event.event_id}`} className="relative pb-10">
                <div className="absolute left-[-28px] top-2 h-3 w-3 rounded-full border border-weflora-teal bg-white" />
                <header className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs text-slate-500">{new Date(event.at).toLocaleString()}</p>
                    <p className="mt-2 text-base font-semibold text-slate-900">{title}</p>
                  </div>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${statusClasses[String(status)] ?? 'bg-slate-50 text-slate-700 border border-slate-200'}`}>
                    {String(status)}
                  </span>
                </header>
                <div className="mt-5 space-y-5">
                  <section>
                    <p className="text-xs text-slate-500">What happened</p>
                    <p className="mt-2 text-sm text-slate-700">
                      {event.type === 'run.started'
                        ? 'Run started with the selected inputs.'
                        : event.type === 'run.completed'
                          ? event.payload.summary ?? 'Run completed.'
                          : 'Event recorded.'}
                    </p>
                  </section>
                </div>
              </article>
            );
          }

          const stepGroup = block.stepId ? timelineBlocks.stepGroups.get(block.stepId) : undefined;
          if (!stepGroup) return null;

          const { stepStart, stepCompleted } = stepGroup;
          const status = stepCompleted?.payload.status ?? 'running';
          const stepTitle = stepCompleted
            ? stepStart?.payload.title ?? stepCompleted.payload.agent_id
            : stepStart?.payload.title ?? stepStart?.payload.agent_id ?? 'Step';
          const stepInputs: Record<string, VaultPointer> = stepStart?.payload.inputs ?? {};
          const mutations = stepCompleted?.payload.mutations ?? [];
          const evidence = stepCompleted?.payload.evidence ?? [];
          const assumptions = stepCompleted?.payload.assumptions ?? [];
          const actions = stepCompleted?.payload.actions ?? [];
          const outputs = stepCompleted?.payload.output
            ? [{ path: '/outputs/agent_output', pointer: stepCompleted.payload.output.pointer }]
            : [];
          const anchorId = stepCompleted?.event_id ?? stepStart?.event_id ?? stepGroup.stepId;
          const timestamp = stepCompleted?.at ?? stepStart?.at ?? new Date().toISOString();

          return (
            <article key={stepGroup.stepId} id={`event-${anchorId}`} className="relative pb-10">
              <div className="absolute left-[-28px] top-2 h-3 w-3 rounded-full border border-weflora-teal bg-white" />

              <header className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs text-slate-500">{new Date(timestamp).toLocaleString()}</p>
                  <p className="mt-2 text-base font-semibold text-slate-900">{stepTitle}</p>
                </div>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${statusClasses[String(status)] ?? 'bg-slate-50 text-slate-700 border border-slate-200'}`}>
                  {String(status)}
                </span>
              </header>

              <div className="mt-5 space-y-5">
                <section>
                  <p className="text-xs text-slate-500">What happened</p>
                  <p className="mt-2 text-sm text-slate-700">
                    {stepCompleted?.payload.summary ?? 'Step in progress.'}
                  </p>
                </section>

                {stepCompleted?.payload.status === 'insufficient_data' && stepCompleted.payload.insufficient_data ? (
                  <section className="space-y-3">
                    <p className="text-xs text-slate-500">Missing inputs</p>
                    <div>
                      <ul className="mt-2 list-disc pl-5 text-sm text-slate-700">
                        {stepCompleted.payload.insufficient_data.missing.map((item) => (
                          <li key={item.path}>{item.label}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="mt-2 text-sm text-slate-600">These inputs are required to complete this step.</p>
                    </div>
                    <div>
                      {stepCompleted.payload.insufficient_data.recommended_next?.length ? (
                        <ul className="mt-2 list-disc pl-5 text-sm text-slate-700">
                          {stepCompleted.payload.insufficient_data.recommended_next.map((item) => (
                            <li key={item.label}>{item.label}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-2 text-sm text-slate-600">Provide the missing inputs to continue.</p>
                      )}
                    </div>
                  </section>
                ) : null}

                <section>
                  <p className="text-xs text-slate-500">Inputs</p>
                  {Object.keys(stepInputs).length === 0 ? (
                    <p className="mt-2 text-sm text-slate-500">No inputs captured for this step.</p>
                  ) : (
                    <ul className="mt-2 space-y-1 text-xs text-slate-700">
                      {Object.entries(stepInputs).map(([path, pointer]) => (
                        <li key={path} className="font-mono">
                          {path} → {pointer.label ?? pointer.ref.vault_id}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section>
                  <p className="text-xs text-slate-500">Outputs</p>
                  {outputs.length === 0 ? (
                    <p className="mt-2 text-sm text-slate-500">No outputs recorded for this step.</p>
                  ) : (
                    <ul className="mt-2 space-y-1 text-xs text-slate-700">
                      {outputs.map((item) => (
                        <li key={item.path} className="font-mono">
                          {item.path} → {item.pointer.label ?? item.pointer.ref.vault_id}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section>
                  <p className="text-xs text-slate-500">Mutations</p>
                  {mutations.length === 0 ? (
                    <p className="mt-2 text-sm text-slate-500">No pointer mutations recorded.</p>
                  ) : (
                    <ul className="mt-2 space-y-1 text-xs text-slate-700">
                      {mutations.map((item, index) => (
                        <li key={`${item.path}-${index}`} className="font-mono">
                          {item.op} {item.path}
                          {item.value ? ` → ${item.value.label ?? item.value.ref.vault_id}` : ''}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section>
                  <p className="text-xs text-slate-500">Evidence</p>
                  {evidence.length === 0 ? (
                    <p className="mt-2 text-sm text-slate-500">No evidence captured for this step.</p>
                  ) : (
                    <ul className="mt-3 space-y-2 text-sm text-slate-600">
                      {evidence.map((item, index) => (
                        <li key={`${item.label}-${index}`} className="text-sm text-slate-700">
                          {item.label}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section>
                  <p className="text-xs text-slate-500">Assumptions</p>
                  {assumptions.length === 0 ? (
                    <p className="mt-2 text-sm text-slate-500">No assumptions recorded.</p>
                  ) : (
                    <div className="mt-3 space-y-2 text-sm text-slate-600">
                      {assumptions.map((assumption) => (
                        <div key={assumption.statement}>
                          <p className="text-sm text-slate-800">{assumption.statement}</p>
                          {assumption.validate_next ? (
                            <p className="text-xs text-slate-500 mt-1">Validate: {assumption.validate_next}</p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section>
                  <p className="text-xs text-slate-500">Artifacts & actions</p>
                  {actions.length === 0 ? (
                    <p className="mt-2 text-sm text-slate-500">No artifacts or actions emitted.</p>
                  ) : (
                    <ul className="mt-2 space-y-2 text-sm text-slate-700">
                      {actions.map((action) => (
                        <li key={action.action_id}>{action.label}</li>
                      ))}
                    </ul>
                  )}
                </section>

{/* Duplicate suppression display removed - duplicate tracking handled by normalizeEvents */}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
};

export default LivingRecordRenderer;
