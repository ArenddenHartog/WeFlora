import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { demoRuns } from '../../src/agentic/fixtures/demoRuns.ts';
import { findStoredSession } from '../../src/agentic/sessions/storage';
import LivingRecordRenderer from './RunTimeline';
import { HistoryIcon } from '../icons';

const statusBadgeClass = (status: string) => {
  switch (status) {
    case 'complete':
      return 'bg-weflora-mint/20 text-weflora-teal border border-weflora-mint/40';
    case 'partial':
      return 'bg-amber-50 text-amber-700 border border-amber-200';
    case 'failed':
    case 'canceled':
      return 'bg-rose-50 text-rose-700 border border-rose-200';
    case 'running':
    default:
      return 'bg-slate-50 text-slate-700 border border-slate-200';
  }
};

const RunDetail: React.FC = () => {
  const { runId } = useParams();
  const stored = runId ? findStoredSession(runId) : undefined;
  const run = stored
    ? {
        id: stored.session.session_id,
        scopeId: stored.session.scope_id,
        title: stored.session.title,
        status: stored.session.status,
        createdAt: stored.session.created_at,
        events: stored.events
      }
    : demoRuns.find((item) => item.id === runId) ?? demoRuns[0];

  if (!run) {
    return (
      <div className="bg-white px-4 py-6 md:px-8">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Session not found</h1>
        <p className="mt-2 text-sm text-slate-500">Session not found.</p>
        <Link to="/sessions" className="mt-4 inline-block text-sm text-weflora-teal underline">
          Back to Sessions
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white px-4 py-6 md:px-8" data-layout-root>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="h-10 w-10 rounded-xl bg-weflora-mint/15 text-weflora-teal flex items-center justify-center">
            <HistoryIcon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{run.title}</h1>
            <p className="mt-1 text-sm leading-6 text-slate-500">Scope: {run.scopeId}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${statusBadgeClass(run.status)}`}>
            {run.status}
          </span>
          <Link
            to="/sessions/new"
            className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Start new session
          </Link>
        </div>
      </div>

      <Link to="/sessions" className="text-xs text-slate-500 hover:text-slate-700">
        ← Back to Sessions
      </Link>

      <div className="mt-10">
        <LivingRecordRenderer events={run.events} />
      </div>
    </div>
  );
};

export default RunDetail;
