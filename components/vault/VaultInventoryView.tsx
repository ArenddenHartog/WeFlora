import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageShell from '../ui/PageShell';
import { useProject } from '../../contexts/ProjectContext';
import { useUI } from '../../contexts/UIContext';
import FilePicker from '../FilePicker';
import { FILE_VALIDATION, linkVaultObjectsToProject, uploadToGlobalVault } from '../../services/fileService';
import {
  deriveVaultInventoryRecords,
  fetchVaultInventoryPage,
  getVaultFileUrl,
  type VaultInventoryRecord,
} from '../../services/vaultInventoryService';
import { agentProfilesContract } from '../../src/agentic/registry/agents';
import { flowTemplates } from '../../src/agentic/registry/flows';
import { getSkillContextTypes } from '../../src/agentic/contracts/contractCatalog';
import { track } from '../../src/agentic/telemetry/telemetry';
import { safeAction, formatErrorWithTrace } from '../../utils/safeAction';
import { STATUS_META, getStatusBadgeClasses, type VaultStatus } from '../../utils/vaultStatus';
import {
  btnPrimary,
  btnSecondary,
  btnDanger,
  iconWrap,
  h2,
  muted,
  body,
  chip,
  previewArea,
  tableHeaderRow,
  tableRow,
  tableRowSelected,
} from '../../src/ui/tokens';
import {
  ChevronDownIcon,
  DatabaseIcon,
  FileTextIcon,
  PlusIcon,
  SearchIcon,
  SparklesIcon,
  XIcon,
} from '../icons';

const RECORD_TYPES = ['Policy', 'SpeciesList', 'Site', 'Vision', 'Climate', 'Other'] as const;
const STATUS_VALUES: VaultStatus[] = ['draft', 'pending', 'needs_review', 'in_review', 'accepted', 'blocked'];

export type ContextRecordType = (typeof RECORD_TYPES)[number];

const statusBadge = (status: VaultStatus) => getStatusBadgeClasses(status);
const statusLabel = (status: VaultStatus) => STATUS_META[status]?.label ?? status;

const confidenceSegments = (confidence: number) => {
  const segments = 10;
  const active = Math.round(confidence * segments);
  return Array.from({ length: segments }, (_, idx) => idx < active);
};

const relevanceLabel = (relevance: number | null | undefined): string => {
  if (relevance == null) return '—';
  if (relevance >= 0.7) return 'H';
  if (relevance >= 0.4) return 'M';
  return 'L';
};

