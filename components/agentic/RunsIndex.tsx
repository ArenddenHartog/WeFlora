import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { HistoryIcon, SparklesIcon } from '../icons';
import { demoRuns } from '../../src/agentic/fixtures/demoRuns.ts';
import { loadStoredSessions } from '../../src/agentic/sessions/storage';

const statusBadgeClass = (status: string) => {
  switch (status) {
    case 'complete':
      return 'bg-weflora-mint/20 text-weflora-teal border border-weflora-mint/40';
    case 'partial':
    case 'insufficient_data':
      return 'bg-amber-50 text-amber-700 border border-amber-200';
    case 'failed':
    case 'canceled':
      return 'bg-rose-50 text-rose-700 border border-rose-200';
    case 'running':
    default:
      return 'bg-slate-50 text-slate-700 border border-slate-200';
  }
};

const RunsIndex: React.FC = () => {
  const [search, setSearch] = useState('');
  const filteredRuns = useMemo(() => {
    const stored = loadStoredSessions().map((item) => ({
      id: item.session.session_id,
      scopeId: item.session.scope_id,
      title: item.session.title,
      status: item.session.status,
      createdAt: item.session.created_at
    }));
    const runs = [...stored, ...demoRuns];
    const needle = search.trim().toLowerCase();
    if (!needle) return runs;
    return runs.filter((run) =>
      [run.title, run.scopeId, run.status].some((value) => value.toLowerCase().includes(needle))
    );
  }, [search]);

  return (
    <div className="h-full w-full overflow-y-auto bg-white p-4 md:p-8" data-layout-root>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-xl bg-weflora-mint/15 text-weflora-teal flex items-center justify-center">
              <HistoryIcon className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Sessions</h1>
            </div>
          </div>
          <Link
            to="/sessions/new"
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            <SparklesIcon className="h-4 w-4" />
            New Session
          </Link>
        </div>

        <div className="max-w-md">
          <label className="text-xs font-semibold text-slate-600">Search sessions</label>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by title, scope, status"
            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
          />
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {filteredRuns.map((run) => (
          <div
            key={run.id}
            className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-slate-300 hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <div className="h-10 w-10 rounded-xl bg-weflora-mint/15 text-weflora-teal flex items-center justify-center">
                <HistoryIcon className="h-5 w-5" />
              </div>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${statusBadgeClass(run.status)}`}>
                {run.status}
              </span>
            </div>
            <Link to={`/sessions/${run.id}`} className="mt-4">
              <h3 className="text-lg font-bold text-slate-800">{run.title}</h3>
              <p className="mt-2 text-xs text-slate-500">Scope: {run.scopeId}</p>
              <p className="mt-2 text-xs text-slate-500">{new Date(run.createdAt).toLocaleString()}</p>
            </Link>
            <div className="mt-auto pt-4">
              <Link
                to={`/sessions/${run.id}`}
                className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 group-hover:bg-weflora-mint/10"
              >
                Open
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RunsIndex;
