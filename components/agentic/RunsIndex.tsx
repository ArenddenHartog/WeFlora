import React from 'react';
import { Link } from 'react-router-dom';
import { demoRuns } from '../../src/agentic/fixtures/demoRuns.ts';

const RunsIndex: React.FC = () => {
  return (
    <div className="h-full min-h-0 overflow-y-auto px-8 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Runs</h1>
        <p className="text-sm text-slate-500">Living records of agentic runs, rendered as timelines.</p>
      </div>
      <div className="space-y-4">
        {demoRuns.map((run) => (
          <Link
            key={run.id}
            to={`/runs/${run.id}`}
            className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-weflora-teal transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900">{run.title}</h3>
                <p className="text-xs text-slate-500">Scope: {run.scopeId}</p>
              </div>
              <span className="text-xs text-slate-500">{run.status}</span>
            </div>
            <div className="mt-3 text-xs text-slate-400">{new Date(run.createdAt).toLocaleString()}</div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default RunsIndex;
