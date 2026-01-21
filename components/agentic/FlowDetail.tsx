import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { SparklesIcon } from '../icons';
import { flowTemplatesById } from '../../src/agentic/registry/flows.ts';

const FlowDetail: React.FC = () => {
  const { flowId } = useParams();
  const flow = flowId ? flowTemplatesById[flowId] : undefined;
  if (!flow) {
    return (
      <div className="bg-white px-4 py-6 md:px-8">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Flow not found</h1>
        <p className="mt-2 text-sm text-slate-500">Flow not found.</p>
        <Link to="/flows" className="mt-4 inline-block text-sm text-weflora-teal underline">
          Back to Flows
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white px-4 py-6 md:px-8" data-layout-root>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="h-10 w-10 rounded-xl bg-weflora-mint/15 text-weflora-teal flex items-center justify-center">
            <SparklesIcon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{flow.title}</h1>
            <p className="mt-1 text-sm leading-6 text-slate-500">{flow.description}</p>
          </div>
        </div>
        <Link
          to={`/sessions/new?intent=flow:${flow.id}`}
          className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
        >
          Run Flow
        </Link>
      </div>

      <Link to="/flows" className="text-xs text-slate-500 hover:text-slate-700">
        ← Back to Flows
      </Link>

      <div className="mt-10 border-t border-slate-200 divide-y divide-slate-200">
        <section className="py-6">
          <h2 className="text-lg font-semibold text-slate-900">Inputs</h2>
          <div className="mt-3 space-y-3 text-sm leading-6 text-slate-700">
            {flow.inputs.map((input) => (
              <div key={input.key} className="border-b border-slate-100 pb-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-slate-700">{input.label}</p>
                  <span className="text-xs text-slate-500">{input.required ? 'Required' : 'Optional'}</span>
                </div>
                {input.description ? <p className="mt-1 text-xs text-slate-500">{input.description}</p> : null}
                <div className="mt-2 text-xs text-slate-500">Type: {Array.isArray(input.schema.type) ? input.schema.type.join(', ') : input.schema.type}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="py-6">
          <h2 className="text-lg font-semibold text-slate-900">Steps</h2>
          <div className="mt-3 space-y-3 text-sm text-slate-600">
            {flow.steps.map((step, index) => (
              <div key={step.step_id} className="border-b border-slate-100 pb-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-slate-700">{index + 1}. {step.agent_id}</p>
                  <span className="text-xs text-slate-400">{step.step_id}</span>
                </div>
                {step.expected_writes?.length ? (
                  <div className="mt-2 text-xs text-slate-500">Writes: {step.expected_writes.join(', ')}</div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default FlowDetail;
