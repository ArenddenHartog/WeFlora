import type { DraftMatrix, DraftMatrixColumn, EvidenceRef } from '../types.ts';

export type DecisionEvidence = EvidenceRef;

const formatCellValue = (value: DraftMatrix['rows'][number]['cells'][number]['value']): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
};

export const toCitationsPayload = (
  evidence: EvidenceRef[],
  ctx: { selectedDocs?: Array<Record<string, unknown>> } = {}
): { sourceIds: string[]; items?: Array<Record<string, unknown>> } => {
  const sourceIds = Array.from(new Set((evidence ?? []).map((entry) => entry.sourceId).filter(Boolean)));
  const items = ctx.selectedDocs?.length ? ctx.selectedDocs : undefined;
  return {
    sourceIds,
    items
  };
};

export type WorksheetDraftColumnSpec = {
  id: string;
  label: string;
  skillId?: string;
  skillArgs?: Record<string, unknown>;
  skillMetadata?: DraftMatrixColumn['skillMetadata'];
};

const orderVisibleColumns = (columns: DraftMatrixColumn[]) => {
  const visible = columns.filter((column) => column.visible !== false);
  const pinned = visible.filter((column) => column.pinned);
  const unpinned = visible.filter((column) => !column.pinned);
  return [...pinned, ...unpinned];
};

export const buildWorksheetColumnSpecsFromDraftMatrix = (matrix: DraftMatrix): WorksheetDraftColumnSpec[] =>
  orderVisibleColumns(matrix.columns).map((column) => ({
    id: column.id,
    label: column.label,
    skillId: column.skillMetadata?.skillId ?? column.skillId,
    skillArgs: column.skillArgs,
    skillMetadata: column.skillMetadata
  }));

export const buildWorksheetTableFromDraftMatrix = (
  matrix: DraftMatrix,
  options: { rowIds?: string[]; includeCitations?: boolean } = {}
): { columns: string[]; rows: string[][] } => {
  const orderedColumns = orderVisibleColumns(matrix.columns);
  const selectedRows = options.rowIds?.length
    ? matrix.rows.filter((row) => options.rowIds?.includes(row.id))
    : matrix.rows;

  const columns = orderedColumns.map((column) => column.label);
  const includeCitations = Boolean(options.includeCitations);
  if (includeCitations) {
    columns.push('Citations');
  }

  const rows = selectedRows.map((row) => {
    const values = orderedColumns.map((column) => {
      const cell = row.cells.find((entry) => entry.columnId === column.id);
      return formatCellValue(cell?.value ?? null);
    });

    if (includeCitations) {
      const evidence = row.cells.flatMap((cell) => cell.evidence ?? []);
      const payload = toCitationsPayload(evidence);
      values.push(payload.sourceIds.join('; '));
    }

    return values;
  });

  return { columns, rows };
};
