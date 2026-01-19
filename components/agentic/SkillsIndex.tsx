import React from 'react';
import { Link } from 'react-router-dom';
import { agentProfiles } from '../../src/agentic/registry/agents.ts';

const SkillsIndex: React.FC = () => {
  return (
    <div className="h-full min-h-0 overflow-y-auto px-8 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Skills</h1>
        <p className="text-sm text-slate-500">Browse agent profiles and their evidence-ready output contracts.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {agentProfiles.map((profile) => (
          <Link
            key={profile.agent_id}
            to={`/skills/${profile.agent_id}`}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-weflora-teal transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-base font-semibold text-slate-900">{profile.name}</h3>
                <p className="text-xs uppercase text-slate-400 mt-1">{profile.category}</p>
              </div>
              <span className="text-[11px] text-slate-400">v{profile.spec_version}</span>
            </div>
            <p className="mt-3 text-sm text-slate-600">{profile.description}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {(profile.tags ?? []).map((tag) => (
                <span key={tag} className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                  {tag}
                </span>
              ))}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default SkillsIndex;
