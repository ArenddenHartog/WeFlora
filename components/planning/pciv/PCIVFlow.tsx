import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PcivContextIntakeRun, PcivDraft, PcivMetrics, PcivSource } from '../../../src/decision-program/pciv/v0/types';
import {
  applyPcivAutoMapping,
  buildPcivFields,
  ensureDefaultInferences,
  setPcivFieldValue,
  updateLocationHintField
} from '../../../src/decision-program/pciv/v0/map';
import { computePcivMetrics } from '../../../src/decision-program/pciv/v0/metrics';
import {
  commitRun,
  createDraftRun,
  linkInputSources,
  updateDraftRun,
  upsertConstraints,
  upsertInputs,
  upsertSources
} from '../../../src/decision-program/pciv/v1/storage/supabase';
import type {
  PcivConstraintV1,
  PcivInputSourceV1,
  PcivInputV1,
  PcivRunV1,
  PcivSourceV1
} from '../../../src/decision-program/pciv/v1/schemas';
import ImportStage from './ImportStage';
import MapStage from './MapStage';
import ValidateStage from './ValidateStage';

export interface PCIVFlowProps {
  projectId: string;
  userId?: string | null;
  initialStage?: 'import' | 'map' | 'validate';
  onComplete: (run: PcivRunV1) => void;
  onCancel?: () => void;
}

const STAGES: Array<{ id: 'import' | 'map' | 'validate'; label: string }> = [
  { id: 'import', label: 'Import' },
  { id: 'map', label: 'Map' },
  { id: 'validate', label: 'Validate & Commit' }
];

const now = () => new Date().toISOString();

const ensureMappedId = (map: Map<string, string>, key: string) => {
  const existing = map.get(key);
  if (existing) return existing;
  const created = crypto.randomUUID();
  map.set(key, created);
  return created;
};

const mapUpdatedBy = (provenance: PcivDraft['fields'][string]['provenance']): PcivInputV1['updatedBy'] => {
  if (provenance === 'user-entered') return 'user';
  if (provenance === 'model-inferred') return 'model';
  return 'system';
};

const mapInputValueKind = (fieldType: PcivDraft['fields'][string]['type']): PcivInputV1['valueKind'] => {
  if (fieldType === 'boolean') return 'boolean';
  if (fieldType === 'select') return 'enum';
  return 'string';
};

const buildInputValueFields = (
  valueKind: PcivInputV1['valueKind'],
  value: PcivDraft['fields'][string]['value'],
  provenance: PcivDraft['fields'][string]['provenance']
) => {
  if (provenance === 'unknown' || value === null || value === undefined || value === '') {
    return {
      valueKind,
      valueString: null,
      valueNumber: null,
      valueBoolean: null,
      valueEnum: null,
      valueJson: null
    };
  }
  if (valueKind === 'boolean') {
    return {
      valueKind,
      valueString: null,
      valueNumber: null,
      valueBoolean: value === true,
      valueEnum: null,
      valueJson: null
    };
  }
  if (valueKind === 'enum') {
    return {
      valueKind,
      valueString: null,
      valueNumber: null,
      valueBoolean: null,
      valueEnum: String(value),
      valueJson: null
    };
  }
  return {
    valueKind,
    valueString: String(value),
    valueNumber: null,
    valueBoolean: null,
    valueEnum: null,
    valueJson: null
  };
};

const mapConstraintValueFields = (value: PcivDraft['constraints'][number]['value']) => {
  if (value === null || value === undefined || value === '') {
    return {
      valueKind: 'string' as const,
      valueString: null,
      valueNumber: null,
      valueBoolean: null,
      valueEnum: null,
      valueJson: null
    };
  }
  if (typeof value === 'number') {
    return {
      valueKind: 'number' as const,
      valueString: null,
      valueNumber: value,
      valueBoolean: null,
      valueEnum: null,
      valueJson: null
    };
  }
  if (typeof value === 'boolean') {
    return {
      valueKind: 'boolean' as const,
      valueString: null,
      valueNumber: null,
      valueBoolean: value,
      valueEnum: null,
      valueJson: null
    };
  }
  if (typeof value === 'object') {
    return {
      valueKind: 'json' as const,
      valueString: null,
      valueNumber: null,
      valueBoolean: null,
      valueEnum: null,
      valueJson: value
    };
  }
  return {
    valueKind: 'string' as const,
    valueString: String(value),
    valueNumber: null,
    valueBoolean: null,
    valueEnum: null,
    valueJson: null
  };
};

