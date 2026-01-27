import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useProject } from '../../contexts/ProjectContext';
import { useUI } from '../../contexts/UIContext';
import FilePicker from '../FilePicker';
import {
  FILE_VALIDATION,
  linkVaultObjectsToProject,
  uploadToGlobalVault,
  type VaultLink,
  type VaultObject
} from '../../services/fileService';
import { agentProfilesContract } from '../../src/agentic/registry/agents';
import { flowTemplates } from '../../src/agentic/registry/flows';
import { loadStoredSessions } from '../../src/agentic/sessions/storage';
import { demoRuns } from '../../src/agentic/fixtures/demoRuns';
import {
  BookIcon,
  ChevronDownIcon,
  FileTextIcon,
  FolderIcon,
  LightningBoltIcon,
  MapIcon,
  PlusIcon,
  SparklesIcon
} from '../icons';

const MAX_RECENT_FLOWS = 3;

const buildRequiredPointers = (skillIds: string[], flowId: string | null) => {
  if (flowId) {
    const flow = flowTemplates.find((item) => item.id === flowId);
    if (!flow) return [];
    const flowSkillIds = flow.steps.map((step) => step.agent_id);
    return buildRequiredPointers(flowSkillIds, null);
  }

  const inputs = skillIds
    .map((skillId) => agentProfilesContract.find((profile) => profile.id === skillId))
    .filter(Boolean)
    .flatMap((profile) => profile?.inputs ?? [])
    .filter((input: any) => input.required)
    .map((input: any) => `/inputs/${input.key}`);

  return Array.from(new Set(inputs));
};

