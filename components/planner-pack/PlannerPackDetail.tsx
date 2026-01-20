import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';
import { useUI } from '../../contexts/UIContext';
import { useAuth } from '../../contexts/AuthContext';
import type { PlannerArtifact, PlannerGeometry } from '../../src/planner-pack/v1/schemas';
import type { PcivScopeMemberV1 } from '../../src/decision-program/pciv/v1/schemas';
import { PcivSchemaMismatchError } from '../../src/decision-program/pciv/v1/storage/rls-errors';
import {
  getIntervention,
  listArtifacts,
  listScopeMembers,
  removeScopeMember,
  setGeometry,
  updateScopeMemberRole
} from '../../src/planner-pack/v1/storage/supabase';
import { inventoryIngest } from '../../src/planner-pack/v1/workers/inventoryIngest';
import { plannerPackCompose } from '../../src/planner-pack/v1/workers/plannerPackCompose';
import GeometryStep from './GeometryStep';
import SourcesPanel, { type PlannerSourceItem } from './SourcesPanel';
import RunsPanel from './RunsPanel';
import LivingRecordPanel from './LivingRecordPanel';
import { addUploadSource } from '../../src/planner-pack/v1/storage/supabase';
import { uploadFile } from '../../services/fileService';
import ScopeAccessPanel from './ScopeAccessPanel';
import type { AssumptionItem } from './AssumptionsModule';
import { sanitizeHtml } from './documentSanitizer';

const DEFAULT_GEOMETRY = {
  kind: 'corridor' as const,
  corridorWidthM: 12,
  geojson: {
    type: 'Feature' as const,
    geometry: {
      type: 'LineString' as const,
      coordinates: [
        [5.0921, 52.0938],
        [5.1042, 52.0944]
      ]
    },
    properties: {}
  },
  lengthM: 1200,
  areaM2: 14400
};

const storageKey = (id: string) => `planner-pack-geometry-${id}`;

const safeParseGeojson = (text: string) => {
  try {
    return { value: JSON.parse(text), error: null } as { value: any; error: string | null };
  } catch (error) {
    return { value: null, error: 'Invalid GeoJSON. Please fix the JSON syntax.' };
  }
};

const extractGeometry = (geojson: any) => {
  if (!geojson) return null;
  if (geojson.type === 'Feature') return geojson.geometry ?? null;
  if (geojson.type === 'FeatureCollection') return geojson.features?.[0]?.geometry ?? null;
  return geojson.geometry ?? null;
};

const computeLineLength = (coordinates: number[][]) =>
  coordinates.reduce((acc, point, index) => {
    if (index === 0) return 0;
    const [x1, y1] = coordinates[index - 1];
    const [x2, y2] = point;
    const dx = x2 - x1;
    const dy = y2 - y1;
    return acc + Math.sqrt(dx * dx + dy * dy);
  }, 0);

const computePolygonArea = (coordinates: number[][]) => {
  let area = 0;
  for (let i = 0; i < coordinates.length; i += 1) {
    const [x1, y1] = coordinates[i];
    const [x2, y2] = coordinates[(i + 1) % coordinates.length];
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area / 2);
};

const runWithTimeout = async <T,>(promise: Promise<T>, timeoutMs = 8000): Promise<T> => {
  let timeoutId: number | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error('Run timed out after 8 seconds.')), timeoutMs);
  });
  const result = await Promise.race([promise, timeoutPromise]);
  if (timeoutId) window.clearTimeout(timeoutId);
  return result as T;
};

