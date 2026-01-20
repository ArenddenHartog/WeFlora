import React, { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { demoRuns } from '../../src/agentic/fixtures/demoRuns.ts';
import { agentProfiles } from '../../src/agentic/registry/agents.ts';
import LivingRecordRenderer from './RunTimeline';

const RunHeader: React.FC<{ title: string; scopeId: string; status: string }> = ({ title, scopeId, status }) => (
  <div className="border-b border-slate-200 pb-4">
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        <p className="mt-2 text-sm text-slate-600">Scope: {scopeId}</p>
      </div>
      <div className="mt-1 inline-flex items-center rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600">
        {status}
      </div>
    </div>
  </div>
);

const RunDetail: React.FC = () => {
  const { runId } = useParams();
  const run = demoRuns.find((item) => item.id === runId) ?? demoRuns[0];

  const agentNameById = useMemo(() => {
    return agentProfiles.reduce<Record<string, string>>((acc, profile) => {
      acc[profile.agent_id] = profile.name;
      return acc;
    }, {});
  }, []);

  if (!run) {
    return (
      <div className="min-h-screen px-8 py-6">
        <p className="text-sm text-slate-500">Run not found.</p>
        <Link to="/sessions" className="mt-4 inline-block text-sm text-weflora-teal underline">
          Back to Sessions
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-8 py-6 space-y-6">
      <div>
        <Link to="/sessions" className="text-xs text-slate-500 hover:text-slate-700">
          ← Back to Sessions
        </Link>
      </div>
      <RunHeader title={run.title} scopeId={run.scopeId} status={run.status} />
      <LivingRecordRenderer events={run.events} agentNameById={agentNameById} />
    </div>
  );
};

export default RunDetail;
