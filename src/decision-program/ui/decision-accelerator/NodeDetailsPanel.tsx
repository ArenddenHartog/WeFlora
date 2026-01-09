import React from 'react';
import type { EvidenceNode } from '../../types';

export interface NodeDetailsPanelProps {
  node: EvidenceNode;
  linkedNodes: EvidenceNode[];
  onJumpToTimelineEntry?: (entryId: string) => void;
  conflictingSources?: string[];
}

const formatConfidence = (value?: number) => (typeof value === 'number' ? `${Math.round(value * 100)}%` : '—');

const NodeDetailsPanel: React.FC<NodeDetailsPanelProps> = ({ node, linkedNodes, onJumpToTimelineEntry, conflictingSources }) => {
  const breakdown = node.confidenceBreakdown;
  const citations = Array.isArray(node.metadata?.citations) ? node.metadata?.citations : [];
  return (
    <div className="absolute top-0 right-0 h-full w-80 border-l border-slate-200 bg-white px-4 py-5 overflow-y-auto">
      <div className="space-y-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Node</p>
          <h3 className="text-sm font-semibold text-slate-800">{node.label}</h3>
          <div className="mt-1 flex items-center gap-2">
            <span className="inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full bg-weflora-mint/40 text-weflora-teal">
              {node.type}
            </span>
            <span className="text-[11px] text-slate-500">Confidence {formatConfidence(node.confidence)}</span>
          </div>
        </div>

        {node.description && <p className="text-xs text-slate-600">{node.description}</p>}

        {conflictingSources && conflictingSources.length > 0 && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Conflicts with {conflictingSources.length} sources
            <ul className="mt-1 space-y-1">
              {conflictingSources.map((source) => (
                <li key={source}>{source}</li>
              ))}
            </ul>
          </div>
        )}

        {breakdown && (
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">Confidence breakdown</p>
            <p className="text-xs text-slate-600">{breakdown.formula}</p>
            {breakdown.inputs.length > 0 && (
              <ul className="text-xs text-slate-600 space-y-1">
                {breakdown.inputs.map((input) => (
                  <li key={input.id} className="flex justify-between gap-2">
                    <span className="truncate">{input.label}</span>
                    <span className="text-slate-500">{input.value.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            )}
            {breakdown.penalties && breakdown.penalties.length > 0 && (
              <ul className="text-xs text-slate-600 space-y-1">
                {breakdown.penalties.map((penalty) => (
                  <li key={penalty.label} className="flex justify-between gap-2">
                    <span className="truncate">{penalty.label}</span>
                    <span className="text-slate-500">{penalty.value.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            )}
            {breakdown.notes && breakdown.notes.length > 0 && (
              <ul className="text-xs text-slate-500 space-y-1">
                {breakdown.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {node.metadata && (
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">Metadata</p>
            <ul className="text-xs text-slate-600 space-y-1">
              {Object.entries(node.metadata)
                .filter(([key]) => key !== 'citations')
                .map(([key, value]) => (
                  <li key={key} className="flex justify-between gap-2">
                    <span className="text-slate-500">{key}</span>
                    <span className="text-slate-700">{String(value)}</span>
                  </li>
                ))}
            </ul>
          </div>
        )}

        {citations.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">Citations</p>
            <ul className="text-xs text-slate-600 space-y-1">
              {citations.map((citation: { sourceId: string; locator?: { page?: number } }) => (
                <li key={`${citation.sourceId}-${citation.locator?.page ?? ''}`}>
                  {citation.sourceId}
                  {citation.locator?.page ? ` · p. ${citation.locator.page}` : ''}
                </li>
              ))}
            </ul>
          </div>
        )}

        {linkedNodes.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">Linked items</p>
            <ul className="text-xs text-slate-600 space-y-1">
              {linkedNodes.slice(0, 6).map((linked) => (
                <li key={linked.id}>{linked.label}</li>
              ))}
            </ul>
          </div>
        )}

        {node.metadata?.timelineEntryId && (
          <button
            type="button"
            onClick={() => onJumpToTimelineEntry?.(node.metadata.timelineEntryId)}
            className="text-xs font-semibold text-weflora-teal hover:text-weflora-dark"
          >
            Jump to timeline entry
          </button>
        )}
      </div>
    </div>
  );
};

export default NodeDetailsPanel;
