import React from 'react';
import type { DraftMatrix, DraftMatrixColumn, DraftMatrixRow, EvidenceRef } from '../../types';
import { InfoIcon } from '../../../../components/icons';
import { getBadgeClass, getSeverity } from './severity';

type _DraftMatrixColumn = DraftMatrixColumn;
type _DraftMatrixRow = DraftMatrixRow;

export type CellValue = string | number | boolean | null;

export interface DraftMatrixCell {
  columnId: string;
  value: CellValue;
  rationale?: string;
  evidence?: EvidenceRef[];
  confidence?: number;
  flags?: string[];
}

export interface DraftMatrixTableProps {
  matrix: DraftMatrix;
  onOpenCitations?: (args: { rowId: string; columnId: string; evidence?: EvidenceRef[] }) => void;
  onToggleColumnPinned?: (columnId: string) => void;
  onToggleColumnVisible?: (columnId: string) => void;
  onAddColumn?: (columnId: string) => void;
  suggestedColumns?: DraftMatrixColumn[];
  selectedRowIds?: string[];
  onToggleRowSelected?: (rowId: string) => void;
  onPromoteToWorksheet?: (payload: { matrixId: string; rowIds?: string[] }) => void;
  density?: 'comfortable' | 'compact';
  showColumnWhy?: boolean;
  showCellRationale?: boolean;
  showConfidence?: boolean;
  className?: string;
}

