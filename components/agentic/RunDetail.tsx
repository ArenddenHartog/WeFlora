import React, { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { demoRuns } from '../../src/agentic/fixtures/demoRuns.ts';
import { agentProfiles } from '../../src/agentic/registry/agents.ts';
import RunTimeline from './RunTimeline';

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
      <div className="h-full min-h-0 overflow-y-auto px-8 py-6">
        <p className="text-sm text-slate-500">Run not found.</p>
        <Link to="/runs" className="mt-4 inline-block text-sm text-weflora-teal underline">
          Back to Runs
        </Link>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 overflow-hidden px-8 py-6 flex flex-col">
      <div className="mb-6">
        <Link to="/runs" className="text-xs text-slate-500 hover:text-slate-700">
          ← Back to Runs
        </Link>
        <h1 className="mt-3 text-2xl font-semibold text-slate-900">{run.title}</h1>
        <p className="text-sm text-slate-500">Scope: {run.scopeId}</p>
      </div>
      <div className="flex-1 min-h-0">
        <RunTimeline steps={run.steps} artifacts={run.artifacts} agentNameById={agentNameById} />
      </div>
    </div>
  );
};

export default RunDetail;
