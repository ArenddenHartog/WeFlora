import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { agentProfilesContract } from '../../src/agentic/registry/agents.ts';

const SkillDetail: React.FC = () => {
  const { agentId } = useParams();
  const profile = agentProfilesContract.find((item) => item.id === agentId);
  const [copied, setCopied] = useState(false);

  if (!profile) {
    return (
      <div className="px-8 py-6 bg-white" data-layout-root>
        <p className="text-sm text-slate-500">Skill not found.</p>
        <Link to="/skills" className="mt-4 inline-block text-sm text-weflora-teal underline">
          Back to Skills
        </Link>
      </div>
    );
  }

  const payloadSchemaText = JSON.stringify(profile.output.payload_schema, null, 2);
  const handleCopySchema = async () => {
    try {
      await navigator.clipboard.writeText(payloadSchemaText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="px-8 py-6 bg-white" data-layout-root>
      <div className="mb-6">
        <Link to="/skills" className="text-xs text-slate-500 hover:text-slate-700">
          ← Back to Skills
        </Link>
        <h1 className="mt-3 text-2xl font-semibold text-slate-900">{profile.title}</h1>
      </div>

      <div className="border-t border-slate-200 divide-y divide-slate-200">
        <section className="py-6">
          <p className="text-sm text-slate-600">{profile.description}</p>
        </section>

        <section className="py-6">
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
                    <span>Type: {Array.isArray(input.schema.type) ? input.schema.type.join(', ') : input.schema.type}</span>
                    <span>Source: {input.source}</span>
                    {input.pointer ? <span>Pointer: {input.pointer}</span> : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="py-6">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handleCopySchema}
              className="text-xs text-weflora-teal hover:text-weflora-dark"
            >
              {copied ? 'Copied' : 'Copy JSON'}
            </button>
          </div>
          <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-xs text-slate-600">
            {payloadSchemaText}
          </pre>
        </section>

        <section className="py-6">
          {profile.fixtures ? (
            <div className="mt-3 space-y-4 text-xs text-slate-600">
              {(['ok', 'insufficient_data', 'rejected'] as const).map((mode) => {
                const example = profile.fixtures?.example_outputs?.[mode];
                if (!example) return null;
                return (
                  <div key={mode}>
                    <p className="font-semibold text-slate-700">{mode}</p>
                    <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-4">
                      {JSON.stringify(example, null, 2)}
                    </pre>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-500">No examples available.</p>
          )}
        </section>
      </div>
    </div>
  );
};

export default SkillDetail;
