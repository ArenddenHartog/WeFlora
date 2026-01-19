import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { agentProfiles } from '../../src/agentic/registry/agents.ts';

const SkillDetail: React.FC = () => {
  const { agentId } = useParams();
  const profile = agentProfiles.find((item) => item.agent_id === agentId);

  if (!profile) {
    return (
      <div className="h-full min-h-0 overflow-y-auto px-8 py-6">
        <p className="text-sm text-slate-500">Skill not found.</p>
        <Link to="/skills" className="mt-4 inline-block text-sm text-weflora-teal underline">
          Back to Skills
        </Link>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto px-8 py-6">
      <div className="mb-6">
        <Link to="/skills" className="text-xs text-slate-500 hover:text-slate-700">
          ← Back to Skills
        </Link>
        <h1 className="mt-3 text-2xl font-semibold text-slate-900">{profile.name}</h1>
        <p className="text-sm text-slate-500">{profile.description}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700">Profile</h3>
          <div className="mt-4 space-y-2 text-sm text-slate-600">
            <div><span className="font-semibold">Agent ID:</span> {profile.agent_id}</div>
            <div><span className="font-semibold">Category:</span> {profile.category}</div>
            <div><span className="font-semibold">Spec version:</span> {profile.spec_version}</div>
            <div><span className="font-semibold">Schema version:</span> {profile.schema_version}</div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700">Inputs</h3>
          <div className="mt-4 space-y-3 text-sm text-slate-600">
            {profile.inputs.length === 0 ? (
              <p>No declared inputs.</p>
            ) : (
              profile.inputs.map((input: any) => (
                <div key={input.id} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                  <p className="font-semibold text-slate-700">{input.label}</p>
                  <p className="text-xs text-slate-500">{input.required ? 'Required' : 'Optional'}</p>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
          <h3 className="text-sm font-semibold text-slate-700">Output Modes</h3>
          <div className="mt-4 flex flex-wrap gap-2">
            {profile.output_modes.map((mode) => (
              <span key={mode} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                {mode}
              </span>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default SkillDetail;
