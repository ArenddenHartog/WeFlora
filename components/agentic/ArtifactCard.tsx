import React from 'react';
import type { ArtifactRecord } from '../../src/agentic/contracts/zod.ts';

interface ArtifactCardProps {
  artifact: ArtifactRecord;
}

const ArtifactCard: React.FC<ArtifactCardProps> = ({ artifact }) => {
  const createdAt = new Date(artifact.created_at).toLocaleString();

  const exportContent = (format: 'json' | 'markdown' | 'html') => {
    const body = artifact.content.body;
    if (format === 'json') {
      return typeof body === 'string' ? body : JSON.stringify(body ?? {}, null, 2);
    }
    if (typeof body === 'string') return body;
    return JSON.stringify(body ?? {}, null, 2);
  };

  const handleExport = (format: 'json' | 'markdown' | 'html') => {
    const content = exportContent(format);
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${artifact.type}-v${artifact.version}.${format === 'markdown' ? 'md' : format}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-800">{artifact.title ?? artifact.type}</p>
          <p className="text-xs text-slate-500">v{artifact.version} · {artifact.status}</p>
        </div>
        <span className="text-[11px] text-slate-400">{createdAt}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-slate-600">{artifact.content.format}</span>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-slate-600">{artifact.derived_from_steps.length} steps</span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <button
          onClick={() => handleExport('json')}
          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-slate-600 hover:border-weflora-teal"
        >
          Export JSON
        </button>
        <button
          onClick={() => handleExport('markdown')}
          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-slate-600 hover:border-weflora-teal"
        >
          Export MD
        </button>
        <button
          onClick={() => handleExport('html')}
          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-slate-600 hover:border-weflora-teal"
        >
          Export HTML
        </button>
      </div>
    </div>
  );
};

export default ArtifactCard;
