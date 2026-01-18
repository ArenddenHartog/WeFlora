import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';
import { useUI } from '../../contexts/UIContext';
import { useAuth } from '../../contexts/AuthContext';
import type { PlannerArtifact, PlannerGeometry } from '../../src/planner-pack/v1/schemas';
import type { PcivScopeMemberV1 } from '../../src/decision-program/pciv/v1/schemas';
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
import ArtifactsPanel from './ArtifactsPanel';
import { addUploadSource } from '../../src/planner-pack/v1/storage/supabase';
import { uploadFile } from '../../services/fileService';
import ScopeAccessPanel from './ScopeAccessPanel';

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

  const [kind, setKind] = useState<'polygon' | 'corridor'>('corridor');
  const [geojsonText, setGeojsonText] = useState('');
  const [corridorWidthM, setCorridorWidthM] = useState(12);
  const [metrics, setMetrics] = useState<{ areaM2?: number | null; lengthM?: number | null }>({});
  const [geojsonError, setGeojsonError] = useState<string | null>(null);

  const fileCache = useRef<Record<string, string>>({});

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
      showNotification('Unable to load Planner Pack.', 'error');
    } finally {
      setMembersLoading(false);
      setIsLoading(false);
    }
  }, [id, loadArtifacts, showNotification]);

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
    try {
      const parsedResult = safeParseGeojson(geojsonText);
      if (!parsedResult.value) {
        setGeojsonError(parsedResult.error);
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
      setGeojsonError((error as Error).message);
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
      await runWithTimeout(
        inventoryIngest({
          supabase,
          interventionId: id,
          sourceId: source.id,
          fileText,
          geometryId: null
        })
      );
      setInventoryStatus('succeeded');
      setSources((prev) => prev.map((item) => (item.id === source.id ? { ...item, parseStatus: 'parsed' } : item)));
      await loadArtifacts(id);
    } catch (error) {
      console.error(error);
      setInventoryStatus('failed');
      setInventoryError((error as Error).message || 'Inventory ingest failed.');
    }
  };

  const handleCompose = async () => {
    if (!id || !intervention) return;
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
      await loadArtifacts(id);
    } catch (error) {
      console.error(error);
      setComposeStatus('failed');
      setComposeError((error as Error).message || 'Planner Pack generation failed.');
    }
  };

  const handleExport = (artifact: PlannerArtifact) => {
    const fileName = `${intervention?.name ?? 'planner-pack'}-${artifact.type}-v${artifact.version}.html`;
    const html = artifact.renderedHtml
      ? artifact.renderedHtml
      : `<pre>${JSON.stringify(artifact.payload, null, 2)}</pre>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  const statusLabel = intervention?.status?.replace('_', ' ') ?? 'draft';

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

  if (isLoading || !intervention) {
    return (
      <div className="p-6 text-sm text-slate-500">Loading Planner Pack…</div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="p-6 space-y-6">
        <header className="border border-slate-200 rounded-xl p-4 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-900">{intervention.name}</h1>
              <p className="text-xs text-slate-500">
                Prepared by WeFlora on behalf of {intervention.municipality ?? 'Municipality'}
              </p>
            </div>
            <div className="text-xs font-semibold text-weflora-dark bg-weflora-mint/20 px-3 py-1 rounded-full">
              Status: {statusLabel} · Confidence: High
            </div>
          </div>
        </header>

        <div className="grid grid-cols-12 gap-4">
          <aside className="col-span-12 xl:col-span-3 space-y-6">
            <GeometryStep
              kind={kind}
              geojsonText={geojsonText}
              corridorWidthM={corridorWidthM}
              metrics={metrics}
              error={geojsonError}
              onKindChange={setKind}
              onGeojsonChange={setGeojsonText}
              onCorridorWidthChange={setCorridorWidthM}
              onCompute={handleComputeMetrics}
            />
            <SourcesPanel sources={sources} isUploading={isUploading} onUpload={handleUpload} />
          </aside>

          <section className="col-span-12 xl:col-span-6">
            <ArtifactsPanel artifacts={artifacts} onExport={handleExport} />
          </section>

          <aside className="col-span-12 xl:col-span-3">
            <RunsPanel
              inventoryStatus={inventoryStatus}
              composeStatus={composeStatus}
              inventoryError={inventoryError}
              composeError={composeError}
              logs={logs}
              onRunInventory={handleRunInventory}
              onCompose={handleCompose}
            />
            <div className="mt-6">
              <ScopeAccessPanel
                scopeId={intervention.scopeId}
                members={members}
                currentUserId={user?.id ?? null}
                onRoleChange={handleRoleChange}
                onRemove={handleRemoveMember}
                onCopyInvite={handleCopyInvite}
                isLoading={membersLoading}
              />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default PlannerPackDetail;
