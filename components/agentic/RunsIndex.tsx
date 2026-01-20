import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AppPage from '../AppPage';
import { demoRuns } from '../../src/agentic/fixtures/demoRuns.ts';

const RunsIndex: React.FC = () => {
  const [search, setSearch] = useState('');
  const filteredRuns = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return demoRuns;
    return demoRuns.filter((run) =>
      [run.title, run.scopeId, run.status].some((value) => value.toLowerCase().includes(needle))
    );
  }, [search]);

  return (
    <AppPage
      title="Sessions"
      subtitle="Living records of agentic executions."
      actions={
        <Link
          to="/flows"
          className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
        >
          Start Session
        </Link>
      }
      toolbar={
        <div className="max-w-md">
          <label className="text-xs font-semibold text-slate-600">Search sessions</label>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by title, scope, status"
            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
          />
        </div>
      }
    >
      <div className="border-t border-slate-200 divide-y divide-slate-200">
        {filteredRuns.map((run) => (
          <div key={run.id} className="py-5 flex items-center justify-between gap-6">
            <Link to={`/sessions/${run.id}`} className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">{run.title}</h3>
                  <p className="text-xs text-slate-500">Scope: {run.scopeId}</p>
                </div>
                <span className="text-xs text-slate-500">{run.status}</span>
              </div>
              <div className="mt-3 text-xs text-slate-400">{new Date(run.createdAt).toLocaleString()}</div>
            </Link>
            <div className="flex items-center gap-2">
              <Link
                to={`/sessions/${run.id}`}
                className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Open
              </Link>
              <Link
                to="/flows"
                className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Run Again
              </Link>
            </div>
          </div>
        ))}
      </div>
    </AppPage>
  );
};

export default RunsIndex;
