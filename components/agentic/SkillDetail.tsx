import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { agentProfilesContract } from '../../src/agentic/registry/agents.ts';

const SkillDetail: React.FC = () => {
  const { agentId } = useParams();
  const profile = agentProfilesContract.find((item) => item.id === agentId);

  if (!profile) {
    return (
      <div className="min-h-screen px-8 py-6">
        <p className="text-sm text-slate-500">Skill not found.</p>
        <Link to="/skills" className="mt-4 inline-block text-sm text-weflora-teal underline">
          Back to Skills
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-8 py-6">
      <div className="mb-6">
        <Link to="/skills" className="text-xs text-slate-500 hover:text-slate-700">
          ← Back to Skills
        </Link>
        <h1 className="mt-3 text-2xl font-semibold text-slate-900">{profile.title}</h1>
        <p className="text-sm text-slate-500">{profile.description}</p>
      </div>

      <div className="border-t border-slate-200 divide-y divide-slate-200">
        <section className="py-6">
          <h3 className="text-sm font-semibold text-slate-700">Profile</h3>
          <div className="mt-3 grid gap-2 text-sm text-slate-600">
            <div><span className="font-semibold">Agent ID:</span> {profile.id}</div>
            <div><span className="font-semibold">Category:</span> {profile.category}</div>
            <div><span className="font-semibold">Spec version:</span> {profile.spec_version}</div>
            <div><span className="font-semibold">Schema version:</span> {profile.schema_version}</div>
          </div>
        </section>

        <section className="py-6">
          <h3 className="text-sm font-semibold text-slate-700">Inputs</h3>
          <div className="mt-3 space-y-3 text-sm text-slate-600">
            {profile.inputs.length === 0 ? (
              <p>No declared inputs.</p>
            ) : (
              profile.inputs.map((input) => (
                <div key={input.key} className="border-b border-slate-100 pb-3">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-slate-700">{input.label}</p>
                    <span className="text-xs text-slate-500">{input.required ? 'Required' : 'Optional'}</span>
                  </div>
                  {input.description ? <p className="mt-1 text-xs text-slate-500">{input.description}</p> : null}
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                    <span>Source: {input.source}</span>
                    {input.pointer ? <span>Pointer: {input.pointer}</span> : null}
                    {input.schema.type ? <span>Type: {Array.isArray(input.schema.type) ? input.schema.type.join(', ') : input.schema.type}</span> : null}
                    {input.ui?.control ? <span>Control: {input.ui.control}</span> : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="py-6">
          <h3 className="text-sm font-semibold text-slate-700">Output Modes</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {profile.output.modes.map((mode) => (
              <span key={mode} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                {mode}
              </span>
            ))}
          </div>
        </section>

        <section className="py-6">
          <h3 className="text-sm font-semibold text-slate-700">Output Schema (payload)</h3>
          <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-xs text-slate-600">
            {JSON.stringify(profile.output.payload_schema, null, 2)}
          </pre>
        </section>

        <section className="py-6">
          <h3 className="text-sm font-semibold text-slate-700">Fixtures</h3>
          {profile.fixtures ? (
            <div className="mt-3 space-y-4 text-xs text-slate-600">
              <div>
                <p className="font-semibold text-slate-700">Minimal OK Input</p>
                <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-4">
                  {JSON.stringify(profile.fixtures.minimal_ok_input, null, 2)}
                </pre>
              </div>
              <div>
                <p className="font-semibold text-slate-700">Example Outputs</p>
                <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-4">
                  {JSON.stringify(profile.fixtures.example_outputs, null, 2)}
                </pre>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-500">No fixtures declared yet.</p>
          )}
        </section>
      </div>
    </div>
  );
};

export default SkillDetail;
