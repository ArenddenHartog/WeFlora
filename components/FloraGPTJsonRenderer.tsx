import React from 'react';
import type { FloraGPTResponseEnvelope, FloraGPTTable } from '../types';
import { InfoIcon } from './icons';
import { useUI } from '../contexts/UIContext';

export const FloraGPTJsonRenderer = ({ payload }: { payload: FloraGPTResponseEnvelope }) => {
  const { setCitationsFilter } = useUI();

  const sourcesUsed = Array.isArray(payload.meta?.sources_used)
    ? payload.meta.sources_used.map((entry) => entry.source_id).filter(Boolean)
    : [];

  const renderTable = (table: FloraGPTTable, idx: number) => {
    const hasCitations = sourcesUsed.length > 0;
    return (
      <div key={idx} className="overflow-x-auto border border-slate-200 rounded-lg my-2 bg-white shadow-sm">
        {table.title && (
          <div className="px-3 py-2 text-xs font-semibold text-slate-600 border-b border-slate-200">
            {table.title}
          </div>
        )}
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-700">
            <tr>
              {table.columns.map((h, i) => (
                <th key={i} className="p-2 whitespace-nowrap border-r border-slate-200 last:border-0 bg-slate-100">
                  {h}
                </th>
              ))}
              {hasCitations && (
                <th className="p-2 whitespace-nowrap border-r border-slate-200 last:border-0 bg-slate-100">Citations</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {table.rows.map((row, rI) => {
              return (
                <tr key={rI} className="hover:bg-slate-50 transition-colors">
                  {row.map((cell, cI) => (
                    <td key={cI} className="p-2 border-r border-slate-100 last:border-0 align-top text-slate-600">
                      {cell}
                    </td>
                  ))}
                  {hasCitations && (
                    <td className="p-2 border-r border-slate-100 last:border-0 align-top text-slate-600">
                      <button
                        type="button"
                        className="inline-flex items-center justify-center w-6 h-6 rounded-full border border-slate-200 text-slate-500 hover:text-weflora-teal hover:border-weflora-teal/40 hover:bg-weflora-mint/10"
                        title="View citations"
                        onClick={() => setCitationsFilter({ sourceIds: sourcesUsed })}
                      >
                        <InfoIcon className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  if (payload.responseType === 'clarifying_questions') {
    const questions = payload.data.questions as string[] | undefined;
    return (
      <div className="text-sm text-slate-700 space-y-2">
        <p className="font-semibold text-slate-800">Clarifying questions</p>
        <ul className="list-disc list-inside space-y-1">
          {(questions || []).map((q, idx) => (
            <li key={idx}>{q}</li>
          ))}
        </ul>
      </div>
    );
  }

  if (payload.mode === 'general_research') {
    const reasoning = payload.data.reasoning_summary || {};
    const followUps = payload.data.follow_ups as {
      deepen?: string;
      refine?: string;
      next_step?: string;
    } | undefined;
    const hasFollowUps = Boolean(followUps?.deepen && followUps?.refine && followUps?.next_step);
    if (!hasFollowUps) {
      return (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          Missing required follow-ups (deepen/refine/next_step). Regeneration required.
        </div>
      );
    }
    return (
      <div className="text-sm text-slate-700 space-y-3">
        {payload.data.output_label && (
          <div className="text-[10px] uppercase tracking-wider font-bold text-weflora-teal">
            {payload.data.output_label}
          </div>
        )}
        <p>{payload.data.summary}</p>
        {Array.isArray(payload.data.highlights) && (
          <ul className="list-disc list-inside space-y-1">
            {payload.data.highlights.map((item: string, idx: number) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        )}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
          <p className="text-xs font-semibold text-slate-700 mb-2">Reasoning summary</p>
          <div className="space-y-2">
            <div>
              <p className="text-[11px] font-semibold text-slate-600 uppercase">Approach</p>
              {Array.isArray(reasoning.approach) && reasoning.approach.length > 0 ? (
                <ul className="list-disc list-inside text-xs text-slate-600">
                  {reasoning.approach.map((item: string, idx: number) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-500">None stated.</p>
              )}
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-600 uppercase">Assumptions</p>
              {Array.isArray(reasoning.assumptions) && reasoning.assumptions.length > 0 ? (
                <ul className="list-disc list-inside text-xs text-slate-600">
                  {reasoning.assumptions.map((item: string, idx: number) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-500">None stated.</p>
              )}
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-600 uppercase">Risks</p>
              {Array.isArray(reasoning.risks) && reasoning.risks.length > 0 ? (
                <ul className="list-disc list-inside text-xs text-slate-600">
                  {reasoning.risks.map((item: string, idx: number) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-500">None stated.</p>
              )}
            </div>
          </div>
        </div>
        {payload.tables?.map(renderTable)}
        <div className="pt-2">
          <p className="font-semibold text-slate-800">Follow-ups</p>
          <ol className="list-decimal list-inside space-y-1">
            <li><span className="font-semibold">Deepen:</span> {followUps?.deepen}</li>
            <li><span className="font-semibold">Refine:</span> {followUps?.refine}</li>
            <li><span className="font-semibold">Next step:</span> {followUps?.next_step}</li>
          </ol>
        </div>
      </div>
    );
  }

  if (payload.mode === 'suitability_scoring') {
    return (
      <div className="text-sm text-slate-700 space-y-3">
        <div className="space-y-2">
          {(payload.data.results || []).map((result: any, idx: number) => (
            <div key={idx} className="border border-slate-200 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-800">{result.name}</span>
                <span className="text-xs font-bold text-weflora-teal">{result.score}/100</span>
              </div>
              {result.riskFlags?.length > 0 && (
                <div className="text-xs text-slate-500 mt-1">Risks: {result.riskFlags.join(', ')}</div>
              )}
              <p className="text-xs text-slate-600 mt-2">{result.rationale}</p>
            </div>
          ))}
        </div>
        {payload.tables?.map(renderTable)}
      </div>
    );
  }

  if (payload.mode === 'spec_writer') {
    return (
      <div className="text-sm text-slate-700 space-y-3">
        <p className="font-semibold text-slate-800">{payload.data.specTitle}</p>
        <div className="space-y-1">
          {(payload.data.specFields || []).map((field: any, idx: number) => (
            <div key={idx} className="flex gap-2">
              <span className="font-semibold text-slate-600">{field.label}:</span>
              <span>{field.value}</span>
            </div>
          ))}
        </div>
        {Array.isArray(payload.data.assumptions) && payload.data.assumptions.length > 0 && (
          <div>
            <p className="font-semibold text-slate-700">Assumptions</p>
            <ul className="list-disc list-inside text-xs text-slate-600">
              {payload.data.assumptions.map((item: string, idx: number) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  if (payload.mode === 'policy_compliance') {
    return (
      <div className="text-sm text-slate-700 space-y-3">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-800">Status:</span>
          <span className="text-xs font-bold text-weflora-teal">{payload.data.status}</span>
        </div>
        {payload.data.message && <p>{payload.data.message}</p>}
        {payload.data.issues?.length > 0 && (
          <ul className="list-disc list-inside space-y-1 text-xs text-slate-600">
            {payload.data.issues.map((issue: any, idx: number) => (
              <li key={idx}>{issue.issue}</li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return <div className="text-sm text-slate-700">{payload.data.summary || payload.data.message}</div>;
};
