import type { DraftMatrix, EvidenceRef } from '../../types';

export const toggleMatrixColumnPinned = (matrix: DraftMatrix, columnId: string): DraftMatrix => ({
  ...matrix,
  columns: matrix.columns.map((column) =>
    column.id === columnId ? { ...column, pinned: !column.pinned } : column
  )
});

export const toggleMatrixColumnVisible = (matrix: DraftMatrix, columnId: string): DraftMatrix => ({
  ...matrix,
  columns: matrix.columns.map((column) =>
    column.id === columnId ? { ...column, visible: column.visible === false ? true : false } : column
  )
});

export const showMatrixColumn = (matrix: DraftMatrix, columnId: string): DraftMatrix => ({
  ...matrix,
  columns: matrix.columns.map((column) =>
    column.id === columnId ? { ...column, visible: true, pinned: column.pinned ?? false } : column
  )
});

export const buildCellCitationsArgs = (
  rowId: string,
  columnId: string,
  evidence?: EvidenceRef[]
): { rowId: string; columnId: string; evidence?: EvidenceRef[] } => ({
  rowId,
  columnId,
  evidence
});
