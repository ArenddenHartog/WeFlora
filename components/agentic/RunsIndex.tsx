import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { HistoryIcon, SparklesIcon, SearchIcon } from '../icons';
import PageShell from '../ui/PageShell';
import { demoRuns } from '../../src/agentic/fixtures/demoRuns.ts';
import { loadStoredSessions } from '../../src/agentic/sessions/storage';
import {
  btnPrimary,
  btnSecondary,
  iconWrap,
  chip,
  tableHeaderRow,
  tableRow,
  muted,
} from '../../src/ui/tokens';

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
      createdAt: item.session.created_at,
    }));
    const runs = [...stored, ...demoRuns];
    const needle = search.trim().toLowerCase();
    if (!needle) return runs;
    return runs.filter((run) =>
      [run.title, run.scopeId, run.status].some((value) => value.toLowerCase().includes(needle)),
    );
  }, [search]);

  return (
    <PageShell
      icon={<HistoryIcon className="h-5 w-5" />}
      title="Sessions"
      actions={
        <Link to="/sessions/new" className={btnPrimary}>
          <SparklesIcon className="h-4 w-4" />
          New Session
        </Link>
      }
    >
      <div className="max-w-md relative">
        <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by title, scope, status…"
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-4 text-sm text-slate-700"
        />
      </div>

      <div className="mt-8">
        {filteredRuns.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-10 text-center">
            <HistoryIcon className="mx-auto h-10 w-10 text-slate-300" />
            <h3 className="mt-4 text-sm font-semibold text-slate-700">No sessions yet</h3>
            <p className="mt-2 text-xs text-slate-500">Run a Skill or Flow to create your first session.</p>
            <Link to="/sessions/new" className={`mt-4 ${btnPrimary}`}>
              <SparklesIcon className="h-4 w-4" />
              New Session
            </Link>
          </div>
        ) : (
          /* Table-like session list */
          <div className="rounded-xl border border-slate-200 bg-white">
            <div className={`grid grid-cols-[1.5fr_1fr_100px_160px] gap-3 px-4 py-3 ${tableHeaderRow}`}>
              <span>Title</span>
              <span>Scope</span>
              <span>Status</span>
              <span>Created</span>
            </div>
            <div className="divide-y divide-slate-100">
              {filteredRuns.map((run) => (
                <Link
                  key={run.id}
                  to={`/sessions/${run.id}`}
                  className={`grid grid-cols-[1.5fr_1fr_100px_160px] items-center gap-3 px-4 py-3 ${tableRow}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`${iconWrap} h-8 w-8 rounded-lg flex-shrink-0`}>
                      <HistoryIcon className="h-4 w-4" />
                    </div>
                    <span className="font-semibold text-slate-900 truncate">{run.title}</span>
                  </div>
                  <span className={muted}>{run.scopeId}</span>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs w-fit ${statusBadgeClass(run.status)}`}>
                    {run.status}
                  </span>
                  <span className={muted}>{new Date(run.createdAt).toLocaleString()}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
};

export default RunsIndex;
