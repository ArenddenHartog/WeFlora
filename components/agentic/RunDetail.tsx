import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { demoRuns } from '../../src/agentic/fixtures/demoRuns.ts';
import { findStoredSession } from '../../src/agentic/sessions/storage';
import LivingRecordRenderer from './RunTimeline';
import { HistoryIcon } from '../icons';
import PageShell from '../ui/PageShell';
import { btnSecondary } from '../../src/ui/tokens';

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

/**
 * RunDetail — Session detail view.
 *
 * Uses outcome-first two-column layout (Part 3 mandatory):
 * LEFT: Outcome / Decision / Conclusions / Confidence / Actions / Artifacts
 * RIGHT: Evidence / Vault sources / Input mappings / Steps / Provenance / Mutations
 *
 * No tabs. No hiding. Both columns always visible.
 */
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
        events: stored.events,
      }
    : demoRuns.find((item) => item.id === runId) ?? demoRuns[0];

  if (!run) {
    return (
      <PageShell icon={<HistoryIcon className="h-5 w-5" />} title="Session not found">
        <p className="text-sm text-slate-500">The requested session could not be found.</p>
        <Link to="/sessions" className="mt-4 inline-block text-sm text-weflora-teal underline">
          Back to Sessions
        </Link>
      </PageShell>
    );
  }

  return (
    <PageShell
      icon={<HistoryIcon className="h-5 w-5" />}
      title={run.title}
      meta={`Scope: ${run.scopeId} · Created: ${new Date(run.createdAt).toLocaleString()}`}
      actions={
        <>
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${statusBadgeClass(run.status)}`}>
            {run.status}
          </span>
          <Link to="/sessions/new" className={btnSecondary}>
            Start new session
          </Link>
        </>
      }
    >
      <Link to="/sessions" className="text-xs text-slate-500 hover:text-slate-700">
        ← Back to Sessions
      </Link>

      {/* Two-column outcome-first layout — no tabs, no hiding */}
      <div className="mt-6">
        <LivingRecordRenderer events={run.events} />
      </div>
    </PageShell>
  );
};

export default RunDetail;
