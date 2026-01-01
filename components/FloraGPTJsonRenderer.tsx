import React from 'react';
import type { FloraGPTResponseEnvelope } from '../types';
import { InfoIcon } from './icons';

const TableRenderer = ({
  table,
  showCitationsIcon,
  onOpenCitations
}: {
  table: { title?: string; columns: string[]; rows: string[][] };
  showCitationsIcon?: boolean;
  onOpenCitations?: () => void;
}) => (
  <div className="overflow-x-auto border border-slate-200 rounded-lg my-2 bg-white shadow-sm">
    {table.title && <div className="px-3 py-2 text-xs font-semibold text-slate-600 border-b border-slate-200">{table.title}</div>}
    <table className="w-full text-xs text-left">
      <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-700">
        <tr>
          {showCitationsIcon && <th className="p-2 w-8 text-center border-r border-slate-200 bg-slate-100">ⓘ</th>}
          {table.columns.map((h, i) => (
            <th key={i} className="p-2 whitespace-nowrap border-r border-slate-200 last:border-0 bg-slate-100">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 bg-white">
        {table.rows.map((row, rI) => (
          <tr key={rI} className="hover:bg-slate-50 transition-colors">
            {showCitationsIcon && (
              <td className="p-2 text-center border-r border-slate-100">
                <button
                  type="button"
                  onClick={onOpenCitations}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                  title="Open citations"
                >
                  <InfoIcon className="h-3.5 w-3.5" />
                </button>
              </td>
            )}
            {row.map((cell, cI) => (
              <td key={cI} className="p-2 border-r border-slate-100 last:border-0 align-top text-slate-600">{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const ReasoningSummary = ({ reasoning }: { reasoning: { approach?: string[]; assumptions?: string[]; risks?: string[] } }) => (
  <div className="border border-weflora-teal/20 bg-weflora-teal/10 rounded-lg p-3">
    <div className="text-xs font-bold text-weflora-dark mb-2">Reasoning</div>
    <div className="space-y-2 text-xs text-slate-700">
      {Array.isArray(reasoning.approach) && reasoning.approach.length > 0 && (
        <div>
          <div className="font-semibold text-slate-700 mb-1">Approach</div>
          <ul className="list-disc list-inside space-y-1">
            {reasoning.approach.slice(0, 3).map((item, idx) => <li key={idx}>{item}</li>)}
          </ul>
        </div>
      )}
      {Array.isArray(reasoning.assumptions) && reasoning.assumptions.length > 0 && (
        <div>
          <div className="font-semibold text-slate-700 mb-1">Assumptions</div>
          <ul className="list-disc list-inside space-y-1">
            {reasoning.assumptions.map((item, idx) => <li key={idx}>{item}</li>)}
          </ul>
        </div>
      )}
      {Array.isArray(reasoning.risks) && reasoning.risks.length > 0 && (
        <div>
          <div className="font-semibold text-slate-700 mb-1">Risks</div>
          <ul className="list-disc list-inside space-y-1">
            {reasoning.risks.map((item, idx) => <li key={idx}>{item}</li>)}
          </ul>
        </div>
      )}
    </div>
  </div>
);

export const FloraGPTJsonRenderer = ({ payload }: { payload: FloraGPTResponseEnvelope }) => {
  const showCitationsIcon = Array.isArray(payload.meta?.sources_used) && payload.meta?.sources_used?.length > 0;
  const onOpenCitations = () => {
    document.getElementById('citations-sidebar')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (payload.responseType === 'clarifying_questions') {
    const questions = payload.data.questions as string[] | undefined;
    const heading = questions?.[0]?.toLowerCase().includes('welke') || questions?.[0]?.toLowerCase().includes('wat')
      ? 'Verduidelijkingsvragen'
      : 'Clarifying questions';
    return (
      <div className="text-sm text-slate-700 space-y-2">
        <p className="font-semibold text-slate-800">{heading}</p>
        <ul className="list-disc list-inside space-y-1">
          {(questions || []).map((q, idx) => <li key={idx}>{q}</li>)}
        </ul>
      </div>
    );
  }

  if (payload.mode === 'general_research') {
    return (
      <div className="text-sm text-slate-700 space-y-3">
        <p>{payload.data.summary}</p>
        {Array.isArray(payload.data.highlights) && (
          <ul className="list-disc list-inside space-y-1">
            {payload.data.highlights.map((item: string, idx: number) => <li key={idx}>{item}</li>)}
          </ul>
        )}
        {payload.data.reasoning_summary && <ReasoningSummary reasoning={payload.data.reasoning_summary} />}
        {payload.tables?.map((table, idx) => (
          <TableRenderer key={idx} table={table} showCitationsIcon={showCitationsIcon} onOpenCitations={onOpenCitations} />
        ))}
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
        {payload.tables?.map((table, idx) => (
          <TableRenderer key={idx} table={table} showCitationsIcon={showCitationsIcon} onOpenCitations={onOpenCitations} />
        ))}
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
              {payload.data.assumptions.map((item: string, idx: number) => <li key={idx}>{item}</li>)}
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
