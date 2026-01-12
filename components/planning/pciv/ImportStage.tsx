import React, { useState } from 'react';
import type { PcivDraft, PcivMetrics, PcivSource } from '../../../src/decision-program/pciv/v0/types';
import { applyPcivAutoMapping } from '../../../src/decision-program/pciv/v0/map';
import { getPcivSourceStatus, isPcivFileSupported } from '../../../src/decision-program/pciv/v0/sourceUtils';

export interface ImportStageProps {
  draft: PcivDraft;
  metrics: PcivMetrics;
  onUpdateDraft: (draft: PcivDraft | ((draft: PcivDraft) => PcivDraft)) => void;
  onLocationHintChange: (value: string) => void;
}

const statusPill = (status: PcivSource['status']) => {
  switch (status) {
    case 'parsed':
      return 'bg-emerald-50 text-emerald-700';
    case 'failed':
      return 'bg-rose-50 text-rose-700';
    case 'unsupported':
      return 'bg-slate-100 text-slate-500';
    default:
      return 'bg-amber-50 text-amber-700';
  }
};

const ImportStage: React.FC<ImportStageProps> = ({ draft, metrics, onUpdateDraft, onLocationHintChange }) => {
  const [isUploading, setIsUploading] = useState(false);

  const statusMessage = (() => {
    if (metrics.sources_count === 0 && !draft.locationHint) {
      return 'Awaiting documents or location hint';
    }
    if (metrics.sources_count === 0 && draft.locationHint) {
      return 'Location hint captured';
    }
    if (draft.sources.some((source) => source.status === 'pending')) {
      return 'Parsing sources…';
    }
    return 'Sources ready for mapping';
  })();

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    for (const file of Array.from(files)) {
      const sourceId = `pciv-${crypto.randomUUID()}`;
      const statusDecision = getPcivSourceStatus(file);
      const pendingSource: PcivSource = {
        id: sourceId,
        type: 'file',
        name: file.name,
        mimeType: file.type,
        size: file.size,
        status: statusDecision.status,
        error: statusDecision.error,
        createdAt: new Date().toISOString()
      };
      onUpdateDraft((prevDraft) => ({
        ...prevDraft,
        sources: [...prevDraft.sources, pendingSource]
      }));
      if (!isPcivFileSupported(file)) {
        continue;
      }
      try {
        const content = await file.text();
        const excerpt = content.slice(0, 20000);
        const parsedSource: PcivSource = {
          ...pendingSource,
          status: excerpt ? 'parsed' : 'failed',
          content: excerpt || undefined,
          error: excerpt ? undefined : 'No readable text found.'
        };
        onUpdateDraft((prevDraft) => {
          const updated = {
            ...prevDraft,
            sources: prevDraft.sources.map((source) => (source.id === sourceId ? parsedSource : source))
          };
          return applyPcivAutoMapping(updated);
        });
      } catch (error) {
        console.warn('pciv_v0_source_parse_failed', error);
        const failedSource: PcivSource = {
          ...pendingSource,
          status: 'failed',
          error: 'Could not read this file.'
        };
        onUpdateDraft((prevDraft) => ({
          ...prevDraft,
          sources: prevDraft.sources.map((source) => (source.id === sourceId ? failedSource : source)),
          errors: [...prevDraft.errors, 'Could not extract from sources.']
        }));
      }
    }
    setIsUploading(false);
  };

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-800">Import sources</h2>
          <p className="text-xs text-slate-500">Upload policy, site, or inventory files to extract context.</p>
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{statusMessage}</span>
      </div>

      <div className="border border-dashed border-slate-200 rounded-2xl bg-white p-6 space-y-4">
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-slate-600">Upload files</label>
          <input
            type="file"
            multiple
            onChange={(event) => handleFiles(event.target.files)}
            className="block w-full text-xs text-slate-500 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-slate-600 hover:file:bg-slate-200"
          />
          {isUploading && <p className="text-[11px] text-slate-400">Parsing sources…</p>}
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-slate-600">Location hint (optional)</label>
          <input
            value={draft.locationHint ?? ''}
            onChange={(event) => onLocationHintChange(event.target.value)}
            placeholder="e.g., 3rd Ave corridor near civic plaza"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-weflora-mint"
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">Source inventory</h3>
          <span className="text-[11px] text-slate-400">{metrics.sources_count} sources</span>
        </div>
        {draft.errors.length > 0 && (
          <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-xs text-rose-700">
            Could not extract from sources. Try uploading a different format or add details manually in the next step.
          </div>
        )}
        {draft.sources.some((source) => source.status === 'unsupported') && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
            PDF parsing is not supported yet. Upload .txt, .csv, or .json files for automatic extraction.
          </div>
        )}
        {draft.sources.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            No usable sources found yet. Add documents or provide a location hint.
          </div>
        ) : (
          <div className="space-y-2">
            {draft.sources.map((source) => (
              <div
                key={source.id}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600"
              >
                <div>
                  <p className="font-semibold text-slate-700">{source.name}</p>
                  <p className="text-[11px] text-slate-400">{source.mimeType ?? 'Unknown type'}</p>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusPill(source.status)}`}>
                  {source.status === 'parsed'
                    ? 'Parsed'
                    : source.status === 'failed'
                      ? 'Failed'
                      : source.status === 'unsupported'
                        ? 'Unsupported'
                        : 'Pending'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default ImportStage;
