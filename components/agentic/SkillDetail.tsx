import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import AppPage from '../AppPage';
import { useUI } from '../../contexts/UIContext';
import { useProject } from '../../contexts/ProjectContext';
import DataIntakePanel from './DataIntakePanel';
import { agentProfilesContract } from '../../src/agentic/registry/agents.ts';
import { demoRuns } from '../../src/agentic/fixtures/demoRuns.ts';

const SkillDetail: React.FC = () => {
  const { agentId } = useParams();
  const profile = agentProfilesContract.find((item) => item.id === agentId);
  const [copied, setCopied] = useState(false);
  const [runSignal, setRunSignal] = useState(0);
  const { showNotification } = useUI();
  const { files } = useProject();
  const availableFiles = Object.values(files ?? {}).flat();
  const availableSessions = demoRuns.map((run) => ({ id: run.id, title: run.title }));

  if (!profile) {
    return (
      <AppPage title="Skill not found" actions={null}>
        <p className="text-sm text-slate-500">Skill not found.</p>
        <Link to="/skills" className="mt-4 inline-block text-sm text-weflora-teal underline">
          Back to Skills
        </Link>
      </AppPage>
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
    <AppPage
      title={profile.title}
      subtitle={profile.description}
      actions={
        <button
          type="button"
          onClick={() => setRunSignal((prev) => prev + 1)}
          className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
        >
          Run Skill
        </button>
      }
      toolbar={
        <Link to="/skills" className="text-xs text-slate-500 hover:text-slate-700">
          ← Back to Skills
        </Link>
      }
    >
      <div className="border-t border-slate-200 divide-y divide-slate-200">
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
          <DataIntakePanel
            inputs={profile.inputs}
            availableFiles={availableFiles}
            availableSessions={availableSessions}
            runSignal={runSignal}
            onRun={({ valid, missing }) => {
              if (!valid) {
                showNotification(`Missing required inputs: ${missing.join(', ')}`, 'error');
                return;
              }
              showNotification('Skill run queued.', 'success');
            }}
          />
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
    </AppPage>
  );
};

export default SkillDetail;