const HomeRoute: React.FC = () => {
  const navigate = useNavigate();
  const { projects } = useProject();
  const { selectedProjectId, setSelectedProjectId, showNotification } = useUI();

  const [vaultItems, setVaultItems] = useState<VaultObject[]>([]);
  const [vaultLinks, setVaultLinks] = useState<VaultLink[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [intakeTab, setIntakeTab] = useState<'upload' | 'paste' | 'select' | 'connectors'>('upload');
  const [linkToProject, setLinkToProject] = useState(false);
  const [coverageTarget, setCoverageTarget] = useState<string>('');

  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;
  const recentProjects = projects.slice(0, 5);

  const recentFlows = useMemo(() => flowTemplates.slice(0, MAX_RECENT_FLOWS), []);

  const availableVaultPointers = vaultItems.map((item) => item.id);

  const coverageRequiredPointers = useMemo(() => {
    if (!coverageTarget) return [];
    if (coverageTarget.startsWith('skill:')) {
      return buildRequiredPointers([coverageTarget.replace('skill:', '')], null);
    }
    if (coverageTarget.startsWith('flow:')) {
      return buildRequiredPointers([], coverageTarget.replace('flow:', ''));
    }
    return [];
  }, [coverageTarget]);

  const missingPointers = availableVaultPointers.length === 0 ? coverageRequiredPointers : [];

  const recentSessions = useMemo(() => {
    const stored = loadStoredSessions().map((item) => ({
      id: item.session.session_id,
      title: item.session.title,
      status: item.session.status,
      createdAt: item.session.created_at
    }));
    return [...stored, ...demoRuns].slice(0, 5);
  }, []);

  const recentOutcomes = useMemo(() => {
    const stored = loadStoredSessions().flatMap((item) =>
      item.events
        .filter((event) => event.type === 'step.completed')
        .map((event) => ({
          eventId: event.event_id,
          runId: item.session.session_id,
          title: event.payload.summary,
          createdAt: event.at
        }))
    );
    return stored.slice(0, 6);
  }, []);

  const handleUpload = async (files: File[]) => {
    try {
      setIsUploading(true);
      const uploaded = await uploadToGlobalVault(files);
      setVaultItems((prev) => [...uploaded, ...prev]);
      if (linkToProject && selectedProjectId) {
        const links = await linkVaultObjectsToProject(selectedProjectId, uploaded.map((item) => item.id));
        setVaultLinks((prev) => [...links, ...prev]);
      }
      showNotification('Upload complete.', 'success');
    } catch (error) {
      console.error('[home] upload failed', error);
      showNotification('Upload failed. Check console for details.', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="h-full w-full overflow-y-auto bg-white p-4 md:p-8" data-layout-root>
      <HomeHeader
        selectedProject={selectedProject}
        recentProjects={recentProjects}
        onSelectProject={setSelectedProjectId}
      />

      <HomePrimaryActions
        recentFlows={recentFlows}
        onStartSession={() => navigate('/sessions/new')}
        onRunSkill={() => navigate('/skills')}
        onRunFlow={() => navigate('/flows')}
        onBuildFlow={() => navigate('/flows')}
      />

      <ContextIntelligencePanel
        selectedProject={selectedProject}
        vaultItems={vaultItems}
        vaultLinks={vaultLinks}
        intakeTab={intakeTab}
        onIntakeTabChange={setIntakeTab}
        linkToProject={linkToProject}
        onLinkToProjectChange={setLinkToProject}
        onUpload={handleUpload}
        isUploading={isUploading}
        coverageTarget={coverageTarget}
        onCoverageTargetChange={setCoverageTarget}
        missingPointers={missingPointers}
        onOpenWizard={() => navigate('/sessions/new')}
      />

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <RecentOutcomesPanel outcomes={recentOutcomes} />
        <RecentSessionsPanel sessions={recentSessions} />
      </div>
    </div>
  );
};

interface HomeHeaderProps {
  selectedProject: { id: string; name: string } | null;
  recentProjects: Array<{ id: string; name: string }>;
  onSelectProject: (id: string | null) => void;
}

const HomeHeader: React.FC<HomeHeaderProps> = ({ selectedProject, recentProjects, onSelectProject }) => {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Home</h1>
        <p className="mt-1 text-sm text-slate-600">
          Start sessions, manage intake, and track your most recent outputs.
        </p>
      </div>
      <ProjectSwitcher
        selectedProject={selectedProject}
        recentProjects={recentProjects}
        onSelectProject={onSelectProject}
      />
    </div>
  );
};

interface ProjectSwitcherProps {
  selectedProject: { id: string; name: string } | null;
  recentProjects: Array<{ id: string; name: string }>;
  onSelectProject: (id: string | null) => void;
}

const ProjectSwitcher: React.FC<ProjectSwitcherProps> = ({ selectedProject, recentProjects, onSelectProject }) => {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
        Global
      </span>
      {selectedProject ? (
        <span className="inline-flex items-center gap-2 rounded-full bg-weflora-mint/20 px-3 py-1 text-xs font-semibold text-weflora-dark">
          Project: {selectedProject.name}
          <button
            type="button"
            onClick={() => onSelectProject(null)}
            className="rounded-full px-1 text-weflora-teal hover:text-weflora-dark"
          >
            ×
          </button>
        </span>
      ) : null}
      <div className="relative">
        <select
          value={selectedProject?.id ?? ''}
          onChange={(event) => onSelectProject(event.target.value || null)}
          className="appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 pr-8"
        >
          <option value="">Select project</option>
          {recentProjects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
        <ChevronDownIcon className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
      </div>
    </div>
  );
};

interface HomePrimaryActionsProps {
  recentFlows: Array<{ id: string; title: string }>;
  onStartSession: () => void;
  onRunSkill: () => void;
  onRunFlow: () => void;
  onBuildFlow: () => void;
}

const HomePrimaryActions: React.FC<HomePrimaryActionsProps> = ({
  recentFlows,
  onStartSession,
  onRunSkill,
  onRunFlow,
  onBuildFlow
}) => {
  return (
    <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-weflora-mint/20 text-weflora-teal">
              <SparklesIcon className="h-5 w-5" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-slate-900">Start a session</h2>
            <p className="mt-2 text-sm text-slate-600">Kick off a guided run with uploads, skills, and flows.</p>
          </div>
          <button
            type="button"
            onClick={onStartSession}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            <SparklesIcon className="h-4 w-4" />
            Start session
          </button>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onRunSkill}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            <BookIcon className="h-4 w-4 text-weflora-teal" />
            Run a Skill
          </button>
          <button
            type="button"
            onClick={onRunFlow}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            <LightningBoltIcon className="h-4 w-4 text-weflora-teal" />
            Run a Flow
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-weflora-mint/20 text-weflora-teal">
              <LightningBoltIcon className="h-5 w-5" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-slate-900">Flow builder</h2>
            <p className="mt-2 text-sm text-slate-600">Design a reusable workflow and launch it quickly.</p>
          </div>
          <button
            type="button"
            onClick={onBuildFlow}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            <PlusIcon className="h-4 w-4 text-weflora-teal" />
            Build a Flow
          </button>
        </div>
        <div className="mt-5">
          <p className="text-xs font-semibold text-slate-700">Recent flows</p>
          <div className="mt-3 space-y-2">
            {recentFlows.length === 0 ? (
              <p className="text-sm text-slate-500">No flows created yet.</p>
            ) : (
              recentFlows.map((flow) => (
                <Link
                  key={flow.id}
                  to={`/flows/${flow.id}`}
                  className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <span>{flow.title}</span>
                  <ChevronDownIcon className="h-4 w-4 -rotate-90 text-slate-400" />
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

interface ContextIntelligencePanelProps {
  selectedProject: { id: string; name: string } | null;
  vaultItems: VaultObject[];
  vaultLinks: VaultLink[];
  intakeTab: 'upload' | 'paste' | 'select' | 'connectors';
  onIntakeTabChange: (value: 'upload' | 'paste' | 'select' | 'connectors') => void;
  linkToProject: boolean;
  onLinkToProjectChange: (value: boolean) => void;
  onUpload: (files: File[]) => void;
  isUploading: boolean;
  coverageTarget: string;
  onCoverageTargetChange: (value: string) => void;
  missingPointers: string[];
  onOpenWizard: () => void;
}

const ContextIntelligencePanel: React.FC<ContextIntelligencePanelProps> = ({
  selectedProject,
  vaultItems,
  vaultLinks,
  intakeTab,
  onIntakeTabChange,
  linkToProject,
  onLinkToProjectChange,
  onUpload,
  isUploading,
  coverageTarget,
  onCoverageTargetChange,
  missingPointers,
  onOpenWizard
}) => {
  return (
    <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-700">Context intelligence</h2>
          <p className="mt-1 text-sm text-slate-600">Manage what the vault knows before you run.</p>
        </div>
        <button
          type="button"
          onClick={onOpenWizard}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          <PlusIcon className="h-4 w-4 text-weflora-teal" />
          New upload
        </button>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">Global</span>
        {selectedProject ? (
          <span className="rounded-full bg-weflora-mint/20 px-3 py-1 text-xs font-semibold text-weflora-dark">
            Project overlay: {selectedProject.name}
          </span>
        ) : null}
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50/30 p-4">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 pb-3">
          {(['upload', 'paste', 'select', 'connectors'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => onIntakeTabChange(tab)}
              className={`px-3 py-1.5 text-xs font-semibold transition-colors border-b-2 ${
                intakeTab === tab
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab === 'upload' ? 'Upload' : tab === 'paste' ? 'Paste/Type' : tab === 'select' ? 'Select' : 'Connectors'}
            </button>
          ))}
        </div>

        {intakeTab === 'upload' ? (
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <FilePicker accept={FILE_VALIDATION.ACCEPTED_FILE_TYPES} multiple onPick={onUpload}>
                {({ open }) => (
                  <button
                    type="button"
                    onClick={open}
                    className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                  >
                    {isUploading ? 'Uploading…' : 'Upload files'}
                  </button>
                )}
              </FilePicker>
              <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={linkToProject}
                  onChange={(event) => onLinkToProjectChange(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-weflora-teal focus:ring-weflora-teal"
                />
                Also link to selected project
              </label>
            </div>
            <p className="text-xs text-slate-500">
              Supported: {FILE_VALIDATION.ACCEPTED_FILE_TYPES}
            </p>
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
            {intakeTab === 'paste'
              ? 'Paste notes or data here (coming soon).'
              : intakeTab === 'select'
                ? 'Select from existing vault objects (coming soon).'
                : 'Connector intake is available soon.'}
          </div>
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ContextInventoryColumn
          title="Operational context"
          items={vaultItems.map((item) => ({
            id: item.id,
            title: item.filename,
            type: item.mimeType || 'File',
            status: 'Indexed',
            confidence: item.confidence ?? 0.82
          }))}
        />
        <ContextInventoryColumn
          title="Urban context"
          items={vaultLinks.map((link, index) => ({
            id: link.id,
            title: `Project link ${index + 1}`,
            type: 'Project link',
            status: 'Linked',
            confidence: 0.76
          }))}
          emptyLabel="No urban context linked yet."
        />
      </div>

      <CoveragePanel
        target={coverageTarget}
        onTargetChange={onCoverageTargetChange}
        missingPointers={missingPointers}
        onAddNow={onOpenWizard}
      />
    </section>
  );
};

interface ContextInventoryColumnProps {
  title: string;
  items: Array<{ id: string; title: string; type: string; status: string; confidence: number }>;
  emptyLabel?: string;
}

const ContextInventoryColumn: React.FC<ContextInventoryColumnProps> = ({ title, items, emptyLabel }) => {
  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
      </div>
      <div className="divide-y divide-slate-200">
        {items.length === 0 ? (
          <div className="px-4 py-6 text-sm text-slate-500">{emptyLabel ?? 'No context yet.'}</div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="flex flex-col gap-3 px-4 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-weflora-mint/20 text-weflora-teal">
                    <FolderIcon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{item.type}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{item.status}</span>
                      <span className="rounded-full bg-weflora-mint/20 px-2 py-0.5 text-weflora-dark">
                        {Math.round(item.confidence * 100)}%
                      </span>
                    </div>
                  </div>
                </div>
                <button className="text-xs font-semibold text-slate-500 hover:text-slate-700">Remove link</button>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                  Preview
                </button>
                <button className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                  Map fields
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

interface CoveragePanelProps {
  target: string;
  onTargetChange: (value: string) => void;
  missingPointers: string[];
  onAddNow: () => void;
}

const CoveragePanel: React.FC<CoveragePanelProps> = ({ target, onTargetChange, missingPointers, onAddNow }) => {
  return (
    <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50/30 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Coverage check</h3>
        <div className="flex items-center gap-2">
          <MapIcon className="h-4 w-4 text-weflora-teal" />
          <select
            value={target}
            onChange={(event) => onTargetChange(event.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
          >
            <option value="">Check readiness for…</option>
            {agentProfilesContract.map((profile) => (
              <option key={profile.id} value={`skill:${profile.id}`}>
                Skill: {profile.title}
              </option>
            ))}
            {flowTemplates.map((flow) => (
              <option key={flow.id} value={`flow:${flow.id}`}>
                Flow: {flow.title}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-4">
        {target === '' ? (
          <p className="text-sm text-slate-500">Select a skill or flow to see coverage status.</p>
        ) : missingPointers.length === 0 ? (
          <p className="text-sm text-slate-600">All required pointers are available.</p>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-700">Missing pointers</p>
            {missingPointers.map((pointer) => (
              <div key={pointer} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
                <span className="text-xs text-slate-600">{pointer}</span>
                <button
                  type="button"
                  onClick={onAddNow}
                  className="text-xs font-semibold text-weflora-teal hover:text-weflora-dark"
                >
                  Add now
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

interface RecentOutcomesPanelProps {
  outcomes: Array<{ eventId: string; runId: string; title: string; createdAt: string }>;
}

const RecentOutcomesPanel: React.FC<RecentOutcomesPanelProps> = ({ outcomes }) => {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Recent outcomes</h2>
        <FileTextIcon className="h-4 w-4 text-weflora-teal" />
      </div>
      <div className="mt-4 space-y-3">
        {outcomes.length === 0 ? (
          <p className="text-sm text-slate-500">No outcomes yet.</p>
        ) : (
          outcomes.map((item) => (
            <Link
              key={item.eventId}
              to={`/sessions/${item.runId}#event-${item.eventId}`}
              className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <span className="line-clamp-2">{item.title}</span>
              <span className="text-xs text-slate-400">{new Date(item.createdAt).toLocaleDateString()}</span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
};

interface RecentSessionsPanelProps {
  sessions: Array<{ id: string; title: string; status: string; createdAt: string }>;
}

const RecentSessionsPanel: React.FC<RecentSessionsPanelProps> = ({ sessions }) => {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Recent sessions</h2>
        <SparklesIcon className="h-4 w-4 text-weflora-teal" />
      </div>
      <div className="mt-4 space-y-3">
        {sessions.length === 0 ? (
          <p className="text-sm text-slate-500">No sessions yet.</p>
        ) : (
          sessions.map((session) => (
            <Link
              key={session.id}
              to={`/sessions/${session.id}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <span className="line-clamp-1">{session.title}</span>
              <span className="text-xs text-slate-400">{new Date(session.createdAt).toLocaleDateString()}</span>
            </Link>
          ))
        )}
      </div>
      <Link
        to="/sessions"
        className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-weflora-teal hover:text-weflora-dark"
      >
        View all sessions
      </Link>
    </div>
  );
};

export default HomeRoute;