const PlannerPackDetail: React.FC = () => {
  const { id } = useParams();
  const { showNotification } = useUI();
  const { user } = useAuth();
  const [intervention, setIntervention] = useState<any>(null);
  
  const notifyRef = useRef(showNotification);
  useEffect(() => {
    notifyRef.current = showNotification;
  }, [showNotification]);
  const [artifacts, setArtifacts] = useState<Partial<Record<PlannerArtifact['type'], PlannerArtifact>>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [sources, setSources] = useState<PlannerSourceItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [inventoryStatus, setInventoryStatus] = useState<'idle' | 'running' | 'failed' | 'succeeded'>('idle');
  const [composeStatus, setComposeStatus] = useState<'idle' | 'running' | 'failed' | 'succeeded'>('idle');
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const [composeError, setComposeError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [members, setMembers] = useState<PcivScopeMemberV1[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [schemaMismatch, setSchemaMismatch] = useState(false);

  const [kind, setKind] = useState<'polygon' | 'corridor'>('corridor');
  const [geojsonText, setGeojsonText] = useState('');
  const [corridorWidthM, setCorridorWidthM] = useState(12);
  const [metrics, setMetrics] = useState<{ areaM2?: number | null; lengthM?: number | null }>({});
  const [geojsonError, setGeojsonError] = useState<string | null>(null);
  const [metricsNote, setMetricsNote] = useState<string | null>(null);

  const fileCache = useRef<Record<string, string>>({});
  const actionGateRef = useRef({ inventory: 0, compose: 0 });
  const failureCountRef = useRef({ inventory: 0, compose: 0 });
  const nextAllowedRef = useRef({ inventory: 0, compose: 0 });
  const autoComposeRef = useRef(false);

  const loadArtifacts = useCallback(async (interventionId: string) => {
    const list = await listArtifacts(supabase, interventionId);
    const byType: Partial<Record<PlannerArtifact['type'], PlannerArtifact>> = {};
    list.forEach((artifact) => {
      const existing = byType[artifact.type];
      if (!existing || artifact.version > existing.version) {
        byType[artifact.type] = artifact;
      }
    });
    setArtifacts(byType);

    const logEntries = [] as string[];
    if (byType.check_report) logEntries.push('✔ Data ingested');
    if (byType.memo) logEntries.push('✔ Compliance memo generated');
    if (byType.options) logEntries.push('✔ Option set prepared');
    if (byType.procurement) logEntries.push('✔ Procurement pack prepared');
    if (byType.email_draft) logEntries.push('✔ Email draft ready');
    if (byType.maintenance) logEntries.push('✔ Maintenance plan generated');
    setLogs(logEntries);
  }, []);

  const loadIntervention = useCallback(async () => {
    if (schemaMismatch) return;
    if (!id) return;
    setIsLoading(true);
    setMembersLoading(true);
    try {
      const record = await getIntervention(supabase, id);
      setIntervention(record);
      await loadArtifacts(id);
      const scopeMembers = await listScopeMembers(record.scopeId);
      setMembers(scopeMembers);
    } catch (error) {
      console.error(error);
      if (error instanceof PcivSchemaMismatchError) {
        setSchemaMismatch(true);
        notifyRef.current('Database schema mismatch detected. Please refresh the page or contact support.', 'error');
        // Don't retry on schema mismatch - fail fast
        return;
      }
      notifyRef.current('Unable to load Planner Pack.', 'error');
    } finally {
      setMembersLoading(false);
      setIsLoading(false);
    }
  }, [id, loadArtifacts, schemaMismatch]);

  useEffect(() => {
    loadIntervention();
  }, [loadIntervention]);

  useEffect(() => {
    if (!id) return;
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(storageKey(id));
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored);
      setKind(parsed.kind ?? 'corridor');
      setGeojsonText(parsed.geojsonText ?? '');
      setCorridorWidthM(parsed.corridorWidthM ?? 12);
      setMetrics(parsed.metrics ?? {});
    } catch (error) {
      console.error(error);
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    if (typeof window === 'undefined') return;
    const payload = {
      kind,
      geojsonText,
      corridorWidthM,
      metrics
    };
    window.localStorage.setItem(storageKey(id), JSON.stringify(payload));
  }, [id, kind, geojsonText, corridorWidthM, metrics]);

  const buildGeometryFromState = useCallback(() => {
    const parsed = safeParseGeojson(geojsonText);
    if (!parsed.value) {
      setGeojsonError(parsed.error);
      return null;
    }
    setGeojsonError(null);
    return {
      kind,
      corridorWidthM: kind === 'corridor' ? corridorWidthM : undefined,
      geojson: parsed.value,
      areaM2: metrics.areaM2 ?? null,
      lengthM: metrics.lengthM ?? null
    } as PlannerGeometry;
  }, [geojsonText, kind, corridorWidthM, metrics.areaM2, metrics.lengthM]);

  useEffect(() => {
    const ensurePack = async () => {
      if (!id || !intervention) return;
      if (artifacts.memo) return;
      if (autoComposeRef.current) return;
      autoComposeRef.current = true;
      const derivedGeometry = geojsonText.trim() ? buildGeometryFromState() : null;
      const geometryToUse = derivedGeometry ?? (DEFAULT_GEOMETRY as PlannerGeometry);

      try {
        if (!geojsonText.trim()) {
          setKind(DEFAULT_GEOMETRY.kind);
          setGeojsonText(JSON.stringify(DEFAULT_GEOMETRY.geojson, null, 2));
          setCorridorWidthM(DEFAULT_GEOMETRY.corridorWidthM);
          setMetrics({ areaM2: DEFAULT_GEOMETRY.areaM2, lengthM: DEFAULT_GEOMETRY.lengthM });
          await setGeometry(supabase, id, geometryToUse);
        }
        await plannerPackCompose({
          supabase,
          interventionId: id,
          municipality: intervention.municipality,
          interventionName: intervention.name,
          geometry: geometryToUse,
          inventorySummary: null,
          sourceIds: sources.map((source) => source.id)
        });
        await loadArtifacts(id);
      } catch (error) {
        console.error(error);
      }
    };

    if (!isLoading) {
      ensurePack();
    }
  }, [artifacts.memo, geojsonText, id, intervention, isLoading, loadArtifacts, sources, buildGeometryFromState]);

  useEffect(() => {
    if (sources.length > 0) return;
    const evidence = (artifacts.check_report?.payload as any)?.evidence ?? [];
    const derivedSources = evidence
      .filter((item: any) => item?.sourceId)
      .map((item: any) => ({
        id: item.sourceId,
        title: item.title ?? 'Uploaded source',
        parseStatus: 'parsed' as const
      }));
    if (derivedSources.length > 0) {
      setSources(derivedSources);
    }
  }, [artifacts.check_report, sources.length]);

  const handleComputeMetrics = async () => {
    setGeojsonError(null);
    setMetricsNote(null);
    try {
      const parsedResult = safeParseGeojson(geojsonText);
      if (!parsedResult.value) {
        setGeojsonError(parsedResult.error);
        setMetricsNote(parsedResult.error ?? 'Invalid geometry provided.');
        return;
      }
      const parsed = parsedResult.value;
      const geometry = extractGeometry(parsed);
      if (!geometry) {
        throw new Error('GeoJSON must contain a geometry.');
      }

      if (kind === 'polygon') {
        if (geometry.type !== 'Polygon') throw new Error('Polygon geometry required.');
        const ring = geometry.coordinates?.[0] as number[][] | undefined;
        if (!ring || ring.length < 3) {
          throw new Error('Polygon coordinates are missing or invalid.');
        }
        const area = computePolygonArea(ring);
        const length = computeLineLength(ring);
        setMetrics({ areaM2: area, lengthM: length });
        if (!area || !length) {
          setMetricsNote('Unable to compute area/length from the provided polygon.');
        }
        await setGeometry(supabase, id as string, {
          kind,
          corridorWidthM: undefined,
          geojson: parsed,
          areaM2: area,
          lengthM: length
        });
      } else {
        if (!corridorWidthM || corridorWidthM <= 0) {
          throw new Error('Corridor width is required.');
        }
        if (geometry.type !== 'LineString') throw new Error('LineString geometry required.');
        const length = computeLineLength(geometry.coordinates);
        const area = length * corridorWidthM;
        setMetrics({ areaM2: area, lengthM: length });
        if (!length || !area) {
          setMetricsNote('Unable to compute corridor metrics from the provided line.');
        }
        await setGeometry(supabase, id as string, {
          kind,
          corridorWidthM,
          geojson: parsed,
          areaM2: area,
          lengthM: length
        });
      }
      showNotification('Geometry saved with computed metrics.', 'success');
    } catch (error) {
      const message = (error as Error).message;
      setGeojsonError(message);
      setMetricsNote(message);
    }
  };

  const handleUpload = async (files: File[]) => {
    if (!id) return;
    const file = files[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const uploadResult = await uploadFile(file, { relatedEntityId: id, scope: 'knowledge' });
      if (uploadResult.error) {
        throw new Error(uploadResult.error);
      }
      const source = await addUploadSource(supabase, id, {
        title: file.name,
        fileId: uploadResult.fileEntity?.id ?? null,
        mimeType: file.type
      });
      const text = await file.text();
      fileCache.current[source.id] = text;
      setSources((prev) => [
        { id: source.id, title: source.title, parseStatus: source.parseStatus, mimeType: source.mimeType },
        ...prev
      ]);
      showNotification('Upload added to sources.', 'success');
    } catch (error) {
      console.error(error);
      showNotification('Upload failed.', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRunInventory = async () => {
    if (!id) return;
    const now = Date.now();
    if (now - actionGateRef.current.inventory < 500 || now < nextAllowedRef.current.inventory) return;
    actionGateRef.current.inventory = now;
    setInventoryError(null);
    if (sources.length === 0) {
      setInventoryError('Upload a tree inventory CSV first.');
      return;
    }
    const source = sources[0];
    const fileText = fileCache.current[source.id];
    if (!fileText) {
      setInventoryError('Inventory file content unavailable. Re-upload the file.');
      return;
    }
    setInventoryStatus('running');
    try {
      const result = await runWithTimeout(
        inventoryIngest({
          supabase,
          interventionId: id,
          sourceId: source.id,
          fileText,
          geometryId: null
        })
      );
      if (!result) {
        setInventoryStatus('failed');
        setSources((prev) => prev.map((item) => (item.id === source.id ? { ...item, parseStatus: 'failed' } : item)));
        setInventoryError('Inventory ingest failed to parse any rows.');
        failureCountRef.current.inventory += 1;
        nextAllowedRef.current.inventory = Date.now() + Math.min(4000, 500 * 2 ** failureCountRef.current.inventory);
        return;
      }
      setInventoryStatus('succeeded');
      failureCountRef.current.inventory = 0;
      setSources((prev) => prev.map((item) => (item.id === source.id ? { ...item, parseStatus: 'parsed' } : item)));
      await loadArtifacts(id);
    } catch (error) {
      console.error(error);
      setInventoryStatus('failed');
      setInventoryError((error as Error).message || 'Inventory ingest failed.');
      failureCountRef.current.inventory += 1;
      nextAllowedRef.current.inventory = Date.now() + Math.min(4000, 500 * 2 ** failureCountRef.current.inventory);
    }
  };

  const handleCompose = async () => {
    if (!id || !intervention) return;
    const now = Date.now();
    if (now - actionGateRef.current.compose < 500 || now < nextAllowedRef.current.compose) return;
    actionGateRef.current.compose = now;
    setComposeError(null);
    setComposeStatus('running');

    try {
      const inventoryPayload = artifacts.check_report?.payload as any;
      const inventorySummary = inventoryPayload?.inventorySummary
        ? {
            ...inventoryPayload.inventorySummary,
            speciesDistribution: inventoryPayload.speciesMix?.speciesDistribution,
            genusDistribution: inventoryPayload.speciesMix?.genusDistribution,
            familyDistribution: inventoryPayload.speciesMix?.familyDistribution,
            tenTwentyThirtyViolations: inventoryPayload.speciesMix?.violations
          }
        : null;
      const geometry = geojsonText.trim() ? buildGeometryFromState() : (DEFAULT_GEOMETRY as PlannerGeometry);

      await runWithTimeout(
        plannerPackCompose({
          supabase,
          interventionId: id,
          municipality: intervention.municipality,
          interventionName: intervention.name,
          geometry,
          inventorySummary,
          sourceIds: sources.map((source) => source.id)
        })
      );
      setComposeStatus('succeeded');
      failureCountRef.current.compose = 0;
      await loadArtifacts(id);
    } catch (error) {
      console.error(error);
      setComposeStatus('failed');
      setComposeError((error as Error).message || 'Planner Pack generation failed.');
      failureCountRef.current.compose += 1;
      nextAllowedRef.current.compose = Date.now() + Math.min(4000, 500 * 2 ** failureCountRef.current.compose);
    }
  };

  const handleExport = (artifact: PlannerArtifact) => {
    const fileName = `${intervention?.name ?? 'planner-pack'}-${artifact.type}-v${artifact.version}.html`;
    const escapeHtml = (value: string) =>
      value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    const html = artifact.renderedHtml
      ? sanitizeHtml(artifact.renderedHtml)
      : `<pre>${escapeHtml(JSON.stringify(artifact.payload, null, 2))}</pre>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  const statusLabel = intervention?.status?.replace('_', ' ') ?? 'draft';

  const assumptions = useMemo<AssumptionItem[]>(() => {
    const payload =
      (artifacts.memo?.payload as any) ??
      (artifacts.options?.payload as any) ??
      (artifacts.procurement?.payload as any) ??
      (artifacts.maintenance?.payload as any) ??
      null;
    const list = (payload?.assumptionsDetailed ?? []) as any[];
    return list.map((item, index) => {
      const confidence = (item.confidence ?? 'Medium') as AssumptionItem['confidence'];
      const owner = (item.owner ?? 'WeFlora') as AssumptionItem['owner'];
      return {
        id: item.id ?? `assumption-${index}`,
        claim: item.claim ?? item.statement ?? 'Assumption',
        basis: item.basis ?? 'proxy',
        howToValidate: item.howToValidate ?? item.how_to_validate ?? 'Review evidence sources.',
        confidence,
        owner
      };
    });
  }, [artifacts]);

  const riskSummary = useMemo(() => {
    const outstanding = assumptions.length;
    const highRisk = assumptions.filter((item) => item.confidence === 'Low').length;
    return { outstanding, highRisk };
  }, [assumptions]);

  const preflightState = useMemo(() => {
    const geojsonParse = geojsonText.trim() ? safeParseGeojson(geojsonText) : { value: null, error: 'Missing geometry' };
    const geometryValid = Boolean(geojsonParse.value);
    const metricsValid = Boolean(metrics.lengthM && metrics.areaM2);
    const inventoryReady =
      Boolean((artifacts.check_report?.payload as any)?.inventorySummary) ||
      sources.some((source) => source.parseStatus === 'parsed');
    const memoEvidence = (artifacts.memo?.payload as any)?.evidence ?? [];
    const zoningEvidence = memoEvidence.find((item: any) => item.kind === 'regulatory');
    const zoningEvidenceReady = Boolean(zoningEvidence?.sourceId);

    return {
      geometryValid,
      metricsValid,
      inventoryReady,
      zoningEvidenceReady,
      geometryError: geojsonParse.error
    };
  }, [artifacts.check_report, artifacts.memo, geojsonText, metrics.areaM2, metrics.lengthM, sources]);

  const confidenceLabel = useMemo(() => {
    let score = 100;
    if (!preflightState.geometryValid) score -= 20;
    if (!preflightState.metricsValid) score -= 20;
    if (!preflightState.inventoryReady) score -= 20;
    if (!preflightState.zoningEvidenceReady) score -= 10;
    score -= Math.min(30, riskSummary.highRisk * 10);
    if (score >= 75) return 'High';
    if (score >= 45) return 'Medium';
    return 'Low';
  }, [preflightState, riskSummary.highRisk]);

  const recordStatus = useMemo(() => {
    const hasCoreArtifacts = Boolean(
      artifacts.memo &&
        artifacts.options &&
        artifacts.procurement &&
        artifacts.maintenance &&
        artifacts.email_draft
    );
    if (hasCoreArtifacts && preflightState.geometryValid && preflightState.metricsValid) {
      return 'submission-ready';
    }
    if (!preflightState.geometryValid || !preflightState.metricsValid) {
      return 'needs validation';
    }
    return statusLabel;
  }, [artifacts, preflightState.geometryValid, preflightState.metricsValid, statusLabel]);

  const lastUpdatedLabel = useMemo(() => {
    const dates = Object.values(artifacts)
      .filter((artifact): artifact is PlannerArtifact => Boolean(artifact))
      .map((artifact) => artifact.updatedAt ?? artifact.createdAt)
      .filter(Boolean)
      .map((iso) => new Date(iso).getTime());
    const fallback = intervention?.updatedAt ? new Date(intervention.updatedAt).getTime() : null;
    const max = Math.max(...dates, fallback ?? 0);
    if (!max || Number.isNaN(max)) return '—';
    return new Date(max).toLocaleString();
  }, [artifacts, intervention?.updatedAt]);

  const preflightItems = useMemo(
    () => [
      {
        label: 'Geometry valid',
        status: preflightState.geometryValid ? 'ok' : 'warn',
        detail: preflightState.geometryValid ? 'Geometry parsed successfully.' : preflightState.geometryError ?? 'Provide valid GeoJSON.'
      },
      {
        label: 'Metrics computed',
        status: preflightState.metricsValid ? 'ok' : 'warn',
        detail: preflightState.metricsValid ? 'Length and area ready.' : 'Compute metrics to confirm quantities.'
      },
      {
        label: 'Inventory attached',
        status: preflightState.inventoryReady ? 'ok' : 'warn',
        detail: preflightState.inventoryReady ? 'Inventory attached or parsed.' : 'Upload and ingest inventory.'
      },
      {
        label: 'Zoning evidence',
        status: preflightState.zoningEvidenceReady ? 'ok' : 'warn',
        detail: preflightState.zoningEvidenceReady
          ? 'Zoning evidence attached.'
          : 'Proxy allowed. Attach official zoning data when available.'
      }
    ],
    [
      preflightState.geometryValid,
      preflightState.geometryError,
      preflightState.inventoryReady,
      preflightState.metricsValid,
      preflightState.zoningEvidenceReady
    ]
  );

  const isSubmissionReady = recordStatus === 'submission-ready';
  const primaryLabel = isSubmissionReady ? 'Export + Email draft' : 'Generate / Update Planner Pack';
  const secondaryLabel = 'Run Inventory Ingest';

  const handlePrimaryAction = () => {
    if (isSubmissionReady && artifacts.email_draft) {
      handleExport(artifacts.email_draft);
      notifyRef.current('Email draft exported.', 'success');
      return;
    }
    handleCompose();
  };

  const handleRoleChange = async (userId: string, role: 'owner' | 'editor' | 'viewer') => {
    try {
      await updateScopeMemberRole(intervention.scopeId, userId, role);
      const refreshed = await listScopeMembers(intervention.scopeId);
      setMembers(refreshed);
      showNotification('Member role updated.', 'success');
    } catch (error) {
      console.error(error);
      showNotification('Unable to update role.', 'error');
    }
  };

  const handleRemoveMember = async (userId: string) => {
    try {
      await removeScopeMember(intervention.scopeId, userId);
      const refreshed = await listScopeMembers(intervention.scopeId);
      setMembers(refreshed);
      showNotification('Member removed.', 'success');
    } catch (error) {
      console.error(error);
      showNotification('Unable to remove member.', 'error');
    }
  };

  const handleCopyInvite = async () => {
    try {
      const link = `${window.location.origin}/planner-pack?scope=${intervention.scopeId}`;
      await navigator.clipboard.writeText(link);
      showNotification('Invite link copied.', 'success');
    } catch (error) {
      console.error(error);
      showNotification('Unable to copy invite link.', 'error');
    }
  };

  if (schemaMismatch) {
    return (
      <div className="p-6 text-sm text-red-600">Planner Pack cannot load due to a schema mismatch. Refresh once the database is updated.</div>
    );
  }

  if (isLoading || !intervention) {
    return (
      <div className="p-6 text-sm text-slate-500">Loading Planner Pack…</div>
    );
  }

  return (
    <div className="h-full bg-slate-50">
      <div className="h-full flex flex-col">
        <header className="border-b border-slate-200 bg-white px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-slate-900">{intervention.name}</h1>
              <p className="text-xs text-slate-500">
                Prepared by WeFlora on behalf of {intervention.municipality ?? 'Municipality'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="px-2 py-1 rounded-full border border-slate-200 text-slate-600">Status: {recordStatus}</span>
              <span className="px-2 py-1 rounded-full border border-slate-200 text-slate-600">
                Confidence: {confidenceLabel}
              </span>
              <span className="px-2 py-1 rounded-full border border-slate-200 text-slate-600">
                {riskSummary.outstanding} assumptions · {riskSummary.highRisk} high-risk
              </span>
            </div>
          </div>
        </header>

        <div className="flex-1 min-h-0 px-6 py-4">
          <div className="h-full grid grid-cols-12 gap-4">
            <aside className="col-span-12 xl:col-span-3 space-y-6 overflow-y-auto pr-1">
              <GeometryStep
                kind={kind}
                geojsonText={geojsonText}
                corridorWidthM={corridorWidthM}
                metrics={metrics}
                metricsNote={metricsNote}
                error={geojsonError}
                onKindChange={setKind}
                onGeojsonChange={setGeojsonText}
                onCorridorWidthChange={setCorridorWidthM}
                onCompute={handleComputeMetrics}
                municipality={intervention.municipality}
                title={intervention.name}
              />
              <SourcesPanel sources={sources} isUploading={isUploading} onUpload={handleUpload} />
            </aside>

            <section className="col-span-12 xl:col-span-6 min-h-0 pr-1">
              <LivingRecordPanel
                artifacts={artifacts}
                assumptions={assumptions}
                recordStatus={recordStatus}
                confidenceLabel={confidenceLabel}
                lastUpdatedLabel={lastUpdatedLabel}
              />
            </section>

            <aside className="col-span-12 xl:col-span-3 space-y-6 overflow-y-auto pr-1">
              <RunsPanel
                inventoryStatus={inventoryStatus}
                composeStatus={composeStatus}
                inventoryError={inventoryError}
                composeError={composeError}
                logs={logs}
                preflightItems={preflightItems}
                primaryLabel={primaryLabel}
                secondaryLabel={secondaryLabel}
                onPrimaryAction={handlePrimaryAction}
                onSecondaryAction={handleRunInventory}
              />
              <ScopeAccessPanel
                scopeId={intervention.scopeId}
                members={members}
                currentUserId={user?.id ?? null}
                onRoleChange={handleRoleChange}
                onRemove={handleRemoveMember}
                onCopyInvite={handleCopyInvite}
                isLoading={membersLoading}
              />
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlannerPackDetail;