const mapSourceKind = (source: PcivSource): PcivSourceV1['kind'] =>
  source.type === 'file' ? 'file' : 'manual';

const PCIVFlow: React.FC<PCIVFlowProps> = ({ projectId, userId, initialStage, onComplete, onCancel }) => {
  const [stage, setStage] = useState<'import' | 'map' | 'validate'>(initialStage ?? 'import');
  const [run, setRun] = useState<PcivContextIntakeRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitError, setCommitError] = useState<{ title: string; message: string } | null>(null);
  const runIdRef = useRef<string | null>(null);
  const sourceIdMapRef = useRef<Map<string, string>>(new Map());
  const inputIdMapRef = useRef<Map<string, string>>(new Map());
  const constraintIdMapRef = useRef<Map<string, string>>(new Map());

  const buildDefaultDraft = useCallback(
    (runId: string): PcivDraft => ({
      projectId,
      runId,
      userId: userId ?? null,
      locationHint: '',
      sources: [],
      fields: buildPcivFields(),
      constraints: [],
      errors: []
    }),
    [projectId, userId]
  );

  const persistDraft = useCallback(async (draftToPersist: PcivDraft) => {
    const runId = runIdRef.current;
    if (!runId) return;

    const sourceIdMap = sourceIdMapRef.current;
    const inputIdMap = inputIdMapRef.current;
    const constraintIdMap = constraintIdMapRef.current;
    const timestamp = now();

    const sources: PcivSourceV1[] = draftToPersist.sources.map((source) => {
      const sourceId = ensureMappedId(sourceIdMap, source.id);
      return {
        id: sourceId,
        runId,
        kind: mapSourceKind(source),
        title: source.name,
        uri: source.id || source.name,
        fileId: null,
        mimeType: source.mimeType ?? null,
        sizeBytes: source.size ?? null,
        parseStatus: source.status,
        excerpt: source.content ?? null,
        rawMeta: source.error ? { error: source.error } : {},
        createdAt: source.createdAt
      };
    });

    const inputs: PcivInputV1[] = Object.values(draftToPersist.fields).map((field) => {
      const inputId = ensureMappedId(inputIdMap, field.pointer);
      const valueKind = mapInputValueKind(field.type);
      const valueFields = buildInputValueFields(valueKind, field.value, field.provenance);
      return {
        id: inputId,
        runId,
        pointer: field.pointer,
        label: field.label,
        domain: field.group,
        required: field.required,
        fieldType: field.type,
        options: field.options ?? null,
        provenance: field.provenance,
        updatedBy: mapUpdatedBy(field.provenance),
        updatedAt: timestamp,
        evidenceSnippet: field.snippet ?? null,
        sourceIds: field.sourceId ? [ensureMappedId(sourceIdMap, field.sourceId)] : [],
        ...valueFields
      };
    });

    const constraints: PcivConstraintV1[] = draftToPersist.constraints.map((constraint) => {
      const constraintId = ensureMappedId(constraintIdMap, constraint.id ?? constraint.key);
      const valueFields = mapConstraintValueFields(constraint.value);
      return {
        id: constraintId,
        runId,
        key: constraint.key,
        domain: constraint.domain,
        label: constraint.label,
        provenance: constraint.provenance,
        sourceId: constraint.sourceId ? ensureMappedId(sourceIdMap, constraint.sourceId) : null,
        snippet: constraint.snippet ?? null,
        createdAt: timestamp,
        ...valueFields
      };
    });

    const inputSources: PcivInputSourceV1[] = Object.values(draftToPersist.fields)
      .filter((field) => Boolean(field.sourceId))
      .map((field) => ({
        inputId: ensureMappedId(inputIdMap, field.pointer),
        sourceId: ensureMappedId(sourceIdMap, field.sourceId as string)
      }));

    await upsertSources(runId, sources);
    await upsertInputs(runId, inputs);
    await upsertConstraints(runId, constraints);
    await linkInputSources(runId, inputSources);
    await updateDraftRun(runId);
  }, []);

  useEffect(() => {
    let isCancelled = false;
    sourceIdMapRef.current = new Map();
    inputIdMapRef.current = new Map();
    constraintIdMapRef.current = new Map();
    setError(null);
    createDraftRun(projectId, userId ?? null)
      .then((createdRun) => {
        if (isCancelled) return;
        runIdRef.current = createdRun.id;
        const draft = buildDefaultDraft(createdRun.id);
        setRun({
          id: createdRun.id,
          projectId,
          userId: userId ?? null,
          runId: createdRun.id,
          status: 'draft',
          draft,
          commit: null,
          metrics: computePcivMetrics(draft),
          createdAt: createdRun.createdAt,
          updatedAt: createdRun.updatedAt
        });
      })
      .catch((err) => {
        if (isCancelled) return;
        setRun(null);
        setError(err?.message || 'Failed to initialize context intake');
      });
    return () => {
      isCancelled = true;
    };
  }, [buildDefaultDraft, projectId, userId]);

  useEffect(() => {
    if (initialStage) {
      setStage(initialStage);
    }
  }, [initialStage]);

  const draft = run?.draft;
  const metrics = run?.metrics;

  const updateDraft = useCallback((updater: PcivDraft | ((draft: PcivDraft) => PcivDraft)) => {
    setRun((prev) => {
      if (!prev) return prev;
      const nextDraft = typeof updater === 'function' ? updater(prev.draft) : updater;
      const metricsSnapshot = computePcivMetrics(nextDraft);
      void persistDraft(nextDraft);
      return {
        ...prev,
        status: 'draft',
        draft: nextDraft,
        metrics: metricsSnapshot,
        updatedAt: now()
      };
    });
  }, [persistDraft]);

  const handleLocationHintChange = (value: string) => {
    if (!draft || !run) return;
    const updated = ensureDefaultInferences(updateLocationHintField(draft, value));
    updateDraft(updated);
  };

  const handleUpdateField = (pointer: string, value: PcivDraft['fields'][string]['value']) => {
    if (!draft) return;
    const updated = setPcivFieldValue(draft, pointer, value);
    updateDraft(updated);
  };

  const handleNext = () => {
    if (!draft) return;
    if (stage === 'import') {
      const updated = ensureDefaultInferences(applyPcivAutoMapping(draft));
      updateDraft(updated);
      setStage('map');
      return;
    }
    if (stage === 'map') {
      setStage('validate');
    }
  };

  const handleCommit = useCallback(async (allowPartial: boolean) => {
    if (!run) return;
    const runId = runIdRef.current;
    if (!runId) return;

    setIsCommitting(true);
    setCommitError(null); // Clear previous errors

    try {
      await persistDraft(run.draft);
      const committedRun = await commitRun(runId, allowPartial);
      setRun((prev) =>
        prev
          ? {
              ...prev,
              status: committedRun.status,
              updatedAt: committedRun.updatedAt
            }
          : prev
      );
      onComplete(committedRun);
    } catch (error) {
      // Commit failed via thrown error
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'An unexpected error occurred';
      
      setCommitError({
        title: allowPartial 
          ? "Couldn't proceed with partial context"
          : "Couldn't commit context",
        message: errorMessage
      });
    } finally {
      setIsCommitting(false);
    }
  }, [onComplete, persistDraft, run]);

  const handleRetryCommit = () => {
    // Determine if we should retry with partial based on current error context
    // For now, retry with the same allowPartial as the last attempt
    // We'll need to track this if needed, or just default to false
    handleCommit(false);
  };

  const handleCancelCommit = () => {
    setCommitError(null);
    setStage('validate'); // Go back to validation stage
  };

  const headerMetrics = useMemo(() => metrics ?? ({
    sources_count: 0,
    sources_ready_count: 0,
    fields_total: 0,
    fields_filled_count: 0,
    required_unresolved_count: 0,
    constraints_count: 0,
    confidence_overall: 0
  } satisfies PcivMetrics), [metrics]);

  const stageLabel = STAGES.find((entry) => entry.id === stage)?.label ?? 'Import';

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center bg-slate-50 py-20" data-layout-root>
        <div className="max-w-md text-center space-y-4">
          <div className="text-red-600 font-semibold text-lg">Couldn't load context intake</div>
          <div className="text-sm text-slate-600">{error}</div>
          <div className="flex gap-2 justify-center">
            <button
              type="button"
              onClick={() => {
                setError(null);
                setRun(null);
                // Trigger re-initialization via useEffect dependency
                setStage(initialStage ?? 'import');
              }}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-weflora-teal text-white hover:bg-weflora-dark"
            >
              Retry
            </button>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 text-sm font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (!draft || !run) {
    return (
      <div className="flex items-center justify-center text-sm text-slate-500 bg-slate-50 py-20" data-layout-root>
        Loading context intake...
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-slate-50" data-layout-root>
      {/* Commit Error Modal */}
      {commitError && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-start mb-4">
              <div className="flex-shrink-0">
                <svg 
                  className="h-6 w-6 text-red-600" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
                  />
                </svg>
              </div>
              <div className="ml-3 flex-1">
                <h3 className="text-lg font-semibold text-gray-900">
                  {commitError.title}
                </h3>
                <p className="mt-2 text-sm text-gray-600">
                  {commitError.message}
                </p>
              </div>
            </div>
            
            <div className="flex gap-3 justify-end mt-6">
              <button
                type="button"
                onClick={handleCancelCommit}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRetryCommit}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="border-b border-slate-200 bg-white px-6 py-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide">Context intake</p>
            <h1 className="text-lg font-semibold text-slate-800">PCIV v1 · Context Intake</h1>
          </div>
          <div className="flex items-center gap-2">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                Back to planning
              </button>
            )}
            {stage !== 'validate' && (
              <button
                type="button"
                onClick={handleNext}
                className="text-xs font-semibold px-4 py-2 rounded-lg bg-weflora-teal text-white hover:bg-weflora-dark"
              >
                Next
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            {STAGES.map((entry) => (
              <span
                key={entry.id}
                className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${
                  entry.id === stage
                    ? 'bg-weflora-mint/40 border-weflora-teal text-weflora-dark'
                    : 'border-slate-200 text-slate-400'
                }`}
              >
                {entry.label}
              </span>
            ))}
          </div>
          <span className="text-slate-400">•</span>
          <span className="font-semibold text-slate-600" data-testid="pciv-stage">
            Stage: {stageLabel}
          </span>
          <span className="text-slate-400">•</span>
          <span>Sources: {headerMetrics.sources_count}</span>
          <span>Fields: {headerMetrics.fields_filled_count}/{headerMetrics.fields_total}</span>
          <span>Unresolved required: {headerMetrics.required_unresolved_count}</span>
          <span>Constraints: {headerMetrics.constraints_count}</span>
        </div>
      </div>

      <div className="px-6 py-8">
        <div className="max-w-5xl mx-auto space-y-8">
          {stage === 'import' && (
            <ImportStage
              draft={draft}
              metrics={headerMetrics}
              onUpdateDraft={updateDraft}
              onLocationHintChange={handleLocationHintChange}
            />
          )}
          {stage === 'map' && (
            <MapStage
              draft={draft}
              onUpdateField={handleUpdateField}
            />
          )}
          {stage === 'validate' && (
            <ValidateStage
              draft={draft}
              metrics={headerMetrics}
              onCommit={handleCommit}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default PCIVFlow;
