import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { flowTemplatesById } from '../../src/agentic/registry/flows.ts';

const FlowDetail: React.FC = () => {
  const { flowId } = useParams();
  const flow = flowId ? flowTemplatesById[flowId] : undefined;

  if (!flow) {
    return (
      <div className="px-8 py-6 bg-white" data-layout-root>
        <p className="text-sm text-slate-500">Flow not found.</p>
        <Link to="/flows" className="mt-4 inline-block text-sm text-weflora-teal underline">
          Back to Flows
        </Link>
      </div>
    );
  }

  return (
    <div className="px-8 py-6 bg-white" data-layout-root>
      <div className="mb-6">
        <Link to="/flows" className="text-xs text-slate-500 hover:text-slate-700">
          ← Back to Flows
        </Link>
        <h1 className="mt-3 text-2xl font-semibold text-slate-900">{flow.title}</h1>
        <p className="text-sm text-slate-500">{flow.description}</p>
      </div>

      <div className="border-t border-slate-200 divide-y divide-slate-200">
        <section className="py-6">
          <h3 className="text-sm font-semibold text-slate-700">Inputs</h3>
          <div className="mt-3 space-y-3 text-sm text-slate-600">
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
          <h3 className="text-sm font-semibold text-slate-700">Steps</h3>
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
