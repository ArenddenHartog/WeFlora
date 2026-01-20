import React from 'react';
import { Link } from 'react-router-dom';
import AppPage from '../AppPage';
import { agentProfilesContract } from '../../src/agentic/registry/agents.ts';

const SkillsIndex: React.FC = () => {
  const primarySkill = agentProfilesContract[0];

  return (
    <AppPage
      title="Skills"
      subtitle="Browse agent profiles and their evidence-ready output contracts."
      actions={
        primarySkill ? (
          <Link
            to={`/skills/${primarySkill.id}?mode=run`}
            className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            Run Skill
          </Link>
        ) : null
      }
    >
      <div className="border-t border-slate-200 divide-y divide-slate-200">
        {agentProfilesContract.map((profile) => (
          <div key={profile.id} className="py-5 flex items-start justify-between gap-6">
            <Link to={`/skills/${profile.id}`} className="flex-1 min-w-0">
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
            <div className="flex flex-col items-end gap-2">
              <Link
                to={`/skills/${profile.id}?mode=run`}
                className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Run
              </Link>
            </div>
          </div>
        ))}
      </div>
    </AppPage>
  );
};

export default SkillsIndex;
