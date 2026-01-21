import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { agentProfilesContract } from '../../src/agentic/registry/agents';
import { flowTemplatesById } from '../../src/agentic/registry/flows';
import { useProject } from '../../contexts/ProjectContext';
import { useUI } from '../../contexts/UIContext';
import { addStoredSession } from '../../src/agentic/sessions/storage';
import type { EventRecord, Session } from '../../src/agentic/contracts/ledger';
import type { RunContext } from '../../src/agentic/contracts/run_context';
import type { VaultPointer } from '../../src/agentic/contracts/vault';
import { linkVaultObjectsToProject, uploadToGlobalVault, VaultObject, VaultLink } from '../../services/fileService';
import WizardHeader from './wizard/WizardHeader';
import StepVault, { type VaultUploadItem } from './wizard/StepVault';
import StepSelectSkills from './wizard/StepSelectSkills';
import StepConfirmRun from './wizard/StepConfirmRun';
import type { SessionIntent } from '../../src/agentic/intents/sessionIntent';

interface SessionWizardProps {
  intent: SessionIntent;
}

type RunVaultItemRef = {
  vaultObjectId: string;
  label?: string | null;
  projectLink?: {
    projectId: string;
    linkId: string;
  } | null;
};

const SessionWizard: React.FC<SessionWizardProps> = ({ intent }) => {
  const navigate = useNavigate();
  const { projects } = useProject();
  const { showNotification } = useUI();

  const [stepIndex, setStepIndex] = useState(0);
  const [vaultItems, setVaultItems] = useState<VaultUploadItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [saveToProject, setSaveToProject] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);
  const [showFlows, setShowFlows] = useState(false);
  const [runMode, setRunMode] = useState<'sequence' | 'parallel'>('sequence');
  const [allowPartial, setAllowPartial] = useState(true);
  const [quickInputs, setQuickInputs] = useState({ region: '', municipality: '', policyScope: '' });
  const [geometry, setGeometry] = useState({ mode: 'none' as const, corridorWidth: '', polygonGeoJson: '' });

  const projectOptions = useMemo(() => {
    return projects.map((project) => ({ id: project.id, name: project.name }));
  }, [projects]);

  useEffect(() => {
    if (intent.kind === 'skill') {
      setSelectedSkillIds([intent.id]);
    }
    if (intent.kind === 'flow') {
      const flow = flowTemplatesById[intent.id];
      setSelectedFlowId(intent.id);
      setShowFlows(true);
      if (flow) {
        setSelectedSkillIds(flow.steps.map((step) => step.agent_id));
      }
    }
  }, [intent]);

  const handleUpload = async (files: File[]) => {
    try {
      setIsUploading(true);
      const uploadedObjects = await uploadToGlobalVault(files);
      let links: VaultLink[] = [];
      if (saveToProject && selectedProjectId) {
        links = await linkVaultObjectsToProject(selectedProjectId, uploadedObjects.map((item) => item.id));
      }
      const linkByObject = new Map<string, VaultLink>();
      links.forEach((link) => linkByObject.set(link.vaultObjectId, link));

      const items: VaultUploadItem[] = uploadedObjects.map((vaultObject) => ({
        vaultObject,
        projectLink: linkByObject.get(vaultObject.id) ?? null
      }));
      setVaultItems((prev) => [...prev, ...items]);
      showNotification('Upload complete.', 'success');
    } catch (error) {
      showNotification(error instanceof Error ? error.message : 'Upload failed.', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleToggleSkill = (skillId: string) => {
    setSelectedSkillIds((prev) =>
      prev.includes(skillId) ? prev.filter((id) => id !== skillId) : [...prev, skillId]
    );
  };

  const handleFlowSelect = (flowId: string) => {
    setSelectedFlowId(flowId);
    const flow = flowTemplatesById[flowId];
    if (flow) {
      setSelectedSkillIds(flow.steps.map((step) => step.agent_id));
    }
  };

  const assumptions = useMemo(() => {
    const items: string[] = [];
    if (vaultItems.length === 0) {
      items.push('No uploaded files yet; steps may run with partial context.');
    }
    if (!quickInputs.region && !quickInputs.municipality) {
      items.push('Region and municipality are unknown; geographic rules may be incomplete.');
    }
    return items;
  }, [vaultItems.length, quickInputs]);

  const handleRun = () => {
    if (selectedSkillIds.length === 0 && !selectedFlowId) {
      showNotification('Select at least one skill or flow.', 'error');
      return;
    }

    const sessionId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const scopeId = selectedProjectId || 'scope-unknown';

    const inputBindings: Record<string, VaultPointer> = {};
    const vaultItemRefs: RunVaultItemRef[] = [];
    vaultItems.forEach((item, index) => {
      const pointerPath = `/inputs/upload_${index + 1}`;
      inputBindings[pointerPath] = {
        ref: { vault_id: item.vaultObject.id, version: 1 },
        label: item.vaultObject.filename
      };
      vaultItemRefs.push({
        vaultObjectId: item.vaultObject.id,
        label: item.vaultObject.filename,
        projectLink: item.projectLink
          ? { projectId: item.projectLink.projectId, linkId: item.projectLink.id }
          : null
      });
    });

    const runKind: RunContext['kind'] = selectedFlowId ? 'flow' : selectedSkillIds.length > 1 ? 'agent_string' : 'skill';
    const runContext: RunContext = {
      run_id: sessionId,
      scope_id: scopeId,
      kind: runKind,
      title: selectedFlowId ? flowTemplatesById[selectedFlowId]?.title ?? 'Session' : 'Session',
      intent: 'Session Wizard',
      skill_id: runKind === 'skill' ? selectedSkillIds[0] : undefined,
      flow_id: runKind === 'flow' ? selectedFlowId ?? undefined : undefined,
      agent_ids: runKind === 'agent_string' ? selectedSkillIds : undefined,
      created_at: createdAt,
      created_by: { kind: 'human', actor_id: 'current-user' },
      runtime: {
        model: 'gpt-5',
        locale: 'nl-NL',
        timezone: 'Europe/Amsterdam'
      },
      input_bindings: inputBindings,
      runtime_state: {
        resolved: {
          vault_items: vaultItemRefs,
          quick_inputs: quickInputs,
          geometry,
          run_mode: runMode
        }
      },
      constraints: {
        strict_mode: false,
        require_evidence: true
      }
    };

    const events: EventRecord[] = [];
    let seq = 1;

    const baseEvent = (eventId: string, at: string) => ({
      event_id: eventId,
      scope_id: scopeId,
      session_id: sessionId,
      run_id: sessionId,
      at,
      by: { kind: 'system', reason: 'wizard' } as const,
      seq: seq++,
      event_version: '1.0.0' as const
    });

    events.push({
      ...baseEvent(`${sessionId}-run-started`, createdAt),
      type: 'run.started',
      payload: {
        title: runContext.title,
        kind: runKind === 'agent_string' ? 'agent_string' : runKind,
        skill_id: runContext.skill_id,
        flow_id: runContext.flow_id,
        agent_ids: runContext.agent_ids,
        input_bindings: inputBindings
      }
    });

    selectedSkillIds.forEach((skillId, index) => {
      const stepId = `${sessionId}-step-${index + 1}`;
      const stepStartAt = new Date(Date.now() + index * 1000).toISOString();
      events.push({
        ...baseEvent(`${stepId}-started`, stepStartAt),
        type: 'step.started',
        payload: {
          step_id: stepId,
          step_index: index + 1,
          agent_id: skillId,
          title: agentProfilesContract.find((skill) => skill.id === skillId)?.title ?? skillId,
          inputs: inputBindings
        }
      });

      events.push({
        ...baseEvent(`${stepId}-completed`, new Date(Date.now() + index * 2000).toISOString()),
        type: 'step.completed',
        payload: {
          step_id: stepId,
          step_index: index + 1,
          agent_id: skillId,
          status: allowPartial && vaultItems.length === 0 ? 'insufficient_data' : 'ok',
          summary:
            allowPartial && vaultItems.length === 0
              ? 'Run completed with missing inputs flagged for follow-up.'
              : 'Run completed successfully.',
          mutations: [],
          insufficient_data:
            allowPartial && vaultItems.length === 0
              ? {
                  missing: [
                    {
                      path: '/inputs/upload_1',
                      label: 'Primary source file',
                      hint: 'Upload at least one source file to proceed.'
                    }
                  ],
                  recommended_next: [
                    {
                      label: 'Upload a source file',
                      suggested_input: 'PDF, CSV, DOCX',
                      binds_to: '/inputs/upload_1'
                    }
                  ]
                }
              : undefined
        }
      });
    });

    const completedAt = new Date(Date.now() + 3000).toISOString();
    events.push({
      ...baseEvent(`${sessionId}-run-completed`, completedAt),
      type: 'run.completed',
      payload: {
        status: allowPartial && vaultItems.length === 0 ? 'partial' : 'complete',
        summary: allowPartial && vaultItems.length === 0
          ? 'Run completed with missing inputs flagged.'
          : 'Run completed successfully.'
      }
    });

    const session: Session = {
      session_id: sessionId,
      scope_id: scopeId,
      run_id: sessionId,
      title: runContext.title,
      status: allowPartial && vaultItems.length === 0 ? 'partial' : 'complete',
      created_at: createdAt,
      created_by: { kind: 'human', actor_id: 'current-user' },
      last_event_at: completedAt,
      summary: allowPartial && vaultItems.length === 0
        ? 'Run completed with missing inputs flagged.'
        : 'Run completed successfully.'
    };

    addStoredSession({ session, runContext, events });
    navigate(`/sessions/${sessionId}`);
  };

  const selectedSkills = selectedSkillIds
    .map((id) => ({ id, title: agentProfilesContract.find((skill) => skill.id === id)?.title ?? id }))
    .filter((item) => item.id);

  return (
    <div className="bg-white px-4 py-6 md:px-8">
      <WizardHeader
        title="New session"
        description="Start with uploads, then select skills or flows and run a ledger-backed session."
      />

      <div className="flex items-center gap-4 text-xs text-slate-500">
        <span className={stepIndex === 0 ? 'text-slate-900 font-semibold' : ''}>1. Vault</span>
        <span className={stepIndex === 1 ? 'text-slate-900 font-semibold' : ''}>2. Skills</span>
        <span className={stepIndex === 2 ? 'text-slate-900 font-semibold' : ''}>3. Confirm</span>
      </div>

      <div className="mt-8 border-t border-slate-200 pt-6">
        {stepIndex === 0 ? (
          <StepVault
            vaultItems={vaultItems}
            isUploading={isUploading}
            saveToProject={saveToProject}
            selectedProjectId={selectedProjectId}
            projectOptions={projectOptions}
            onToggleSaveToProject={setSaveToProject}
            onProjectChange={setSelectedProjectId}
            onUpload={handleUpload}
            quickInputs={quickInputs}
            onQuickInputChange={(field, value) => setQuickInputs((prev) => ({ ...prev, [field]: value }))}
            geometry={geometry}
            onGeometryChange={(field, value) => setGeometry((prev) => ({ ...prev, [field]: value }))}
          />
        ) : null}

        {stepIndex === 1 ? (
          <StepSelectSkills
            selectedSkillIds={selectedSkillIds}
            selectedFlowId={selectedFlowId}
            showFlows={showFlows}
            onToggleSkill={handleToggleSkill}
            onFlowToggle={setShowFlows}
            onFlowSelect={handleFlowSelect}
          />
        ) : null}

        {stepIndex === 2 ? (
          <StepConfirmRun
            selectedSkills={selectedSkills}
            runMode={runMode}
            allowPartial={allowPartial}
            assumptions={assumptions}
            onRunModeChange={setRunMode}
            onAllowPartialChange={setAllowPartial}
            onRun={handleRun}
          />
        ) : null}
      </div>

      <div className="mt-10 flex items-center justify-between border-t border-slate-200 pt-6">
        <button
          type="button"
          onClick={() => setStepIndex((prev) => Math.max(prev - 1, 0))}
          className="text-xs font-semibold text-slate-600 hover:text-slate-800"
          disabled={stepIndex === 0}
        >
          Back
        </button>
        {stepIndex < 2 ? (
          <button
            type="button"
            onClick={() => setStepIndex((prev) => Math.min(prev + 1, 2))}
            className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Next
          </button>
        ) : null}
      </div>
    </div>
  );
};

export default SessionWizard;
