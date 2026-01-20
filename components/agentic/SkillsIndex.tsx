import React from 'react';
import { Link } from 'react-router-dom';
import { agentProfilesContract } from '../../src/agentic/registry/agents.ts';

const SkillsIndex: React.FC = () => {
  return (
    <div className="px-8 py-6 bg-white" data-layout-root>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Skills</h1>
        <p className="text-sm text-slate-500">Browse agent profiles and their evidence-ready output contracts.</p>
      </div>
      <div className="border-t border-slate-200 divide-y divide-slate-200">
        {agentProfilesContract.map((profile) => (
          <Link key={profile.id} to={`/skills/${profile.id}`} className="block py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">{profile.title}</h3>
              </div>
              <span className="text-[11px] text-slate-400">v{profile.spec_version}</span>
            </div>
            <p className="mt-3 text-sm text-slate-600">{profile.description}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {profile.tags.slice(0, 3).map((tag) => (
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