const DraftMatrixTable: React.FC<DraftMatrixTableProps> = ({
  matrix,
  onOpenCitations,
  onToggleColumnPinned,
  onToggleColumnVisible,
  onAddColumn,
  suggestedColumns,
  selectedRowIds,
  onToggleRowSelected,
  density = 'comfortable',
  showColumnWhy = false,
  showCellRationale = false,
  showConfidence = false,
  className
}) => {
  const visibleColumns = matrix.columns.filter((column) => column.visible !== false);
  const rowPadding = density === 'compact' ? 'py-2' : 'py-3';
  const availableColumns = (suggestedColumns ?? matrix.columns.filter((column) => column.visible === false)) ?? [];
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [expandedCells, setExpandedCells] = React.useState<Record<string, boolean>>({});
  const badgeBaseClass = 'text-[10px] font-semibold px-2 py-0.5 rounded-full';

  const parseNumeric = (value: CellValue) => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = Number.parseFloat(value);
      return Number.isNaN(parsed) ? null : parsed;
    }
    return null;
  };

  return (
    <section className={`space-y-3 ${className ?? ''}`}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">{matrix.title ?? 'Draft Matrix'}</h3>
          <p className="text-xs text-slate-500">{matrix.rows.length} candidates · {visibleColumns.length} columns</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setIsSettingsOpen((prev) => !prev)}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              Table Settings
            </button>
            {isSettingsOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-lg border border-slate-200 bg-white shadow-lg z-10">
                <div className="px-3 py-2 text-[10px] uppercase tracking-wide text-slate-400 border-b border-slate-100">
                  Columns
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {matrix.columns.map((column) => (
                    <div key={column.id} className="flex items-center justify-between px-3 py-2 text-xs text-slate-600">
                      <span className="truncate">{column.label}</span>
                      <div className="flex items-center gap-2">
                        {onToggleColumnPinned && (
                          <button
                            onClick={() => onToggleColumnPinned(column.id)}
                            className="text-[10px] text-slate-500 hover:text-slate-700"
                          >
                            {column.pinned ? 'Unpin' : 'Pin'}
                          </button>
                        )}
                        {onToggleColumnVisible && (
                          <button
                            onClick={() => onToggleColumnVisible(column.id)}
                            className="text-[10px] text-slate-500 hover:text-slate-700"
                          >
                            {column.visible === false ? 'Show' : 'Hide'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {onAddColumn && availableColumns.length > 0 && (
                  <>
                    <div className="px-3 py-2 text-[10px] uppercase tracking-wide text-slate-400 border-t border-slate-100">
                      Add column
                    </div>
                    <div className="max-h-40 overflow-y-auto">
                      {availableColumns.map((column) => (
                        <button
                          key={column.id}
                          onClick={() => {
                            onAddColumn(column.id);
                            setIsAddOpen(false);
                            setIsSettingsOpen(false);
                          }}
                          className="w-full text-left px-3 py-2 text-xs text-slate-600 hover:bg-slate-50"
                        >
                          {column.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white">
        <table className="min-w-full text-xs text-slate-700">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {onToggleRowSelected && <th className="px-3 py-2 text-left w-10"></th>}
              {visibleColumns.map((column) => (
                <th key={column.id} className="text-left px-3 py-2 font-semibold">
                  <div className="flex items-center gap-2">
                    <span>{column.label}</span>
                    {column.why && (
                      <button
                        type="button"
                        title={column.why}
                        className="text-slate-400 hover:text-slate-600"
                      >
                        <InfoIcon className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  {showColumnWhy && column.why && (
                    <p className="text-[10px] text-slate-400 mt-1">{column.why}</p>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.rows.map((row) => {
              const isSelected = selectedRowIds?.includes(row.id);
              return (
                <tr key={row.id} className={`border-b border-slate-100 ${isSelected ? 'bg-weflora-mint/10' : ''}`}>
                  {onToggleRowSelected && (
                    <td className={`px-3 ${rowPadding}`}>
                      <input
                        type="checkbox"
                        checked={Boolean(isSelected)}
                        onChange={() => onToggleRowSelected(row.id)}
                        className="rounded border-slate-300 text-weflora-teal"
                      />
                    </td>
                  )}
                  {visibleColumns.map((column) => {
                    const cell = row.cells.find((entry) => entry.columnId === column.id);
                    const numericValue = parseNumeric(cell?.value ?? null);
                    const isScore = column.kind === 'score' && numericValue !== null;
                    const isScoreColumn = column.kind === 'score';
                    const scoreSeverity = isScore ? getSeverity(numericValue) : 'unknown';
                    const confidenceSeverity =
                      cell?.confidence !== undefined ? getSeverity(cell.confidence) : 'unknown';
                    const cellKey = `${row.id}-${column.id}`;
                    const isExpanded = expandedCells[cellKey];
                    const isLongText = typeof cell?.value === 'string' && cell.value.length > 80;
                    const clampStyle =
                      !isExpanded && isLongText
                        ? {
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical' as const,
                            overflow: 'hidden'
                          }
                        : undefined;
                    return (
                      <td key={`${row.id}-${column.id}`} className={`px-3 ${rowPadding}`}>
                        <div className={`flex items-start gap-2 ${isScoreColumn ? 'rounded-md px-2 py-1 bg-slate-50' : ''}`}>
                          {isScore ? (
                            <span className={`${badgeBaseClass} ${getBadgeClass(scoreSeverity)}`}>
                              {cell?.value ?? '—'}
                            </span>
                          ) : (
                            <span className="block" style={clampStyle}>
                              {cell?.value ?? '—'}
                            </span>
                          )}
                          {cell?.evidence && cell.evidence.length > 0 && onOpenCitations && (
                            <button
                              onClick={() => onOpenCitations({ rowId: row.id, columnId: column.id, evidence: cell.evidence })}
                              className="text-[10px] text-weflora-teal"
                            >
                              Cite
                            </button>
                          )}
                        </div>
                        {isLongText && (
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedCells((prev) => ({ ...prev, [cellKey]: !prev[cellKey] }))
                            }
                            className="mt-1 text-[10px] text-weflora-teal"
                          >
                            {isExpanded ? 'Collapse' : 'Expand'}
                          </button>
                        )}
                        {showCellRationale && cell?.rationale && (
                          <p className="text-[10px] text-slate-400 mt-1">{cell.rationale}</p>
                        )}
                        {(showConfidence || cell?.confidence !== undefined) && cell?.confidence !== undefined && (
                          <div className="mt-1">
                            <span className={`${badgeBaseClass} ${getBadgeClass(confidenceSeverity)}`}>
                              Confidence {Math.round(cell.confidence * 100)}%
                            </span>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default DraftMatrixTable;
