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
    <div className="bg-white px-4 py-6 md:px-8">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="h-10 w-10 rounded-xl bg-weflora-mint/15 text-weflora-teal flex items-center justify-center">
            <HistoryIcon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Sessions</h1>
            <p className="mt-1 text-sm leading-6 text-slate-500">Living records of agentic executions.</p>
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

      <div className="mt-10 border-t border-slate-200 divide-y divide-slate-200">
        {filteredRuns.map((run) => (
          <div key={run.id} className="py-5 flex items-center justify-between gap-6">
            <Link to={`/sessions/${run.id}`} className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">{run.title}</h3>
                  <p className="text-xs text-slate-500">Scope: {run.scopeId}</p>
                </div>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${statusBadgeClass(run.status)}`}>
                  {run.status}
                </span>
              </div>
              <div className="mt-2 text-xs text-slate-500">{new Date(run.createdAt).toLocaleString()}</div>
            </Link>
            <div className="flex items-center gap-2">
              <Link
                to={`/sessions/${run.id}`}
                className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
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
