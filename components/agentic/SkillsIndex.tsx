import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SparklesIcon } from '../icons';
import PageShell from '../ui/PageShell';
import { agentProfilesContract } from '../../src/agentic/registry/agents.ts';

const SkillsIndex: React.FC = () => {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return agentProfilesContract;
    return agentProfilesContract.filter((profile) =>
      [profile.title, profile.description, ...profile.tags].some((value) =>
        value.toLowerCase().includes(needle)
      )
    );
  }, [search]);

  return (
    <div className="bg-white" data-layout-root>
      <PageShell
        icon={<SparklesIcon className="h-5 w-5" />}
        title="Skills"
        actions={
          <>
            <Link
              to="/sessions/new"
              className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              Run Skill
            </Link>
            <Link
              to="/flows"
              className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              View Flows
            </Link>
          </>
        }
      >
        <div className="max-w-md">
          <label className="text-xs font-semibold text-slate-600">Search skills</label>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name or tag"
            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
          />
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((profile) => (
            <div
              key={profile.id}
              className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-slate-300 hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div className="h-10 w-10 rounded-xl bg-weflora-mint/15 text-weflora-teal flex items-center justify-center">
                  <SparklesIcon className="h-5 w-5" />
                </div>
                <span className="text-xs font-semibold text-slate-500">v{profile.spec_version}</span>
              </div>
              <Link to={`/skills/${profile.id}`} className="mt-4">
                <h3 className="text-lg font-bold text-slate-800">{profile.title}</h3>
                <p className="mt-2 text-sm text-slate-600 line-clamp-2">{profile.description}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {profile.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                      {tag}
                    </span>
                  ))}
                </div>
              </Link>
              <div className="mt-auto pt-4">
                <Link
                  to={`/sessions/new?intent=skill:${profile.id}`}
                  className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 group-hover:bg-weflora-mint/10"
                >
                  Run
                </Link>
              </div>
            </div>
          ))}
        </div>
      </PageShell>
    </div>
  );
};

export default SkillsIndex;
