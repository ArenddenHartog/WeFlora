import React from 'react';
import type { FloraGPTResponseEnvelope } from '../types';

const TableRenderer = ({ table }: { table: { title?: string; columns: string[]; rows: string[][] } }) => (
  <div className="overflow-x-auto border border-slate-200 rounded-lg my-2 bg-white shadow-sm">
    {table.title && <div className="px-3 py-2 text-xs font-semibold text-slate-600 border-b border-slate-200">{table.title}</div>}
    <table className="w-full text-xs text-left">
      <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-700">
        <tr>{table.columns.map((h, i) => <th key={i} className="p-2 whitespace-nowrap border-r border-slate-200 last:border-0 bg-slate-100">{h}</th>)}</tr>
      </thead>
      <tbody className="divide-y divide-slate-100 bg-white">
        {table.rows.map((row, rI) => (
          <tr key={rI} className="hover:bg-slate-50 transition-colors">
            {row.map((cell, cI) => <td key={cI} className="p-2 border-r border-slate-100 last:border-0 align-top text-slate-600">{cell}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export const FloraGPTJsonRenderer = ({ payload }: { payload: FloraGPTResponseEnvelope }) => {
  if (payload.responseType === 'clarifying_questions') {
    const questions = payload.data.questions as string[] | undefined;
    return (
      <div className="text-sm text-slate-700 space-y-2">
        <p className="font-semibold text-slate-800">Clarifying questions</p>
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
        {payload.tables?.map((table, idx) => <TableRenderer key={idx} table={table} />)}
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
        {payload.tables?.map((table, idx) => <TableRenderer key={idx} table={table} />)}
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
