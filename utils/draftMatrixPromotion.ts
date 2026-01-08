import type { DraftMatrix } from '../src/decision-program/types';
import type { MatrixColumn, MatrixRow } from '../types';
import {
  buildWorksheetColumnSpecsFromDraftMatrix,
  buildWorksheetTableFromDraftMatrix
} from '../src/decision-program/orchestrator/evidenceToCitations';
import { getSkillTemplate } from '../services/skillTemplates';

export const promoteDraftMatrixToWorksheet = (
  matrix: DraftMatrix,
  options: { rowIds?: string[]; includeCitations?: boolean } = {}
): { columns: MatrixColumn[]; rows: MatrixRow[] } => {
  const columnSpecs = buildWorksheetColumnSpecsFromDraftMatrix(matrix);
  const { columns: labels, rows } = buildWorksheetTableFromDraftMatrix(matrix, options);
  const now = Date.now();

  const worksheetColumns = labels.map((label, index) => {
    const spec = columnSpecs[index];
    const template = spec?.skillId ? getSkillTemplate(spec.skillId) : undefined;
    const baseColumn: MatrixColumn = {
      id: `col-${index + 1}`,
      title: label,
      type: 'text',
      width: 200,
      isPrimaryKey: index === 0
    };

    if (template && spec?.label === label) {
      return {
        ...baseColumn,
        type: 'ai',
        skillConfig: {
          id: `skill-${template.id}-${now}-${index}`,
          name: template.name,
          description: template.description,
          promptTemplate: template.promptTemplate ?? '',
          templateId: template.id,
          params: spec.skillArgs ?? {},
          attachedContextIds: [],
          outputType: template.outputType
        }
      };
    }

    return baseColumn;
  });

  const worksheetRows = rows.map((row, rowIndex) => ({
    id: `row-${now}-${rowIndex}`,
    entityName: row[0] ?? '',
    cells: worksheetColumns.reduce((acc, column, colIndex) => {
      acc[column.id] = { columnId: column.id, value: row[colIndex] ?? '' };
      return acc;
    }, {} as Record<string, { columnId: string; value: string | number }>)
  }));

  return { columns: worksheetColumns, rows: worksheetRows };
};
