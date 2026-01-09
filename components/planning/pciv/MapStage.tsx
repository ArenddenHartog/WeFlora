import React, { useMemo, useState } from 'react';
import type { PcivDraft, PcivField } from '../../../src/decision-program/pciv/v0/types';

type GroupKey = PcivField['group'];

export interface MapStageProps {
  draft: PcivDraft;
  onUpdateField: (pointer: string, value: PcivField['value']) => void;
}

const GROUP_LABELS: Record<GroupKey, string> = {
  site: 'Site',
  regulatory: 'Regulatory',
  equity: 'Equity',
  biophysical: 'Biophysical'
};

const provenanceBadge = (provenance: PcivField['provenance']) => {
  switch (provenance) {
    case 'source-backed':
      return 'bg-emerald-50 text-emerald-700';
    case 'user-entered':
      return 'bg-sky-50 text-sky-700';
    case 'model-inferred':
      return 'bg-amber-50 text-amber-700';
    default:
      return 'bg-slate-100 text-slate-500';
  }
};

const MapStage: React.FC<MapStageProps> = ({ draft, onUpdateField }) => {
  const [snippet, setSnippet] = useState<{ label: string; text: string } | null>(null);

  const groupedFields = useMemo(() => {
    const groups = new Map<GroupKey, PcivField[]>();
    Object.values(draft.fields).forEach((field) => {
      const list = groups.get(field.group) ?? [];
      list.push(field);
      groups.set(field.group, list);
    });
    return groups;
  }, [draft.fields]);
  const orderedGroups: GroupKey[] = ['site', 'regulatory', 'equity', 'biophysical'];

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-slate-800">Map context fields</h2>
        <p className="text-xs text-slate-500">
          Review suggested values and supply missing inputs. Badges show provenance.
        </p>
      </div>

      <div className="space-y-6">
        {orderedGroups
          .filter((group) => groupedFields.has(group))
          .map((group) => {
            const fields = groupedFields.get(group) ?? [];
            return (
          <div key={group} className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">{GROUP_LABELS[group]}</h3>
              <span className="text-[11px] text-slate-400">{fields.length} fields</span>
            </div>
            <div className="space-y-3">
              {fields.map((field) => (
                <div
                  key={field.pointer}
                  className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-slate-700">{field.label}</p>
                      {field.required && <p className="text-[10px] text-rose-500">Required</p>}
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${provenanceBadge(field.provenance)}`}>
                      {field.provenance.replace('-', ' ')}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {field.type === 'select' && (
                      <select
                        value={field.value ?? ''}
                        onChange={(event) => onUpdateField(field.pointer, event.target.value)}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700"
                      >
                        <option value="">Select…</option>
                        {(field.options ?? []).map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    )}
                    {field.type === 'text' && (
                      <input
                        value={field.value ?? ''}
                        onChange={(event) => onUpdateField(field.pointer, event.target.value)}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700"
                        placeholder="Enter value"
                      />
                    )}
                    {field.type === 'boolean' && (
                      <select
                        value={field.value === true ? 'true' : field.value === false ? 'false' : ''}
                        onChange={(event) => {
                          const value = event.target.value;
                          onUpdateField(
                            field.pointer,
                            value === '' ? null : value === 'true'
                          );
                        }}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700"
                      >
                        <option value="">Select…</option>
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                      </select>
                    )}
                    {field.provenance === 'source-backed' && field.snippet && (
                      <button
                        type="button"
                        onClick={() => setSnippet({ label: field.label, text: field.snippet ?? '' })}
                        className="text-[11px] font-semibold text-weflora-teal hover:text-weflora-dark self-start"
                      >
                        View snippet
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
            );
          })}
      </div>

      {snippet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="max-w-lg w-full rounded-2xl bg-white p-5 space-y-3 shadow-xl">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-800">Snippet · {snippet.label}</h4>
              <button
                type="button"
                onClick={() => setSnippet(null)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-700"
              >
                Close
              </button>
            </div>
            <p className="text-xs text-slate-600 whitespace-pre-wrap">{snippet.text}</p>
          </div>
        </div>
      )}
    </section>
  );
};

export default MapStage;
