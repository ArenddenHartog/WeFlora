import React from 'react';
import { Link } from 'react-router-dom';
import { demoRuns } from '../../src/agentic/fixtures/demoRuns.ts';

const RunsIndex: React.FC = () => {
  return (
    <div className="min-h-screen px-8 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Sessions</h1>
        <p className="text-sm text-slate-500">Living records of agentic executions.</p>
      </div>
      <div className="border-t border-slate-200 divide-y divide-slate-200">
        {demoRuns.map((run) => (
          <Link
            key={run.id}
            to={`/sessions/${run.id}`}
            className="block py-5"
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
