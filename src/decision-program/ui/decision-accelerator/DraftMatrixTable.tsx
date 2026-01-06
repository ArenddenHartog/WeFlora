import React from 'react';
import type { DraftMatrix, DraftMatrixColumn, DraftMatrixRow, EvidenceRef } from '../../types';

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
  selectedRowIds,
  onToggleRowSelected,
  onPromoteToWorksheet,
  density = 'comfortable',
  showColumnWhy = true,
  showCellRationale = false,
  showConfidence = false,
  className
}) => {
  const visibleColumns = matrix.columns.filter((column) => column.visible !== false);
  const rowPadding = density === 'compact' ? 'py-2' : 'py-3';

  return (
    <section className={`space-y-3 ${className ?? ''}`}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">{matrix.title ?? 'Draft Matrix'}</h3>
          <p className="text-xs text-slate-500">{matrix.rows.length} candidates · {visibleColumns.length} columns</p>
        </div>
        {onPromoteToWorksheet && (
          <button
            onClick={() => onPromoteToWorksheet({ matrixId: matrix.id, rowIds: selectedRowIds })}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            Promote to Worksheet
          </button>
        )}
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
                    {onToggleColumnPinned && (
                      <button
                        onClick={() => onToggleColumnPinned(column.id)}
                        className="text-[10px] text-slate-400"
                      >
                        {column.pinned ? 'Pinned' : 'Pin'}
                      </button>
                    )}
                    {onToggleColumnVisible && (
                      <button
                        onClick={() => onToggleColumnVisible(column.id)}
                        className="text-[10px] text-slate-400"
                      >
                        Hide
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
                    return (
                      <td key={`${row.id}-${column.id}`} className={`px-3 ${rowPadding}`}>
                        <div className="flex items-center gap-2">
                          <span>{cell?.value ?? '—'}</span>
                          {cell?.evidence && cell.evidence.length > 0 && onOpenCitations && (
                            <button
                              onClick={() => onOpenCitations({ rowId: row.id, columnId: column.id, evidence: cell.evidence })}
                              className="text-[10px] text-weflora-teal"
                            >
                              Cite
                            </button>
                          )}
                        </div>
                        {showCellRationale && cell?.rationale && (
                          <p className="text-[10px] text-slate-400 mt-1">{cell.rationale}</p>
                        )}
                        {showConfidence && cell?.confidence !== undefined && (
                          <p className="text-[10px] text-slate-400">Confidence: {Math.round(cell.confidence * 100)}%</p>
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
