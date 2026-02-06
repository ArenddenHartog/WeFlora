import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import PageShell from '../ui/PageShell';
import { useProject } from '../../contexts/ProjectContext';
import { useUI } from '../../contexts/UIContext';
import FilePicker from '../FilePicker';
import { FILE_VALIDATION, linkVaultObjectsToProject, uploadToGlobalVault } from '../../services/fileService';
import {
  deriveVaultInventoryRecords,
  fetchVaultInventoryPage,
  getVaultFileUrl,
  type VaultInventoryRecord
} from '../../services/vaultInventoryService';
import { agentProfilesContract } from '../../src/agentic/registry/agents';
import { flowTemplates } from '../../src/agentic/registry/flows';
import { getSkillContextTypes } from '../../src/agentic/contracts/contractCatalog';
import { track } from '../../src/agentic/telemetry/telemetry';
import { safeAction, formatErrorWithTrace } from '../../utils/safeAction';
import { STATUS_META, getStatusBadgeClasses, type VaultStatus } from '../../utils/vaultStatus';
import {
  ChevronDownIcon,
  DatabaseIcon,
  FileTextIcon,
  PlusIcon,
  SearchIcon,
  SparklesIcon,
  XIcon
} from '../icons';

const RECORD_TYPES = ['Policy', 'SpeciesList', 'Site', 'Vision', 'Climate', 'Other'] as const;
/** @deprecated Use VaultStatus instead */
const REVIEW_STATES = ['Auto-accepted', 'Needs review', 'Blocked', 'Draft'] as const;
/** Canonical status values for filtering */
const STATUS_VALUES: VaultStatus[] = ['draft', 'pending', 'needs_review', 'in_review', 'accepted', 'blocked'];

export type ContextRecordType = (typeof RECORD_TYPES)[number];
/** @deprecated Use VaultStatus instead */
export type ReviewState = (typeof REVIEW_STATES)[number];

/**
 * Get badge styling for canonical status
 */
const statusBadge = (status: VaultStatus) => {
  return getStatusBadgeClasses(status);
};

/**
 * Get status label for display
 */
const statusLabel = (status: VaultStatus) => {
  return STATUS_META[status]?.label ?? status;
};

/** @deprecated Use statusBadge(status) instead */
const legacyStatusBadge = (state: ReviewState) => {
  switch (state) {
    case 'Auto-accepted':
      return 'bg-weflora-mint/20 text-weflora-teal border border-weflora-mint/40';
    case 'Needs review':
      return 'bg-amber-50 text-amber-700 border border-amber-200';
    case 'Blocked':
      return 'bg-rose-50 text-rose-700 border border-rose-200';
    case 'Draft':
      return 'bg-slate-50 text-slate-600 border border-slate-200';
    default:
      return 'bg-slate-50 text-slate-600 border border-slate-200';
  }
};

const confidenceSegments = (confidence: number) => {
  const segments = 10;
  const active = Math.round(confidence * segments);
  return Array.from({ length: segments }, (_, idx) => idx < active);
};

