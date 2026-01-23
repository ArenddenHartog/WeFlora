import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { SparklesIcon } from '../icons';
import PageShell from '../ui/PageShell';
import { flowTemplatesById, flowTemplates } from '../../src/agentic/registry/flows.ts';
import { agentProfilesContract } from '../../src/agentic/registry/agents';
import { buildSkillContractMeta, collectRequiredContextSummary } from '../../src/agentic/contracts/contractCatalog';
import {
  deriveVaultInventoryRecords,
  fetchVaultInventorySources,
  type VaultInventoryRecord
} from '../../services/vaultInventoryService';
import { useProject } from '../../contexts/ProjectContext';
import { useUI } from '../../contexts/UIContext';
import { supabase } from '../../services/supabaseClient';
import { track } from '../../src/agentic/telemetry/telemetry';
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useDraggable, useDroppable } from '@dnd-kit/core';

const FlowDetail: React.FC = () => {
  const { flowId } = useParams();
  const navigate = useNavigate();
  const flow = flowId ? flowTemplatesById[flowId] : undefined;
  const { projects } = useProject();
  const { selectedProjectId, showNotification } = useUI();
  const [vaultRecords, setVaultRecords] = useState<VaultInventoryRecord[]>([]);
  const [isLoadingVault, setIsLoadingVault] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [steps, setSteps] = useState<Array<{ id: string; title: string; skills: string[] }>>([]);
  const [strictMode, setStrictMode] = useState(false);
  const [draftUpdatedAt, setDraftUpdatedAt] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const skillWriteMap = useMemo(() => {
    const map = new Map<string, string[]>();
    flowTemplates.forEach((template) => {
      template.steps.forEach((step) => {
        if (step.expected_writes?.length) {
          map.set(step.agent_id, step.expected_writes);
        }
      });
    });
    return map;
  }, []);

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

  useEffect(() => {
    const handle = window.setTimeout(() => setSearch(searchInput), 150);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    if (!flow) return;
    const seeded = flow.steps.map((step, index) => ({
      id: step.step_id,
      title: `Step ${index + 1}`,
      skills: [step.agent_id]
    }));
    setSteps(seeded);
  }, [flow]);

  useEffect(() => {
    const loadDraft = async () => {
      if (!flowId) return;
      const { data, error } = await supabase
        .from('flow_drafts')
        .select('payload, updated_at')
        .eq('flow_id', flowId)
        .single();
      if (error && error.code !== 'PGRST116') {
        track('flow_draft.load_error', { message: error.message });
        showNotification('Failed to load flow draft.', 'error');
        return;
      }
      if (data?.payload) {
        const payload = data.payload as { steps?: Array<{ id: string; title: string; skills: string[] }>; strictMode?: boolean };
        if (payload.steps && payload.steps.length > 0) {
          setSteps(payload.steps);
        }
        if (typeof payload.strictMode === 'boolean') {
          setStrictMode(payload.strictMode);
        }
        setDraftUpdatedAt(data.updated_at);
      }
    };
    loadDraft();
  }, [flowId, showNotification]);

  const paletteSkills = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return agentProfilesContract.filter((profile) => {
      const matchesSearch = !needle || [profile.title, profile.description, ...profile.tags].some((value) => value.toLowerCase().includes(needle));
      const matchesTag = activeTags.length === 0 || activeTags.some((tag) => profile.tags.includes(tag));
      return matchesSearch && matchesTag;
    });
  }, [activeTags, search]);

  const requiredContextSummary = useMemo(() => {
    const profiles = steps.flatMap((step) => step.skills.map((id) => agentProfilesContract.find((profile) => profile.id === id))).filter(Boolean);
    return collectRequiredContextSummary(profiles as any);
  }, [steps]);

  const validationIssues = useMemo(() => {
    const issues: string[] = [];
    steps.forEach((step) => {
      const writes = step.skills.flatMap((id) => skillWriteMap.get(id) ?? []);
      const duplicates = writes.filter((item, idx) => writes.indexOf(item) !== idx);
      if (duplicates.length) {
        issues.push(`Write conflict in ${step.title}: ${Array.from(new Set(duplicates)).join(', ')}`);
      }
    });
    if (!strictMode) {
      const lowConfidence = steps.some((step) =>
        step.skills.some((id) => {
          const profile = agentProfilesContract.find((item) => item.id === id);
          if (!profile) return false;
          const requirements = buildSkillContractMeta(profile as any).requiredContext.filter((item) => !item.optional);
          return requirements.some((requirement) =>
            vaultRecords.some((record) => record.type === requirement.recordType && (record.confidence ?? 0) < requirement.confidenceThreshold)
          );
        })
      );
      if (lowConfidence) {
        issues.push('Low-confidence records detected (allowed in non-strict mode).');
      }
    }
    return issues;
  }, [skillWriteMap, steps, strictMode, vaultRecords]);

  const handleValidate = () => {
    if (validationIssues.length === 0) {
      showNotification('Flow validation passed.', 'success');
    } else {
      showNotification('Flow validation has conflicts.', 'error');
    }
  };

  const handleSave = async () => {
    if (!flowId) return;
    const { data: existing } = await supabase
      .from('flow_drafts')
      .select('updated_at')
      .eq('flow_id', flowId)
      .single();

    if (draftUpdatedAt && existing?.updated_at && existing.updated_at !== draftUpdatedAt) {
      showNotification('Draft updated elsewhere. Reload or overwrite.', 'error');
      return;
    }

    const payload = { steps, strictMode };
    const { data, error } = await supabase
      .from('flow_drafts')
      .upsert({ flow_id: flowId, payload })
      .select('updated_at')
      .single();
    if (error) {
      track('flow_draft.save_error', { message: error.message });
      showNotification('Failed to save draft.', 'error');
      return;
    }
    setDraftUpdatedAt(data?.updated_at ?? null);
    showNotification('Draft flow saved (latest skill versions).', 'success');
  };

  const handleRun = () => {
    if (!flow) return;
    navigate(`/sessions/new?intent=flow:${flow.id}`);
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over) return;
    const skillId = String(active.id).replace('skill:', '');
    if (!agentProfilesContract.find((profile) => profile.id === skillId)) return;

    if (over.id === 'canvas') {
      setSteps((prev) => [...prev, { id: `step-${prev.length + 1}`, title: `Step ${prev.length + 1}`, skills: [skillId] }]);
      return;
    }

    const overId = String(over.id);
    if (overId.startsWith('step:')) {
      const stepId = overId.replace('step:', '');
      setSteps((prev) => prev.map((step) => (step.id === stepId ? { ...step, skills: [...step.skills, skillId] } : step)));
      return;
    }
    if (overId.startsWith('gap:')) {
      const index = Number(overId.replace('gap:', ''));
      setSteps((prev) => {
        const next = [...prev];
        next.splice(index, 0, { id: `step-${Date.now()}`, title: `Step ${index + 1}`, skills: [skillId] });
        return next.map((item, idx) => ({ ...item, title: `Step ${idx + 1}` }));
      });
    }
  };

  if (!flow) {
    return (
      <div className="bg-white px-4 py-6 md:px-8">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Flow not found</h1>
        <p className="mt-2 text-sm text-slate-500">Flow not found.</p>
        <Link to="/flows" className="mt-4 inline-block text-sm text-weflora-teal underline">
          Back to Flows
        </Link>
      </div>
    );
  }

  return (
    <PageShell
      icon={<SparklesIcon className="h-5 w-5" />}
      title={flow.title}
      meta={`v${flow.template_version}`}
      actions={
        <>
          <button
            onClick={() => setStrictMode((prev) => !prev)}
            className={`rounded-lg border px-3 py-2 text-xs font-semibold ${strictMode ? 'border-weflora-teal bg-weflora-mint/20 text-weflora-dark' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            {strictMode ? 'Strict mode' : 'Non-strict'}
          </button>
          <button onClick={handleSave} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
            Save
          </button>
          <button onClick={handleValidate} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
            Validate
          </button>
          <button onClick={handleRun} className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800">
            Run
          </button>
        </>
      }
    >
        <Link to="/flows" className="text-xs text-slate-500 hover:text-slate-700">
          ← Back to Flows
        </Link>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
          <aside className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-900">Skill palette</h2>
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search skills"
              className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {Array.from(new Set(agentProfilesContract.flatMap((profile) => profile.tags))).slice(0, 6).map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setActiveTags((prev) => (prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]))}
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold border ${
                    activeTags.includes(tag) ? 'border-weflora-teal bg-weflora-mint/20 text-weflora-dark' : 'border-slate-200 text-slate-500'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
            <div className="mt-4 space-y-3">
              {paletteSkills.map((profile) => (
                <PaletteSkillCard key={profile.id} skillId={profile.id} title={profile.title} tags={profile.tags} />
              ))}
            </div>
          </aside>

          <main className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Flow canvas</h2>
                <p className="mt-1 text-xs text-slate-500">Step groups run sequentially. Skills within a step run in parallel.</p>
              </div>
              <div className="text-xs text-slate-500 flex flex-wrap items-center gap-3">
                <span>{requiredContextSummary.map((item) => `${item.recordType} (${item.count})`).join(' · ') || 'No required context'}</span>
                <Link
                  to={`/vault?types=${encodeURIComponent(requiredContextSummary.map((item) => item.recordType).join(','))}&scope=${selectedProjectId ? 'project' : 'global'}`}
                  className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
                >
                  View required data
                </Link>
              </div>
            </div>

            {validationIssues.length > 0 ? (
              <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {validationIssues.map((issue) => (
                  <p key={issue}>{issue}</p>
                ))}
              </div>
            ) : null}

            <div className="mt-4 text-xs text-slate-500">
              {isLoadingVault ? 'Loading vault context...' : 'Validation uses live vault coverage and skill contracts.'}
            </div>
            <div className="mt-2 text-xs text-slate-500">
              Save keeps skillRef version as latest. Run freezes skillRef to a version + hash for the session ledger.
            </div>

            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
              <CanvasDropZone>
                {steps.map((step, index) => (
                  <div key={step.id} className="relative">
                    <GapDropZone id={`gap:${index}`} />
                    <StepGroup
                      step={step}
                      onTitleChange={(value) =>
                        setSteps((prev) => prev.map((item) => (item.id === step.id ? { ...item, title: value } : item)))
                      }
                      vaultRecords={vaultRecords}
                      skillWriteMap={skillWriteMap}
                    />
                  </div>
                ))}
                <GapDropZone id={`gap:${steps.length}`} />
                {steps.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-xs text-slate-500">
                    Drag a skill here to start your flow.
                  </div>
                ) : null}
              </CanvasDropZone>
            </DndContext>
          </main>
        </div>
    </PageShell>
  );
};

const PaletteSkillCard: React.FC<{ skillId: string; title: string; tags: string[] }> = ({ skillId, title, tags }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `skill:${skillId}` });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`rounded-lg border border-slate-200 p-3 text-xs text-slate-600 ${isDragging ? 'opacity-50' : 'hover:bg-slate-50'}`}
    >
      <p className="font-semibold text-slate-800">{title}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {tags.slice(0, 3).map((tag) => (
          <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
};

const StepGroup: React.FC<{
  step: { id: string; title: string; skills: string[] };
  onTitleChange: (value: string) => void;
  vaultRecords: VaultInventoryRecord[];
  skillWriteMap: Map<string, string[]>;
}> = ({ step, onTitleChange, vaultRecords, skillWriteMap }) => {
  const { setNodeRef, isOver } = useDroppable({ id: `step:${step.id}` });

  const stepStatus = useMemo(() => {
    const profiles = step.skills.map((id) => agentProfilesContract.find((profile) => profile.id === id)).filter(Boolean);
    const contexts = profiles.flatMap((profile) => buildSkillContractMeta(profile as any).requiredContext.filter((item) => !item.optional));
    const missing = contexts.filter((requirement) => !vaultRecords.some((record) => record.type === requirement.recordType));
    if (missing.length > 0) return 'missing';
    const review = contexts.some((requirement) =>
      vaultRecords.some((record) =>
        record.type === requirement.recordType &&
        ((record.confidence ?? 0) < requirement.confidenceThreshold || record.validations.errors.length > 0)
      )
    );
    if (review) return 'review';
    return 'ready';
  }, [step.skills, vaultRecords]);

  return (
    <div ref={setNodeRef} className={`rounded-xl border border-slate-200 p-4 ${isOver ? 'bg-slate-50' : 'bg-white'}`}>
      <div className="flex items-center justify-between text-xs text-slate-500">
        <input
          value={step.title}
          onChange={(event) => onTitleChange(event.target.value)}
          className="w-full max-w-[240px] rounded border border-transparent bg-transparent text-xs font-semibold text-slate-700 focus:border-weflora-mint/40 focus:bg-white"
        />
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            stepStatus === 'ready'
              ? 'bg-weflora-mint/20 text-weflora-dark'
              : stepStatus === 'review'
                ? 'bg-amber-50 text-amber-700'
                : 'bg-rose-50 text-rose-700'
          }`}
        >
          {stepStatus}
        </span>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {step.skills.map((skillId) => {
          const profile = agentProfilesContract.find((item) => item.id === skillId);
          if (!profile) return null;
          const meta = buildSkillContractMeta(profile as any);
          const writes = skillWriteMap.get(skillId) ?? meta.output.writes;
          const missing = meta.requiredContext.filter((item) => !item.optional).some((requirement) =>
            !vaultRecords.some((record) => record.type === requirement.recordType)
          );
          const needsReview = meta.requiredContext.filter((item) => !item.optional).some((requirement) =>
            vaultRecords.some((record) =>
              record.type === requirement.recordType &&
              ((record.confidence ?? 0) < requirement.confidenceThreshold || record.validations.errors.length > 0)
            )
          );
          const statusLabel = missing ? 'missing' : needsReview ? 'review' : 'ready';
          return (
            <div key={skillId} className="rounded-lg border border-slate-200 p-3 text-xs text-slate-600">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-slate-800">{profile.title}</p>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    statusLabel === 'ready'
                      ? 'bg-weflora-mint/20 text-weflora-dark'
                      : statusLabel === 'review'
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-rose-50 text-rose-700'
                  }`}
                >
                  {statusLabel}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">v{profile.spec_version}</p>
              <p className="mt-2 text-[11px] text-slate-500">Context: {meta.requiredContext.map((item) => item.recordType).join(' · ')}</p>
              <p className="mt-2 text-[11px] text-slate-500">Writes: {writes.length ? writes.join(', ') : 'No declared writes'}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const GapDropZone: React.FC<{ id: string }> = ({ id }) => {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`my-2 h-4 rounded-full ${isOver ? 'bg-weflora-mint/40' : 'bg-transparent'}`} />
  );
};

const CanvasDropZone: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { setNodeRef, isOver } = useDroppable({ id: 'canvas' });
  return (
    <div ref={setNodeRef} className={`mt-6 space-y-4 ${isOver ? 'bg-slate-50/60' : ''}`}>
      {children}
    </div>
  );
};

export default FlowDetail;