const VaultInventoryView: React.FC = () => {
  const navigate = useNavigate();
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
  const [previewOpen, setPreviewOpen] = useState(false);

  // Route-param driven selection
  const selectedRecord = useMemo(() => {
    if (!selectedId) return null;
    return records.find((r) => r.recordId === selectedId) ?? null;
  }, [selectedId, records]);

  const setSelectedId = useCallback(
    (id: string | null) => {
      if (id) {
        navigate(`/vault/${id}`, { replace: false });
      } else {
        navigate('/vault', { replace: false });
      }
    },
    [navigate],
  );

  const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? null;
  const recentProjects = projects.slice(0, 5);

  const loadInventory = useCallback(async () => {
    setIsLoading(true);
    await safeAction(
      async () => {
        const { vaultObjects, projectLinks, cursor: nextCursor } = await fetchVaultInventoryPage({
          projectId: selectedProjectId,
          limit: 50,
          cursor: null,
        });
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
        },
      },
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
        const { vaultObjects, projectLinks, cursor: nextCursor } = await fetchVaultInventoryPage({
          projectId: selectedProjectId,
          limit: 50,
          cursor,
        });
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
        },
      },
    );
    setIsLoading(false);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const intake = params.get('intake');
    const typesParam = params.get('types');
    const typeParam = params.get('type');
    const scopeParam = params.get('scope');

    if (intake === '1') setIsIntakeOpen(true);
    if (scopeParam === 'project') setIntakeScope('project');

    if (typesParam) {
      const types = typesParam
        .split(',')
        .map((v) => v.trim())
        .filter((v) => RECORD_TYPES.includes(v as ContextRecordType));
      if (types.length) setSelectedTypes(types as ContextRecordType[]);
    } else if (typeParam && RECORD_TYPES.includes(typeParam as ContextRecordType)) {
      setSelectedTypes([typeParam as ContextRecordType]);
    }
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

  const reviewCount = records.filter((r) => r.status === 'needs_review' || r.status === 'pending').length;

  const handleIntakeFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setIsUploading(true);
    try {
      const uploaded = await uploadToGlobalVault(files);
      if ((intakeScope === 'project' || linkToProject) && selectedProjectId) {
        await linkVaultObjectsToProject(
          selectedProjectId,
          uploaded.map((item) => item.id),
        );
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
      recordTypes: getSkillContextTypes(profile),
    }));
    const flowUsage = flowTemplates.map((flow) => ({
      id: flow.id,
      title: flow.title,
      recordTypes: Array.from(
        new Set(
          flow.steps.flatMap((step) => {
            const profile = agentProfilesContract.find((item) => item.id === step.agent_id);
            return profile ? getSkillContextTypes(profile) : [];
          }),
        ),
      ),
    }));
    return { skillUsage, flowUsage };
  }, []);

  // Determine if the record can be sent to skill
  const canSendToSkill = selectedRecord
    ? selectedRecord.status === 'accepted' || selectedRecord.status === 'in_review'
    : false;
  const sendToSkillReason =
    selectedRecord && !canSendToSkill
      ? `Record status "${statusLabel(selectedRecord.status)}" is not eligible. Accept the record first.`
      : null;

  // Determine if record can be sent to review
  const canReview = selectedRecord
    ? ['pending', 'needs_review', 'draft'].includes(selectedRecord.status)
    : false;

  return (
    <PageShell
      icon={<DatabaseIcon className="h-5 w-5" />}
      title="Vault"
      actions={
        <>
          <button type="button" onClick={() => setIsIntakeOpen(true)} className={btnPrimary}>
            <PlusIcon className="h-4 w-4" />
            New intake
          </button>
          <button type="button" onClick={() => navigate('/vault/review')} className={btnSecondary}>
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
      {/* ── Search + Filters ──────────────────────────── */}
      <div className="flex flex-col gap-4">
        <div className="relative max-w-md">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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
              className={`${chip} ${
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
              className={`${chip} ${
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
            className={`${chip} ${
              missingOnly ? 'border-weflora-teal bg-weflora-mint/20 text-weflora-dark' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Has missing fields
          </button>
        </div>
      </div>

      {/* ── Split: Table + Detail ─────────────────────── */}
      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1fr_380px]">
        {/* ── Table-like inventory list ─────────────── */}
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className={`grid grid-cols-[1.8fr_100px_100px_90px_120px_90px_70px] gap-3 px-4 py-3 ${tableHeaderRow}`}>
            <span>Title</span>
            <span>Type</span>
            <span>Status</span>
            <span>Scope</span>
            <span>Updated</span>
            <span>Confidence</span>
            <span>Rel.</span>
          </div>
          <div className="divide-y divide-slate-100">
            {/* Loading skeleton */}
            {isLoading && records.length === 0 && (
              <div className="px-4 py-6 space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="animate-pulse grid grid-cols-[1.8fr_100px_100px_90px_120px_90px_70px] items-center gap-3 py-3"
                  >
                    <div className="space-y-2">
                      <div className="h-4 w-48 rounded bg-slate-200" />
                      <div className="h-3 w-24 rounded bg-slate-100" />
                    </div>
                    <div className="h-4 w-16 rounded bg-slate-200" />
                    <div className="h-4 w-16 rounded bg-slate-200" />
                    <div className="h-4 w-12 rounded bg-slate-200" />
                    <div className="h-4 w-20 rounded bg-slate-200" />
                    <div className="h-4 w-16 rounded bg-slate-200" />
                    <div className="h-4 w-8 rounded bg-slate-200" />
                  </div>
                ))}
              </div>
            )}

            {/* Rows */}
            {!isLoading &&
              filteredRecords.map((record) => (
                <button
                  key={record.recordId}
                  type="button"
                  onClick={() => setSelectedId(record.recordId)}
                  className={`grid w-full grid-cols-[1.8fr_100px_100px_90px_120px_90px_70px] items-center gap-3 px-4 py-3 text-left ${tableRow} ${
                    selectedId === record.recordId ? tableRowSelected : ''
                  }`}
                >
                  {/* Title */}
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 truncate">{record.title}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {record.tags.slice(0, 2).map((tag) => (
                        <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  {/* Type chip */}
                  <span className={`${chip} border-slate-200 text-slate-600 inline-block w-fit`}>{record.type}</span>
                  {/* Status badge */}
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs w-fit ${statusBadge(record.status)}`}>
                    {statusLabel(record.status)}
                  </span>
                  {/* Scope */}
                  <span className="text-xs text-slate-500">{record.scope === 'Global' ? 'Global' : 'Project'}</span>
                  {/* Updated */}
                  <span className="text-xs text-slate-500">{new Date(record.updatedAt).toLocaleDateString()}</span>
                  {/* Confidence */}
                  <span className="text-xs text-slate-600 font-mono">
                    {record.confidence === null ? '—' : record.confidence.toFixed(2)}
                  </span>
                  {/* Relevance */}
                  <span className="text-xs text-slate-500">{relevanceLabel(record.confidence)}</span>
                </button>
              ))}

            {/* Empty state */}
            {!isLoading && filteredRecords.length === 0 && (
              <div className="px-4 py-10 text-center">
                <SparklesIcon className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-3 text-sm font-semibold text-slate-600">
                  {records.length === 0 ? 'No vault records yet' : 'No records match the current filters'}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {records.length === 0
                    ? 'Upload data to run Skills against your context.'
                    : 'Try adjusting your search or filter criteria.'}
                </p>
                {records.length === 0 && (
                  <button type="button" onClick={() => setIsIntakeOpen(true)} className={`mt-4 ${btnPrimary}`}>
                    <PlusIcon className="h-4 w-4" />
                    Upload data
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Load more */}
          <div className="border-t border-slate-200 px-4 py-3 text-center">
            <button
              type="button"
              onClick={loadMore}
              disabled={!hasMore || isLoading}
              className={btnSecondary}
            >
              {hasMore ? 'Load more' : 'No more records'}
            </button>
          </div>
        </div>

        {/* ── Detail panel (visible when :id present) ─── */}
        <aside className="rounded-xl border border-slate-200 bg-white p-4 sticky top-16 self-start">
          {selectedRecord ? (
            <div key={selectedId} className="space-y-4">
              {/* 1. Header: title, chips, record id */}
              <div className="border-b border-slate-200 pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`${chip} ${statusBadge(selectedRecord.status)}`}>
                      {statusLabel(selectedRecord.status)}
                    </span>
                    <span className={`${chip} border-slate-200 text-slate-600`}>{selectedRecord.type}</span>
                    <span className={`${chip} border-slate-200 text-slate-500`}>{selectedRecord.scope}</span>
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
                <h2 className={`mt-3 ${h2}`}>{selectedRecord.title}</h2>
                <p className="mt-1 text-[10px] text-slate-400 font-mono">ID: {selectedRecord.recordId}</p>
              </div>

              {/* 2. Primary actions row */}
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setPreviewOpen((p) => !p)} className={btnSecondary}>
                  {previewOpen ? 'Hide preview' : 'Open preview'}
                </button>
                {canReview ? (
                  <button
                    type="button"
                    onClick={() => navigate(`/vault/review/${selectedRecord.recordId}`)}
                    className={btnSecondary}
                  >
                    Review
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                    Review not available for {statusLabel(selectedRecord.status)} records.
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => navigate(`/skills?vaultId=${selectedRecord.recordId}`)}
                  disabled={!canSendToSkill}
                  className={btnPrimary}
                >
                  Send to Skill
                </button>
                {sendToSkillReason && (
                  <p className="w-full text-[11px] text-amber-600 mt-1">{sendToSkillReason}</p>
                )}
              </div>

              {/* 3. Readiness snapshot */}
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs font-semibold text-slate-700">Readiness snapshot</p>
                <p className={`mt-1 ${muted}`}>
                  {selectedRecord.completeness.missingCount === 0
                    ? 'This record satisfies all detected pointers.'
                    : `${selectedRecord.completeness.missingCount} required fields missing. Fill now to improve readiness.`}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex items-center gap-0.5">
                    {confidenceSegments(selectedRecord.confidence ?? 0).map((active, idx) => (
                      <span
                        key={`${selectedRecord.recordId}-conf-${idx}`}
                        className={`h-2 w-2 rounded-sm ${active ? 'bg-weflora-teal' : 'bg-slate-200'}`}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-slate-500">
                    {selectedRecord.confidence === null ? '—' : selectedRecord.confidence.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* 4. Preview section (hidden by default, toggleable) */}
              {previewOpen && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-700">Preview</p>
                  {/* This is the ONLY allowed nested scroll in the app */}
                  <div className={previewArea}>
                    {selectedRecord.vault.mimeType?.startsWith('application/pdf') ? (
                      <div className="flex flex-col items-center justify-center p-6 text-center">
                        <FileTextIcon className="h-10 w-10 text-slate-300 mb-3" />
                        <p className={body}>PDF document</p>
                        <button type="button" onClick={handleOpenSource} className={`mt-3 ${btnSecondary}`}>
                          Open PDF in new tab
                        </button>
                        {/* TODO: inline PDF viewer with provenance highlight overlays */}
                        <div className="mt-4 w-full rounded border border-dashed border-slate-200 p-3 text-[11px] text-slate-400">
                          Inline PDF viewer with provenance highlights — phase later
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center p-6 text-center">
                        <FileTextIcon className="h-10 w-10 text-slate-300 mb-3" />
                        <p className={body}>{selectedRecord.vault.filename}</p>
                        <p className={muted}>{selectedRecord.vault.mimeType} · {selectedRecord.vault.sizeBytes} bytes</p>
                        <button type="button" onClick={handleOpenSource} className={`mt-3 ${btnSecondary}`}>
                          Download / Open file
                        </button>
                        {/* TODO: Provenance highlight overlay structure */}
                        <div className="mt-4 w-full rounded border border-dashed border-slate-200 p-3 text-[11px] text-slate-400">
                          Provenance highlight overlay — phase later
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 5. Detail tabs */}
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
                  {selectedRecord.completeness.missingCount > 0 && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                      {selectedRecord.completeness.missingCount} required fields missing. Fill now to improve readiness.
                    </div>
                  )}
                  <div className="rounded-lg border border-slate-200 p-3">
                    <div className="space-y-2 text-sm text-slate-700">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500">filename</span>
                        <span className="text-xs text-slate-600 truncate max-w-[180px]">{selectedRecord.vault.filename}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500">mime_type</span>
                        <span className="text-xs text-slate-600">{selectedRecord.vault.mimeType}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500">size_bytes</span>
                        <span className="text-xs text-slate-600">{selectedRecord.vault.sizeBytes}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'evidence' && (
                <div className="space-y-3">
                  <div className="rounded-lg border border-slate-200 p-3 text-sm text-slate-600">
                    <p className="text-xs font-semibold text-slate-700">Primary source</p>
                    <p className="mt-2 text-xs text-slate-500 font-mono break-all">
                      {selectedRecord.vault.storage.bucket}/{selectedRecord.vault.storage.path}
                    </p>
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
                  <div className="rounded-lg border border-slate-200 p-3">
                    <p className="text-xs font-semibold text-slate-700">Errors</p>
                    {selectedRecord.validations.errors.length === 0 ? (
                      <p className="mt-2 text-xs text-slate-500">No blocking errors detected.</p>
                    ) : (
                      <ul className="mt-2 space-y-1 text-xs text-rose-600">
                        {selectedRecord.validations.errors.map((e) => (
                          <li key={e}>{e}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3">
                    <p className="text-xs font-semibold text-slate-700">Warnings</p>
                    {selectedRecord.validations.warnings.length === 0 ? (
                      <p className="mt-2 text-xs text-slate-500">No warnings detected.</p>
                    ) : (
                      <ul className="mt-2 space-y-1 text-xs text-amber-600">
                        {selectedRecord.validations.warnings.map((w) => (
                          <li key={w}>{w}</li>
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
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-sm text-slate-500 py-10">
              <SparklesIcon className="h-8 w-8 text-weflora-teal/40" />
              Select a record to review fields, preview data, and send to Skills.
            </div>
          )}
        </aside>
      </div>

      {/* ── Intake Modal ──────────────────────────────── */}
      {isIntakeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-label="New intake"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className={h2}>New intake</h2>
                <p className={`mt-1 ${muted}`}>Upload files to create validated context records.</p>
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
                        <button type="button" onClick={open} disabled={isUploading} className={btnPrimary}>
                          Upload
                        </button>
                      )}
                    </FilePicker>
                    <button type="button" disabled className={`${btnSecondary} opacity-50 cursor-not-allowed`}>
                      Paste/Type
                      <span className="text-[10px] text-slate-400 ml-1">(coming soon)</span>
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
                        onChange={(e) => setLinkToProject(e.target.checked)}
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
                        className={`${chip} border-slate-200 text-slate-600 hover:bg-slate-50`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                  <input placeholder="Title" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700" />
                  <input placeholder="Tags" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700" />
                </div>
              )}

              {intakeStep === 3 && (
                <div className="space-y-3 text-sm text-slate-600">
                  <p>Extracting…</p>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">Detected fields table placeholder.</div>
                </div>
              )}

              {intakeStep === 4 && (
                <div className="space-y-3 text-sm text-slate-600">
                  <p>Review missing fields before creating.</p>
                  <button className={btnPrimary}>Create (needs review)</button>
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIntakeStep((prev) => Math.max(prev - 1, 1))}
                className={btnSecondary}
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setIntakeStep((prev) => Math.min(prev + 1, 4))}
                className={btnSecondary}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
};

/* ── Scope Switcher ──────────────────────────────────── */
interface ScopeSwitcherProps {
  selectedProject: { id: string; name: string } | null;
  recentProjects: Array<{ id: string; name: string }>;
  onSelectProject: (id: string | null) => void;
}

const ScopeSwitcher: React.FC<ScopeSwitcherProps> = ({ selectedProject, recentProjects, onSelectProject }) => {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className={`${chip} border-slate-200 bg-slate-100 text-slate-700`}>Global</span>
      {selectedProject ? (
        <span className={`${chip} border-weflora-mint bg-weflora-mint/20 text-weflora-dark`}>
          Project: {selectedProject.name}
          <button type="button" onClick={() => onSelectProject(null)} className="ml-1 text-weflora-teal hover:text-weflora-dark">
            ×
          </button>
        </span>
      ) : null}
      <div className="relative">
        <select
          value={selectedProject?.id ?? ''}
          onChange={(e) => onSelectProject(e.target.value || null)}
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
