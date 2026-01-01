import type { Matrix } from '../../../types';
import type { WorksheetSelectionSnapshot } from './types';

const MAX_COLUMNS = 25;
const MAX_ROWS = 20;
const MAX_CELL_CHARS = 500;
const MAX_SNIPPET_BYTES = 40 * 1024;

const truncateCell = (value: string, maxChars: number) => {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}… [truncated]`;
};

const serializePack = (pack: unknown) => JSON.stringify(pack);

export const buildWorksheetContextPack = (args: {
  matrix: Matrix;
  selection: WorksheetSelectionSnapshot | null;
  projectId: string;
}) => {
  const { matrix, selection, projectId } = args;
  const matrixName = matrix.title || matrix.id;

  const selectedRowIds = selection?.selectedRowIds || [];
  const selectedColumnIds = selection?.selectedColumnIds || [];

  const orderedColumns = [...matrix.columns];
  const selectedColumns = orderedColumns.filter((col) => selectedColumnIds.includes(col.id));
  const remainingColumns = orderedColumns.filter((col) => !selectedColumnIds.includes(col.id));
  const cappedColumns = [...selectedColumns, ...remainingColumns].slice(0, MAX_COLUMNS);

  const orderedRows = [...matrix.rows];
  const selectedRows = selectedRowIds.length
    ? orderedRows.filter((row) => selectedRowIds.includes(row.id))
    : orderedRows;

  let rowLimit = Math.min(MAX_ROWS, selectedRows.length);
  let maxCellChars = MAX_CELL_CHARS;

  const buildSampledRows = () =>
    selectedRows.slice(0, rowLimit).map((row) => {
      const cells: Record<string, string> = {};
      cappedColumns.forEach((col) => {
        const raw = String(row.cells?.[col.id]?.value ?? '').trim();
        cells[col.title] = truncateCell(raw, maxCellChars);
      });
      return { rowId: row.id, cells };
    });

  let pack = {
    worksheetId: matrix.id,
    worksheetName: matrixName,
    selection: {
      rowIds: selectedRowIds,
      columnIds: selectedColumnIds,
      activeCell: selection?.activeCell
    },
    columns: cappedColumns.map((col) => ({ id: col.id, name: col.title })),
    sampledRows: buildSampledRows()
  };

  let snippet = serializePack(pack);
  while (snippet.length > MAX_SNIPPET_BYTES && rowLimit > 0) {
    rowLimit = Math.max(0, rowLimit - 5);
    pack = { ...pack, sampledRows: buildSampledRows() };
    snippet = serializePack(pack);
  }

  while (snippet.length > MAX_SNIPPET_BYTES && maxCellChars > 100) {
    maxCellChars = Math.max(100, maxCellChars - 50);
    pack = { ...pack, sampledRows: buildSampledRows() };
    snippet = serializePack(pack);
  }

  if (snippet.length > MAX_SNIPPET_BYTES) {
    snippet = snippet.slice(0, MAX_SNIPPET_BYTES - 20) + '… [truncated]';
  }

  return {
    sourceId: `worksheet:${matrix.id}`,
    scope: `project:${projectId}`,
    sourceType: 'worksheet' as const,
    title: `Worksheet: ${matrixName}`,
    locationHint: `worksheet:${matrix.id}`,
    snippet,
  };
  // TODO: Inject into EvidencePack as a projectHit when worksheet actions run (PR-F Step 3).
};