const VaultInventoryView: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: selectedId } = useParams<{ id?: string }>();
  const { projects } = useProject();
  const { selectedProjectId, setSelectedProjectId, showNotification } = useUI();

  const [search, setSearch] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<ContextRecordType[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<VaultStatus[]>([]);
  const [missingOnly, setMissingOnly] = useState(false);
  const [activeTab, setActiveTab] = useState<'fields' | 'evidence' | 'validations' | 'usage' | 'history'>('fields');
  const [isIntakeOpen, setIsIntakeOpen] = useState(false);
  const [intakeStep, setIntakeStep] = useState(1);
  const [intakeScope, setIntakeScope] = useState<'global' | 'project'>('global');
  const [linkToProject, setLinkToProject] = useState(true);
  const [records, setRecords] = useState<VaultInventoryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  // Route-param driven selection: Get selected ID from URL path (/vault/:id)
  // Derive selectedRecord from URL param and records (not component state)
  const selectedRecord = useMemo(() => {
    if (!selectedId) return null;
    return records.find((record) => record.recordId === selectedId) ?? null;
  }, [selectedId, records]);

  // Function to update selection via route navigation (deterministic, survives refresh)
  const setSelectedId = useCallback((id: string | null) => {
    if (id) {
      navigate(`/vault/${id}`, { replace: false });
    } else {
      navigate('/vault', { replace: false });
    }
  }, [navigate]);

  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;
  const recentProjects = projects.slice(0, 5);

  const loadInventory = useCallback(async () => {
    setIsLoading(true);
    await safeAction(
      async () => {
        const { vaultObjects, projectLinks, cursor: nextCursor } = await fetchVaultInventoryPage({ projectId: selectedProjectId, limit: 50, cursor: null });
        const derived = deriveVaultInventoryRecords(vaultObjects, projectLinks, projects);
        setRecords(derived);
        setCursor(nextCursor ?? null);
        setHasMore(Boolean(nextCursor));
        return derived;
      },
      {
        onError: (error, traceId) => {
          track('vault_inventory.load_error', { message: error.message, traceId });
          showNotification(formatErrorWithTrace('Failed to load vault inventory', error.message, traceId), 'error');
        }
      }
    );
    setIsLoading(false);
  }, [projects, selectedProjectId, showNotification]);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  const loadMore = async () => {
    if (!cursor || isLoading) return;
    setIsLoading(true);
    await safeAction(
      async () => {
        const { vaultObjects, projectLinks, cursor: nextCursor } = await fetchVaultInventoryPage({ projectId: selectedProjectId, limit: 50, cursor });
        const derived = deriveVaultInventoryRecords(vaultObjects, projectLinks, projects);
        setRecords((prev) => [...prev, ...derived]);
        setCursor(nextCursor ?? null);
        setHasMore(Boolean(nextCursor));
        return derived;
      },
      {
        onError: (error, traceId) => {
          track('vault_inventory.load_more_error', { message: error.message, traceId });
          showNotification(formatErrorWithTrace('Failed to load more records', error.message, traceId), 'error');
        }
      }
    );
    setIsLoading(false);
  };

  // Initialize filters from URL params (only on mount)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const intake = params.get('intake');
    const typeParam = params.get('type');
    const typesParam = params.get('types');
    const scopeParam = params.get('scope');

    if (intake === '1') {
      setIsIntakeOpen(true);
    }
    if (scopeParam === 'project') {
      setIntakeScope('project');
    }

    if (typesParam) {
      const types = typesParam.split(',').map((value) => value.trim()).filter((value) => RECORD_TYPES.includes(value as ContextRecordType));
      if (types.length) setSelectedTypes(types as ContextRecordType[]);
    } else if (typeParam && RECORD_TYPES.includes(typeParam as ContextRecordType)) {
      setSelectedTypes([typeParam as ContextRecordType]);
    }
    // Note: selected ID is handled via selectedRecord derived from URL
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      if (selectedTypes.length && !selectedTypes.includes(record.type)) return false;
      if (selectedStatuses.length && !selectedStatuses.includes(record.status)) return false;
      if (missingOnly && record.completeness.missingCount === 0) return false;
      const needle = search.trim().toLowerCase();
      if (!needle) return true;
      return (
        record.title.toLowerCase().includes(needle) ||
        record.tags.some((tag) => tag.toLowerCase().includes(needle)) ||
        record.sources.some((source) => source.toLowerCase().includes(needle))
      );
    });
  }, [missingOnly, records, search, selectedStatuses, selectedTypes]);

  const toggleType = (type: ContextRecordType) => {
    setSelectedTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));
  };

  const toggleStatus = (status: VaultStatus) => {
    setSelectedStatuses((prev) => (prev.includes(status) ? prev.filter((t) => t !== status) : [...prev, status]));
  };

  const reviewCount = records.filter((record) => record.status === 'needs_review' || record.status === 'pending').length;

  const handleIntakeFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setIsUploading(true);
    try {
      const uploaded = await uploadToGlobalVault(files);
      if ((intakeScope === 'project' || linkToProject) && selectedProjectId) {
        await linkVaultObjectsToProject(selectedProjectId, uploaded.map((item) => item.id));
      }
      showNotification('Vault intake uploaded.', 'success');
      await loadInventory();
    } catch (error) {
      track('vault_intake.upload_error', { message: (error as Error).message });
      showNotification((error as Error).message ?? 'Upload failed.', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleOpenSource = async () => {
    if (!selectedRecord) return;
    try {
      const url = await getVaultFileUrl(selectedRecord.vault);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      track('vault_inventory.signed_url_error', { message: (error as Error).message });
      showNotification('Unable to open source file.', 'error');
    }
  };

  const usageByRecordType = useMemo(() => {
    const skillUsage = agentProfilesContract.map((profile) => ({
      id: profile.id,
      title: profile.title,
      recordTypes: getSkillContextTypes(profile)
    }));
    const flowUsage = flowTemplates.map((flow) => ({
      id: flow.id,
      title: flow.title,
      recordTypes: Array.from(
        new Set(
          flow.steps.flatMap((step) => {
            const profile = agentProfilesContract.find((item) => item.id === step.agent_id);
            return profile ? getSkillContextTypes(profile) : [];
          })
        )
      )
    }));

    return { skillUsage, flowUsage };
  }, []);

  return (
    <PageShell
      icon={<DatabaseIcon className="h-5 w-5" />}
      title="Vault"
      meta="Turn uploads into Skill-ready context with evidence and confidence."
      actions={
        <>
          <button
            type="button"
            onClick={() => setIsIntakeOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            <PlusIcon className="h-4 w-4" />
            New intake
          </button>
          <button
            type="button"
            onClick={() => navigate('/vault/review')}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Review queue
            <span className="rounded-full bg-weflora-mint/30 px-2 py-0.5 text-[10px] font-semibold text-weflora-dark">
              {reviewCount}
            </span>
          </button>
          <ScopeSwitcher
            selectedProject={selectedProject}
            recentProjects={recentProjects}
            onSelectProject={setSelectedProjectId}
          />
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="relative max-w-md">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search context…"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-4 text-sm text-slate-700"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {RECORD_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => toggleType(type)}
              className={`rounded-full px-3 py-1 text-xs font-semibold border ${
                selectedTypes.includes(type)
                  ? 'border-weflora-teal bg-weflora-mint/20 text-weflora-dark'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {type}
            </button>
          ))}
          {STATUS_VALUES.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => toggleStatus(status)}
              className={`rounded-full px-3 py-1 text-xs font-semibold border ${
                selectedStatuses.includes(status)
                  ? 'border-weflora-teal bg-weflora-mint/20 text-weflora-dark'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {statusLabel(status)}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setMissingOnly((prev) => !prev)}
            className={`rounded-full px-3 py-1 text-xs font-semibold border ${
              missingOnly ? 'border-weflora-teal bg-weflora-mint/20 text-weflora-dark' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Has missing fields
          </button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">
        <div className="rounded-2xl border border-slate-200 bg-white">
          <div className="grid grid-cols-[120px_1.6fr_1fr_140px_140px_140px_160px_160px_120px_60px] gap-3 border-b border-slate-200 px-4 py-3 text-xs font-semibold text-slate-500">
            <span>Type</span>
            <span>Title</span>
            <span>Scope</span>
            <span>Confidence</span>
            <span>Status</span>
            <span>Completeness</span>
            <span>Last updated</span>
            <span>Sources</span>
            <span>Linked</span>
            <span>⋯</span>
          </div>
          <div className="divide-y divide-slate-200">
            {isLoading ? (
              <div className="px-4 py-8 space-y-4">
                {/* Loading skeleton */}
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse grid grid-cols-[120px_1.6fr_1fr_140px_140px_140px_160px_160px_120px_60px] items-center gap-3 px-4 py-4">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-slate-200" />
                      <div className="h-4 w-16 rounded bg-slate-200" />
                    </div>
                    <div className="space-y-2">
                      <div className="h-4 w-48 rounded bg-slate-200" />
                      <div className="h-3 w-32 rounded bg-slate-100" />
                    </div>
                    <div className="h-4 w-20 rounded bg-slate-200" />
                    <div className="h-4 w-24 rounded bg-slate-200" />
                    <div className="h-4 w-20 rounded bg-slate-200" />
                    <div className="h-4 w-20 rounded bg-slate-200" />
                    <div className="h-4 w-24 rounded bg-slate-200" />
                    <div className="h-4 w-20 rounded bg-slate-200" />
                    <div className="h-4 w-16 rounded bg-slate-200" />
                    <div className="h-4 w-8 rounded bg-slate-200" />
                  </div>
                ))}
              </div>
            ) : null}
            {!isLoading && filteredRecords.map((record) => (
              <button
                key={record.recordId}
                type="button"
                onClick={() => setSelectedId(record.recordId)}
                className={`grid w-full grid-cols-[120px_1.6fr_1fr_140px_140px_140px_160px_160px_120px_60px] items-center gap-3 px-4 py-4 text-left text-sm text-slate-700 hover:bg-slate-50 ${
                  selectedId === record.recordId ? 'bg-weflora-mint/10 border-l-2 border-weflora-teal' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-weflora-mint/20 text-weflora-teal">
                    <FileTextIcon className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-semibold text-slate-600">{record.type}</span>
                </div>
                <div>
                  <p className="font-semibold text-slate-900 line-clamp-1">{record.title}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {record.tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <span className="text-xs text-slate-500">{record.scope}</span>
                <div>
                  <div className="flex items-center gap-1">
                    {confidenceSegments(record.confidence ?? 0).map((active, idx) => (
                      <span
                        key={`${record.recordId}-${idx}`}
                        className={`h-2 w-2 rounded-sm ${active ? 'bg-weflora-teal' : 'bg-slate-200'}`}
                      />
                    ))}
                  </div>
                  <span className="mt-1 block text-xs text-slate-500">
                    {record.confidence === null ? '—' : record.confidence.toFixed(2)}
                  </span>
                </div>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${statusBadge(record.status)}`}>
                  {statusLabel(record.status)}
                </span>
                <span className="text-xs text-slate-500">
                  {record.completeness.missingCount === 0 ? 'Complete' : `${record.completeness.missingCount} missing`}
                </span>
                <span className="text-xs text-slate-500">{new Date(record.updatedAt).toLocaleDateString()}</span>
                <div className="flex flex-wrap gap-1">
                  {record.sources.map((source) => (
                    <span key={source} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
                      {source}
                    </span>
                  ))}
                </div>
                <span className="text-xs text-slate-500">
                  {record.linkedProjects.length} projects
                </span>
                <span className="text-xs text-slate-400">⋯</span>
              </button>
            ))}
            {!isLoading && filteredRecords.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <SparklesIcon className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-3 text-sm font-semibold text-slate-600">
                  {records.length === 0 ? 'No vault records yet' : 'No records match the current filters'}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {records.length === 0 
                    ? 'Upload files to create your first vault record.'
                    : 'Try adjusting your search or filter criteria.'}
                </p>
                {records.length === 0 && (
                  <button
                    type="button"
                    onClick={() => setIsIntakeOpen(true)}
                    className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                  >
                    <PlusIcon className="h-4 w-4" />
                    New intake
                  </button>
                )}
              </div>
            ) : null}
          </div>
          <div className="border-t border-slate-200 px-4 py-3 text-center">
            <button
              type="button"
              onClick={loadMore}
              disabled={!hasMore || isLoading}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              {hasMore ? 'Load more' : 'No more records'}
            </button>
          </div>
        </div>

        <aside className="rounded-2xl border border-slate-200 bg-white p-4 sticky top-4">
          {selectedRecord ? (
            <div className="space-y-4">
              <div className="border-b border-slate-200 pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${statusBadge(selectedRecord.status)}`}>
                      {statusLabel(selectedRecord.status)}
                    </span>
                    <span className="rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-500">
                      {selectedRecord.completeness.missingCount === 0 ? 'Complete' : `${selectedRecord.completeness.missingCount} missing`}
                    </span>
                    <span className="rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-500">
                      {selectedRecord.validations.errors.length > 0
                        ? `${selectedRecord.validations.errors.length} errors`
                        : selectedRecord.validations.warnings.length > 0
                          ? `${selectedRecord.validations.warnings.length} warnings`
                          : 'Valid'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedId(null)}
                    className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    title="Close panel"
                  >
                    <XIcon className="h-4 w-4" />
                  </button>
                </div>
                <h2 className="mt-3 text-lg font-semibold text-slate-900">{selectedRecord.title}</h2>
                <p className="mt-1 text-xs text-slate-500">{selectedRecord.type} · {selectedRecord.scope}</p>
                <p className="mt-1 text-[10px] text-slate-400 font-mono">ID: {selectedRecord.recordId}</p>
                <div className="mt-3">
                  <p className="text-xs font-semibold text-slate-700">Confidence</p>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      {confidenceSegments(selectedRecord.confidence ?? 0).map((active, idx) => (
                        <span
                          key={`${selectedRecord.recordId}-drawer-${idx}`}
                          className={`h-2 w-2 rounded-sm ${active ? 'bg-weflora-teal' : 'bg-slate-200'}`}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-slate-500">
                      {selectedRecord.confidence === null ? '—' : selectedRecord.confidence.toFixed(2)}
                    </span>
                    <button className="text-xs font-semibold text-weflora-teal hover:text-weflora-dark">Why this score?</button>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 text-xs font-semibold">
                {(['fields', 'evidence', 'validations', 'usage', 'history'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`rounded-full px-3 py-1 ${
                      activeTab === tab ? 'bg-weflora-mint/20 text-weflora-dark' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>

              {activeTab === 'fields' && (
                <div className="space-y-4">
                  {selectedRecord.completeness.missingCount > 0 ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                      {selectedRecord.completeness.missingCount} required fields missing. Fill now to improve readiness.
                    </div>
                  ) : null}
                  <div className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Field table</span>
                      <button className="text-weflora-teal">Attach evidence</button>
                    </div>
                    <div className="mt-3 space-y-2 text-sm text-slate-700">
                      <div className="flex items-center justify-between">
                        <span>filename</span>
                        <span className="text-xs text-slate-500">{selectedRecord.vault.filename}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>mime_type</span>
                        <span className="text-xs text-slate-500">{selectedRecord.vault.mimeType}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>size_bytes</span>
                        <span className="text-xs text-slate-500">{selectedRecord.vault.sizeBytes}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'evidence' && (
                <div className="space-y-3">
                  <div className="rounded-lg border border-slate-200 p-3 text-sm text-slate-600">
                    <p className="text-xs font-semibold text-slate-700">Primary source</p>
                    <p className="mt-2 text-xs text-slate-500 font-mono break-all">{selectedRecord.vault.storage.bucket}/{selectedRecord.vault.storage.path}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleOpenSource}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        Preview file
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedRecord.status === 'needs_review' || selectedRecord.status === 'pending' || selectedRecord.status === 'draft') {
                            navigate(`/vault/review/${selectedRecord.recordId}`);
                          } else {
                            showNotification('Only records needing review can be sent to review.', 'error');
                          }
                        }}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        Review
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate(`/skills?vaultId=${selectedRecord.recordId}`)}
                        className="inline-flex items-center gap-2 rounded-lg bg-weflora-teal px-3 py-2 text-xs font-semibold text-white hover:bg-weflora-dark"
                      >
                        Send to Skill…
                      </button>
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3 text-sm text-slate-600">
                    <p className="text-xs font-semibold text-slate-700">Linked projects</p>
                    {selectedRecord.linkedProjects.length === 0 ? (
                      <p className="mt-2 text-xs text-slate-500">No project links yet.</p>
                    ) : (
                      <ul className="mt-2 space-y-1 text-xs text-slate-600">
                        {selectedRecord.linkedProjects.map((project) => (
                          <li key={project.id}>{project.name}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'validations' && (
                <div className="space-y-3">
                  <div className="rounded-lg border border-slate-200 p-3 text-sm text-slate-600">
                    <p className="text-xs font-semibold text-slate-700">Errors</p>
                    {selectedRecord.validations.errors.length === 0 ? (
                      <p className="mt-2 text-xs text-slate-500">No blocking errors detected.</p>
                    ) : (
                      <ul className="mt-2 space-y-1 text-xs text-rose-600">
                        {selectedRecord.validations.errors.map((error) => (
                          <li key={error}>{error}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3 text-sm text-slate-600">
                    <p className="text-xs font-semibold text-slate-700">Warnings</p>
                    {selectedRecord.validations.warnings.length === 0 ? (
                      <p className="mt-2 text-xs text-slate-500">No warnings detected.</p>
                    ) : (
                      <ul className="mt-2 space-y-1 text-xs text-amber-600">
                        {selectedRecord.validations.warnings.map((warning) => (
                          <li key={warning}>{warning}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'usage' && (
                <div className="rounded-lg border border-slate-200 p-3 text-sm text-slate-600">
                  <p className="text-xs font-semibold text-slate-700">Linked projects</p>
                  {selectedRecord.linkedProjects.length === 0 ? (
                    <p className="mt-2 text-xs text-slate-500">No project usage recorded yet.</p>
                  ) : (
                    <ul className="mt-2 space-y-1 text-xs text-slate-600">
                      {selectedRecord.linkedProjects.map((project) => (
                        <li key={project.id}>{project.name}</li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-4">
                    <p className="text-xs font-semibold text-slate-700">Skills using this record type</p>
                    <ul className="mt-2 space-y-1 text-xs text-slate-600">
                      {usageByRecordType.skillUsage
                        .filter((skill) => skill.recordTypes.includes(selectedRecord.type))
                        .map((skill) => (
                          <li key={skill.id}>{skill.title}</li>
                        ))}
                    </ul>
                  </div>
                  <div className="mt-4">
                    <p className="text-xs font-semibold text-slate-700">Flows using this record type</p>
                    <ul className="mt-2 space-y-1 text-xs text-slate-600">
                      {usageByRecordType.flowUsage
                        .filter((flow) => flow.recordTypes.includes(selectedRecord.type))
                        .map((flow) => (
                          <li key={flow.id}>{flow.title}</li>
                        ))}
                    </ul>
                  </div>
                </div>
              )}

              {activeTab === 'history' && (
                <div className="rounded-lg border border-slate-200 p-3 text-sm text-slate-600">
                  <p className="text-xs text-slate-500">Created {new Date(selectedRecord.vault.createdAt).toLocaleString()}</p>
                  <p className="mt-2 text-xs text-slate-500">Updated {new Date(selectedRecord.vault.updatedAt).toLocaleString()}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-sm text-slate-500">
              <SparklesIcon className="h-8 w-8 text-weflora-teal/40" />
              Select a record to review fields and evidence.
            </div>
          )}
        </aside>
      </div>

      {isIntakeOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">New intake</h2>
                <p className="mt-1 text-sm text-slate-500">Turn uploads into validated context records.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsIntakeOpen(false)}
                className="text-sm text-slate-400 hover:text-slate-600"
              >
                Close
              </button>
            </div>

            <div className="mt-6 flex items-center gap-3 text-xs text-slate-500">
              {[1, 2, 3, 4].map((step) => (
                <span key={step} className={step === intakeStep ? 'font-semibold text-slate-900' : ''}>
                  Step {step}
                </span>
              ))}
            </div>

            <div className="mt-6 rounded-xl border border-slate-200 p-4">
              {intakeStep === 1 && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <FilePicker accept={FILE_VALIDATION.ACCEPTED_FILE_TYPES} multiple onPick={handleIntakeFiles}>
                      {({ open }) => (
                        <button
                          type="button"
                          onClick={open}
                          disabled={isUploading}
                          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                        >
                          Upload
                        </button>
                      )}
                    </FilePicker>
                    <button type="button" className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                      Paste/Type
                    </button>
                    <button type="button" className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                      Select raw files
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="radio"
                        name="scope"
                        checked={intakeScope === 'global'}
                        onChange={() => setIntakeScope('global')}
                        className="h-4 w-4 text-weflora-teal"
                      />
                      Global
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="radio"
                        name="scope"
                        checked={intakeScope === 'project'}
                        onChange={() => setIntakeScope('project')}
                        className="h-4 w-4 text-weflora-teal"
                      />
                      Project
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={linkToProject}
                        onChange={(event) => setLinkToProject(event.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-weflora-teal"
                      />
                      Also link to selected project
                    </label>
                  </div>
                </div>
              )}

              {intakeStep === 2 && (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {RECORD_TYPES.map((type) => (
                      <button
                        key={type}
                        type="button"
                        className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                  <input
                    placeholder="Title"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                  />
                  <input
                    placeholder="Tags"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                  />
                </div>
              )}

              {intakeStep === 3 && (
                <div className="space-y-3 text-sm text-slate-600">
                  <p>Extracting…</p>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    Detected fields table placeholder.
                  </div>
                </div>
              )}

              {intakeStep === 4 && (
                <div className="space-y-3 text-sm text-slate-600">
                  <p>Review missing fields before creating.</p>
                  <button className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800">
                    Create (needs review)
                  </button>
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIntakeStep((prev) => Math.max(prev - 1, 1))}
                className="text-xs font-semibold text-slate-600 hover:text-slate-800"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setIntakeStep((prev) => Math.min(prev + 1, 4))}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </PageShell>
  );
};

interface ScopeSwitcherProps {
  selectedProject: { id: string; name: string } | null;
  recentProjects: Array<{ id: string; name: string }>;
  onSelectProject: (id: string | null) => void;
}

const ScopeSwitcher: React.FC<ScopeSwitcherProps> = ({ selectedProject, recentProjects, onSelectProject }) => {
  return (
    <div className="flex flex-wrap items-center gap-2">
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

export default VaultInventoryView;
