import React from 'react';
import { Link } from 'react-router-dom';
import AppPage from '../AppPage';
import { flowTemplates } from '../../src/agentic/registry/flows.ts';

const FlowsIndex: React.FC = () => {
  const primaryFlow = flowTemplates[0];

  return (
    <AppPage
      title="Flows"
      subtitle="Pre-built agent sequences that create submission-ready outputs."
      actions={
        primaryFlow ? (
          <Link
            to={`/flows/${primaryFlow.id}?mode=run`}
            className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            Run Flow
          </Link>
        ) : null
      }
    >
      <div className="border-t border-slate-200 divide-y divide-slate-200">
        {flowTemplates.map((flow) => (
          <div key={flow.id} className="py-5 flex items-start justify-between gap-6">
            <Link to={`/flows/${flow.id}`} className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">{flow.title}</h3>
                  <p className="mt-2 text-sm text-slate-600">{flow.description}</p>
                </div>
                <span className="text-[11px] text-slate-400">v{flow.template_version}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {flow.tags.slice(0, 3).map((tag) => (
                  <span key={tag} className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                    {tag}
                  </span>
                ))}
              </div>
            </Link>
            <div className="flex flex-col items-end gap-2">
              <Link
                to={`/flows/${flow.id}?mode=run`}
                className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Run
              </Link>
            </div>
          </div>
        ))}
      </div>
    </AppPage>
  );
};

export default FlowsIndex;
