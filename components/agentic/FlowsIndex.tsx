import React from 'react';
import { Link } from 'react-router-dom';
import { flowTemplates } from '../../src/agentic/registry/flows.ts';

const FlowsIndex: React.FC = () => {
  return (
    <div className="min-h-screen px-8 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Flows</h1>
        <p className="text-sm text-slate-500">Pre-built agent sequences that create submission-ready outputs.</p>
      </div>
      <div className="border-t border-slate-200 divide-y divide-slate-200">
        {flowTemplates.map((flow) => (
          <Link key={flow.id} to={`/flows/${flow.id}`} className="block py-5">
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
        ))}
      </div>
    </div>
  );
};

export default FlowsIndex;
