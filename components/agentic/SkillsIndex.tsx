import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SparklesIcon } from '../icons';
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
    <div className="bg-white px-4 py-6 md:px-8" data-layout-root>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="h-10 w-10 rounded-xl bg-weflora-mint/15 text-weflora-teal flex items-center justify-center">
            <SparklesIcon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Skills</h1>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Browse agent profiles and their evidence-ready output contracts.
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Link
            to="/sessions/new"
            className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            Start Session
          </Link>
          <Link to="/flows" className="text-xs text-slate-500 hover:text-slate-700">
            Prefer a flow?
          </Link>
        </div>
      </div>

      <div className="max-w-md">
        <label className="text-xs font-semibold text-slate-600">Search skills</label>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name or tag"
          className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
        />
      </div>

      <div className="mt-10 border-t border-slate-200 divide-y divide-slate-200">
        {filtered.map((profile) => (
          <div key={profile.id} className="py-5 flex items-start justify-between gap-6">
            <Link to={`/skills/${profile.id}`} className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">{profile.title}</h3>
                </div>
                <span className="text-xs text-slate-500">v{profile.spec_version}</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-700">{profile.description}</p>
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
                to={`/sessions/new?intent=skill:${profile.id}`}
                className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Run
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SkillsIndex;
