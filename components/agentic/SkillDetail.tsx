import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { SparklesIcon } from '../icons';
import PageShell from '../ui/PageShell';
import { agentProfilesContract } from '../../src/agentic/registry/agents.ts';
import { buildSkillContractMeta } from '../../src/agentic/contracts/contractCatalog';
import {
  deriveVaultInventoryRecords,
  fetchVaultInventorySources,
  type VaultInventoryRecord
} from '../../services/vaultInventoryService';
import { useProject } from '../../contexts/ProjectContext';
import { useUI } from '../../contexts/UIContext';
import { loadStoredSessions } from '../../src/agentic/sessions/storage';
import { flowTemplates } from '../../src/agentic/registry/flows';

const SkillDetail: React.FC = () => {
  const { agentId } = useParams();
  const navigate = useNavigate();
  const profile = agentProfilesContract.find((item) => item.id === agentId);
  const [copied, setCopied] = useState(false);
  const { projects } = useProject();
  const { selectedProjectId } = useUI();
  const [activeTab, setActiveTab] = useState<'contract' | 'readiness' | 'outputs' | 'evidence' | 'history'>('contract');
  const [vaultRecords, setVaultRecords] = useState<VaultInventoryRecord[]>([]);
  const [isLoadingVault, setIsLoadingVault] = useState(false);

  const payloadSchemaText = useMemo(() => {
    if (!profile) return '';
    return JSON.stringify(profile.output.payload_schema, null, 2);
  }, [profile]);
  const handleCopySchema = async () => {
    try {
      await navigator.clipboard.writeText(payloadSchemaText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const contractMeta = useMemo(() => (profile ? buildSkillContractMeta(profile) : null), [profile]);

  const loadVault = useCallback(async () => {
    setIsLoadingVault(true);
    try {
      const { vaultObjects, projectLinks } = await fetchVaultInventorySources(selectedProjectId);
      const derived = deriveVaultInventoryRecords(vaultObjects, projectLinks, projects);
      setVaultRecords(derived);
    } finally {
      setIsLoadingVault(false);
    }
  }, [projects, selectedProjectId]);

  useEffect(() => {
    loadVault();
  }, [loadVault]);

  const relevanceForRecord = useCallback(
    (record: VaultInventoryRecord) => {
      if (!profile) return 'Low';
      const tagMatches = record.tags.filter((tag) => profile.tags.some((p) => p.toLowerCase() === tag.toLowerCase()));
      if (tagMatches.length >= 2) return 'High';
      if (tagMatches.length === 1) return 'Medium';
      if (record.title.toLowerCase().includes(profile.title.toLowerCase())) return 'Medium';
      return 'Low';
    },
    [profile]
  );

  const readiness = useMemo(() => {
    if (!contractMeta) {
      return { required: [], satisfied: [], missing: [], weak: [], status: 'Missing' as const };
    }
    const required = contractMeta.requiredContext.filter((item) => !item.optional);
    const satisfied: Array<{ requirement: typeof required[number]; record: VaultInventoryRecord }> = [];
    const missing: typeof required = [];
    const weak: Array<{ requirement: typeof required[number]; record: VaultInventoryRecord; reason: string }> = [];

    required.forEach((requirement) => {
      const candidates = vaultRecords.filter((record) => record.type === requirement.recordType);
      const best = candidates.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))[0];
      if (!best) {
        missing.push(requirement);
        return;
      }
      if (best.validations.errors.length > 0) {
        weak.push({ requirement, record: best, reason: 'Blocked by validation errors' });
        return;
      }
      if ((best.confidence ?? 0) < requirement.confidenceThreshold) {
        weak.push({ requirement, record: best, reason: 'Confidence below threshold' });
        return;
      }
      satisfied.push({ requirement, record: best });
    });

    let status: 'Ready' | 'Missing' | 'Needs review' | 'Blocked' = 'Ready';
    if (missing.length > 0) status = 'Missing';
    if (weak.some((item) => item.reason.toLowerCase().includes('blocked'))) status = 'Blocked';
    if (status === 'Ready' && weak.length > 0) status = 'Needs review';

    return { required, satisfied, missing, weak, status };
  }, [contractMeta, vaultRecords]);

  const flowUsage = useMemo(() => {
    if (!profile) return [];
    return flowTemplates.filter((flow) => flow.steps.some((step) => step.agent_id === profile.id));
  }, [profile]);

  const runHistory = useMemo(() => {
    if (!profile) return [];
    const sessions = loadStoredSessions();
    return sessions.filter((session) => session.events.some((event) => event.type === 'step.completed' && event.payload.agent_id === profile.id));
  }, [profile]);

  const latestRun = runHistory[0];
  const latestStep = latestRun?.events.find((event) => event.type === 'step.completed' && event.payload.agent_id === profile.id);

  const requiredDataLink = contractMeta
    ? `/vault?types=${encodeURIComponent(contractMeta.requiredContext.map((item) => item.recordType).join(','))}&scope=${
        selectedProjectId ? 'project' : 'global'
      }`
    : '/vault';

  const intakeLink = contractMeta
    ? `/vault?intake=1&types=${encodeURIComponent(contractMeta.requiredContext.map((item) => item.recordType).join(','))}&scope=${
        selectedProjectId ? 'project' : 'global'
      }`
    : '/vault?intake=1';

  if (!profile || !contractMeta) {
    return (
      <div className="bg-white px-4 py-6 md:px-8">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Skill not found</h1>
        <p className="mt-2 text-sm text-slate-500">Skill not found.</p>
        <Link to="/skills" className="mt-4 inline-block text-sm text-weflora-teal underline">
          Back to Skills
        </Link>
      </div>
    );
  }

  return (
    <PageShell
      icon={<SparklesIcon className="h-5 w-5" />}
      title={profile.title}
      meta={
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-slate-100 px-2 py-0.5">v{profile.spec_version}</span>
          {profile.tags.slice(0, 4).map((tag) => (
            <span key={tag} className="rounded-full bg-slate-50 px-2 py-0.5 text-slate-500">
              {tag}
            </span>
          ))}
        </div>
      }
      actions={
        <>
          <button
            type="button"
            onClick={() => setActiveTab('readiness')}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Check readiness
          </button>
          <button
            type="button"
            onClick={() => navigate(requiredDataLink)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            View required data
          </button>
          <Link
            to={`/sessions/new?intent=skill:${profile.id}`}
            className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            Run Skill
          </Link>
        </>
      }
      tabs={
        <div className="flex flex-wrap gap-2 text-xs font-semibold">
          {(['contract', 'readiness', 'outputs', 'evidence', 'history'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`rounded-full px-3 py-1 ${
                activeTab === tab ? 'bg-weflora-mint/20 text-weflora-dark' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab === 'evidence' ? 'Evidence rules' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      }
    >
        <Link to="/skills" className="text-xs text-slate-500 hover:text-slate-700">
          ← Back to Skills
        </Link>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold text-slate-500">Readiness</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">{readiness.status}</p>
            <p className="mt-1 text-xs text-slate-500">
              {readiness.missing.length > 0 ? `${readiness.missing.length} missing` : 'All required context present'}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold text-slate-500">Required Context</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              {contractMeta.requiredContext.map((item) => `${item.recordType}`).join(' · ')}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {contractMeta.requiredContext.map((item) => `${item.recordType} (${item.requiredFields.length})`).join(' · ')}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold text-slate-500">Provenance</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              {contractMeta.evidenceRules.required ? 'Required' : 'Best-effort'}
            </p>
            <p className="mt-1 text-xs text-slate-500">{contractMeta.evidenceRules.allowedSources.join(' · ')}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold text-slate-500">Artifacts</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              {contractMeta.output.artifacts.map((item) => `${item.label} (${item.format})`).join(' · ')}
            </p>
          </div>
        </div>

        {activeTab === 'contract' && (
          <div className="mt-6 space-y-6">
            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-slate-900">Input pointers</h2>
              <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
                <div className="grid grid-cols-[1.6fr_140px_120px_200px_1fr] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2 text-[11px] font-semibold text-slate-500">
                  <span>Pointer path</span>
                  <span>Type</span>
                  <span>Required</span>
                  <span>Allowed sources</span>
                  <span>Notes</span>
                </div>
                {contractMeta.inputPointers.map((input) => (
                  <div key={input.pointer} className="grid grid-cols-[1.6fr_140px_120px_200px_1fr] gap-3 px-4 py-3 text-xs text-slate-600">
                    <span className="font-medium text-slate-700">{input.pointer}</span>
                    <span>{input.type}</span>
                    <span>{input.required ? 'Y' : 'N'}</span>
                    <span>{input.allowedSources.join(', ')}</span>
                    <span>{input.notes ?? '—'}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-slate-900">Required context declaration</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {contractMeta.requiredContext.map((context) => (
                  <div key={context.recordType} className="rounded-lg border border-slate-200 p-4">
                    <p className="text-xs font-semibold text-slate-500">Record type</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{context.recordType}</p>
                    <div className="mt-3 text-xs text-slate-600">
                      <p className="font-semibold text-slate-500">Required fields</p>
                      <ul className="mt-2 space-y-1">
                        {context.requiredFields.map((field) => (
                          <li key={field.name}>{field.name} ({field.type}{field.required ? ', required' : ''})</li>
                        ))}
                      </ul>
                    </div>
                    <div className="mt-3 text-xs text-slate-600">
                      <p className="font-semibold text-slate-500">Accepted sources</p>
                      <p className="mt-1">{context.acceptedSources.join(', ')}</p>
                    </div>
                    <div className="mt-3 text-xs text-slate-600">
                      <p className="font-semibold text-slate-500">Confidence threshold</p>
                      <p className="mt-1">auto-accept ≥ {context.confidenceThreshold.toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-slate-900">Output contract</h2>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-slate-200 p-3 text-xs text-slate-600">
                  <p className="font-semibold text-slate-500">Writes</p>
                  <p className="mt-2">{contractMeta.output.writes.length ? contractMeta.output.writes.join(', ') : 'No declared writes.'}</p>
                  <p className="mt-3 font-semibold text-slate-500">Mutations</p>
                  <p className="mt-2">{contractMeta.output.mutations.length ? contractMeta.output.mutations.join(', ') : 'None'}</p>
                </div>
                <div className="rounded-lg border border-slate-200 p-3 text-xs text-slate-600">
                  <p className="font-semibold text-slate-500">Artifacts</p>
                  <ul className="mt-2 space-y-1">
                    {contractMeta.output.artifacts.map((artifact) => (
                      <li key={artifact.label}>{artifact.label} ({artifact.format})</li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'readiness' && (
          <div className="mt-6 space-y-6">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-slate-900">Coverage panel</h2>
              {isLoadingVault ? (
                <p className="mt-3 text-xs text-slate-500">Loading vault coverage…</p>
              ) : (
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border border-slate-200 p-3">
                    <p className="text-xs font-semibold text-slate-500">Satisfied</p>
                    <div className="mt-3 space-y-3 text-xs text-slate-600">
                      {readiness.satisfied.length === 0 ? (
                        <p>No satisfied requirements yet.</p>
                      ) : (
                        readiness.satisfied.map(({ requirement, record }) => (
                          <div key={record.recordId} className="rounded-lg border border-slate-100 p-3">
                            <p className="font-semibold text-slate-700">{record.title}</p>
                            <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-500">
                              <span>{record.scope}</span>
                              <span>Confidence {record.confidence?.toFixed(2) ?? '—'}</span>
                              <span>Relevance {relevanceForRecord(record)}</span>
                              <span>Field coverage {Math.max(requirement.requiredFields.length - record.completeness.missingCount, 0)} / {requirement.requiredFields.length}</span>
                              <span>Provenance {record.validations.errors.length === 0 ? '✓' : '—'}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3">
                    <p className="text-xs font-semibold text-slate-500">Missing / weak</p>
                    <div className="mt-3 space-y-3 text-xs text-slate-600">
                      {readiness.missing.length === 0 && readiness.weak.length === 0 ? (
                        <p>Nothing missing.</p>
                      ) : (
                        <>
                          {readiness.missing.map((requirement) => (
                            <div key={requirement.recordType} className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                              <p className="font-semibold text-amber-700">Missing {requirement.recordType}</p>
                              <p className="mt-1 text-[11px] text-amber-700">Missing fields: {requirement.requiredFields.map((field) => field.name).join(', ')}</p>
                              <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-amber-700">
                                {contractMeta.inputPointers.filter((input) => input.required).map((input) => (
                                  <span key={input.pointer}>{input.pointer}</span>
                                ))}
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2">
                                <Link to={intakeLink} className="rounded-full border border-amber-300 px-3 py-1 text-[11px] font-semibold text-amber-700 hover:bg-amber-100">
                                  Add now
                                </Link>
                              </div>
                            </div>
                          ))}
                          {readiness.weak.map(({ requirement, record, reason }) => (
                            <div key={record.recordId} className="rounded-lg border border-rose-200 bg-rose-50 p-3">
                              <p className="font-semibold text-rose-700">{record.title}</p>
                              <p className="mt-1 text-[11px] text-rose-700">{reason}</p>
                              <p className="mt-1 text-[11px] text-rose-700">Missing fields: {requirement.requiredFields.map((field) => field.name).join(', ')}</p>
                              <div className="mt-3 flex flex-wrap gap-2">
                                <Link to={`${requiredDataLink}&record=${record.recordId}`} className="rounded-full border border-rose-200 px-3 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100">
                                  Fill manually
                                </Link>
                              </div>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
              <div className="mt-4 text-xs text-slate-500">
                {readiness.status === 'Blocked'
                  ? 'Blocked because at least one required record fails validation.'
                  : readiness.status === 'Missing'
                    ? 'Blocked because required context is missing.'
                    : readiness.status === 'Needs review'
                      ? 'Needs review because confidence is below threshold.'
                      : 'Ready to run.'}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'outputs' && (
          <div className="mt-6 space-y-6">
            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">Expected outputs</h2>
                <button type="button" onClick={handleCopySchema} className="text-xs text-weflora-teal hover:text-weflora-dark">
                  {copied ? 'Copied' : 'Copy JSON'}
                </button>
              </div>
              <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-xs text-slate-600">
                {payloadSchemaText}
              </pre>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-slate-900">Last run outputs</h2>
              {latestStep ? (
                <div className="mt-3 rounded-lg border border-slate-200 p-3 text-xs text-slate-600">
                  <p className="font-semibold text-slate-700">{latestStep.payload.summary}</p>
                  <p className="mt-2 text-xs text-slate-500">Evidence items: {latestStep.payload.evidence?.length ?? 0}</p>
                  <Link to={`/sessions/${latestRun?.session.session_id}`} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                    View lineage
                  </Link>
                </div>
              ) : (
                <p className="mt-3 text-xs text-slate-500">No prior runs captured.</p>
              )}
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-slate-900">Artifact actions</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">Export memo</button>
                <button className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">Save to Worksheet</button>
                <button className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">Link to Report</button>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'evidence' && (
          <div className="mt-6 space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-600">
              <p className="font-semibold text-slate-700">Evidence required?</p>
              <p className="mt-2">{contractMeta.evidenceRules.required ? 'Yes' : 'No'}</p>
              <p className="mt-4 font-semibold text-slate-700">Allowed sources</p>
              <p className="mt-2">{contractMeta.evidenceRules.allowedSources.join(', ')}</p>
              <p className="mt-4 font-semibold text-slate-700">Citation format</p>
              <p className="mt-2">{contractMeta.evidenceRules.citationFormat}</p>
              <p className="mt-4 font-semibold text-slate-700">No evidence rule</p>
              <p className="mt-2">No evidence ⇒ confidence downgrade + review flag</p>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="mt-6 space-y-6">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-slate-900">Past runs</h2>
              <div className="mt-3 space-y-2 text-xs text-slate-600">
                {runHistory.length === 0 ? (
                  <p>No runs recorded.</p>
                ) : (
                  runHistory.slice(0, 5).map((run) => (
                    <Link
                      key={run.session.session_id}
                      to={`/sessions/${run.session.session_id}`}
                      className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50"
                    >
                      <span>{run.session.title}</span>
                      <span className="text-[11px] text-slate-500">{new Date(run.session.created_at).toLocaleDateString()}</span>
                    </Link>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-slate-900">Contract versions</h2>
              <p className="mt-2 text-xs text-slate-500">Spec v{profile.spec_version} · Schema v{profile.schema_version}</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-slate-900">Referenced by flows</h2>
              <div className="mt-3 space-y-2 text-xs text-slate-600">
                {flowUsage.length === 0 ? (
                  <p>No flows reference this skill.</p>
                ) : (
                  flowUsage.map((flow) => (
                    <Link key={flow.id} to={`/flows/${flow.id}`} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50">
                      <span>{flow.title}</span>
                      <span className="text-[11px] text-slate-500">v{flow.template_version}</span>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
    </PageShell>
  );
};

export default SkillDetail;
