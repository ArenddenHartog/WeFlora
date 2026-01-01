import type { Matrix } from '../../../types';
import type { FloraGPTResponseEnvelope } from '../types';

const MAX_CELL_CHARS = 2000;

const truncateCell = (value: string) =>
  value.length > MAX_CELL_CHARS ? `${value.slice(0, MAX_CELL_CHARS)}… [truncated]` : value;

const normalizeTitle = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '');

const slugify = (value: string) => {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return slug || 'column';
};

const buildStableColumnId = (columns: Matrix['columns'], title: string) => {
  const base = `col-flora-${slugify(title)}`;
  if (!columns.some((col) => col.id === base)) return base;
  let index = 2;
  while (columns.some((col) => col.id === `${base}-${index}`)) {
    index += 1;
  }
  return `${base}-${index}`;
};

const ensureColumn = (matrix: Matrix, title: string) => {
  const targetKey = normalizeTitle(title);
  const existing = matrix.columns.find((col) => normalizeTitle(col.title) === targetKey);
  if (existing) return existing;
  const newCol = {
    id: buildStableColumnId(matrix.columns, title),
    title,
    type: 'text' as const,
    width: 180,
    visible: true
  };
  return newCol;
};

const setCellValue = (row: any, columnId: string, value: string) => ({
  ...row,
  cells: {
    ...row.cells,
    [columnId]: { columnId, value }
  }
});

const joinList = (items?: string[]) => truncateCell((items || []).join('; '));

export const applyModeResultToWorksheet = (args: {
  matrix: Matrix;
  targetRowIds: string[];
  payload: FloraGPTResponseEnvelope;
}): Matrix => {
  const { matrix, targetRowIds, payload } = args;
  if (payload.responseType !== 'answer') return matrix;

  const columns = [...matrix.columns];
  const ensure = (title: string) => {
    const col = ensureColumn({ ...matrix, columns }, title);
    if (!columns.find((c) => c.id === col.id)) columns.push(col);
    return col;
  };

  const rows = [...matrix.rows];

  if (payload.mode === 'suitability_scoring') {
    const colScore = ensure('Suitability Score');
    const colRisk = ensure('Risk Flags');
    const colRationale = ensure('Rationale');
    const colCitations = ensure('Citations');

    const results = (payload.data as any)?.results || [];
    targetRowIds.forEach((rowId, idx) => {
      const rowIndex = rows.findIndex((r) => r.id === rowId);
      if (rowIndex === -1) return;
      const result = results[idx];
      if (!result) return;
      let row = rows[rowIndex];
      row = setCellValue(row, colScore.id, String(result.score ?? ''));
      row = setCellValue(row, colRisk.id, joinList(result.riskFlags));
      row = setCellValue(row, colRationale.id, truncateCell(result.rationale ?? ''));
      row = setCellValue(row, colCitations.id, joinList(result.citations));
      rows[rowIndex] = row;
    });
  }

  if (payload.mode === 'spec_writer') {
    const colTitle = ensure('Spec Title');
    const colFields = ensure('Spec Fields');
    const colAssumptions = ensure('Assumptions');
    const colCitations = ensure('Citations');

    const specFields = (payload.data as any)?.specFields || [];
    const fieldsValue = specFields
      .map((field: any) => `${field.label}: ${field.value}`)
      .join('; ');

    targetRowIds.forEach((rowId) => {
      const rowIndex = rows.findIndex((r) => r.id === rowId);
      if (rowIndex === -1) return;
      let row = rows[rowIndex];
      row = setCellValue(row, colTitle.id, truncateCell(payload.data?.specTitle ?? ''));
      row = setCellValue(row, colFields.id, truncateCell(fieldsValue));
      row = setCellValue(row, colAssumptions.id, joinList(payload.data?.assumptions));
      row = setCellValue(row, colCitations.id, joinList(payload.data?.citations));
      rows[rowIndex] = row;
    });
  }

  if (payload.mode === 'policy_compliance') {
    const colStatus = ensure('Compliance Status');
    const colIssues = ensure('Issues');
    const colMessage = ensure('Message');
    const colCitations = ensure('Citations');

    const issues = (payload.data as any)?.issues || [];
    const issueText = issues.map((issue: any) => issue.issue).filter(Boolean);
    const issueCitations = issues.flatMap((issue: any) => issue.citations || []);
    const citations = Array.from(new Set([...(payload.data as any)?.citations || [], ...issueCitations]));

    targetRowIds.forEach((rowId) => {
      const rowIndex = rows.findIndex((r) => r.id === rowId);
      if (rowIndex === -1) return;
      let row = rows[rowIndex];
      row = setCellValue(row, colStatus.id, truncateCell(payload.data?.status ?? ''));
      row = setCellValue(row, colIssues.id, truncateCell(issueText.join('; ')));
      row = setCellValue(row, colMessage.id, truncateCell(payload.data?.message ?? ''));
      row = setCellValue(row, colCitations.id, truncateCell(citations.join('; ')));
      rows[rowIndex] = row;
    });
  }

  return { ...matrix, columns, rows };
};
