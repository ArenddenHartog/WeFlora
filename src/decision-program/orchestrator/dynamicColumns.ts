import type { DraftMatrix, DraftMatrixColumn, ExecutionContext, ExecutionState } from '../types.ts';
import { getByPointer } from '../runtime/pointers.ts';
import { minimalDraftColumns } from './buildDraftMatrix.ts';

export type DynamicColumnRule = {
  id: string;
  when: (ctx: ExecutionState['context']) => boolean;
  columns: DraftMatrixColumn[];
  priority: number;
};

const hasPointerValue = (ctx: ExecutionState['context'], pointer: string): boolean => {
  const value = getByPointer({ context: ctx }, pointer);
  if (value === null || value === undefined) return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.trim().length > 0 && value !== 'ignoreStock';
  if (Array.isArray(value)) return value.length > 0;
  return true;
};

const availabilityMatters = (ctx: ExecutionState['context']): boolean => {
  const value = getByPointer({ context: ctx }, '/context/supply/availabilityRequired');
  return value === 'mustBeAvailableNow' || value === 'availableWithinSeason';
};

const heatToleranceColumn: DraftMatrixColumn = {
  id: 'heatTolerance',
  label: 'Heat Tolerance',
  kind: 'trait',
  datatype: 'string',
  why: 'Tracks fit for elevated heat stress conditions.',
  skillId: 'heat_resilience'
};

const droughtToleranceColumn: DraftMatrixColumn = {
  id: 'droughtTolerance',
  label: 'Drought Tolerance',
  kind: 'trait',
  datatype: 'string',
  why: 'Shows resilience under low-water conditions.',
  skillId: 'drought_resilience'
};

const compactionToleranceColumn: DraftMatrixColumn = {
  id: 'compactionTolerance',
  label: 'Compaction Tolerance',
  kind: 'trait',
  datatype: 'string',
  why: 'Highlights tolerance for compacted urban soils.'
};

const diversityComplianceColumn: DraftMatrixColumn = {
  id: 'diversityCompliance',
  label: 'Diversity Compliance',
  kind: 'compliance',
  datatype: 'string',
  why: 'Confirms alignment with diversity rules.',
  visible: false
};

const availabilityWindowColumn: DraftMatrixColumn = {
  id: 'availabilityWindow',
  label: 'Availability Window',
  kind: 'supply',
  datatype: 'string',
  why: 'Matches supply window timing to the build schedule.'
};

const stockStatusColumn: DraftMatrixColumn = {
  id: 'stockStatus',
  label: 'Stock Status',
  kind: 'supply',
  datatype: 'string',
  why: 'Signals whether inventory meets demand.'
};

const overallScoreColumn: DraftMatrixColumn = {
  id: 'overallScore',
  label: 'Overall Fit Score',
  kind: 'score',
  datatype: 'number',
  why: 'Composite score based on site fit and constraints.',
  skillId: 'overall_fit'
};

export const STREET_TREE_DYNAMIC_COLUMN_RULES: DynamicColumnRule[] = [
  {
    id: 'heat-tolerance',
    when: (ctx) => hasPointerValue(ctx, '/context/site/stressors/heat'),
    columns: [heatToleranceColumn],
    priority: 10
  },
  {
    id: 'drought-tolerance',
    when: (ctx) => hasPointerValue(ctx, '/context/site/stressors/drought'),
    columns: [droughtToleranceColumn],
    priority: 20
  },
  {
    id: 'compaction-tolerance',
    when: (ctx) => hasPointerValue(ctx, '/context/site/soil/compaction'),
    columns: [compactionToleranceColumn],
    priority: 30
  },
  {
    id: 'diversity-compliance',
    when: (ctx) => hasPointerValue(ctx, '/context/species/diversity/rule'),
    columns: [diversityComplianceColumn],
    priority: 40
  },
  {
    id: 'availability-status',
    when: (ctx) => availabilityMatters(ctx),
    columns: [availabilityWindowColumn, stockStatusColumn],
    priority: 50
  }
].sort((a, b) => a.priority - b.priority);

const resolveColumn = (column: DraftMatrixColumn, existing?: DraftMatrixColumn) =>
  existing
    ? {
        ...column,
        pinned: existing.pinned ?? column.pinned,
        visible: existing.visible ?? column.visible
      }
    : column;

export const applyDynamicColumns = (matrix: DraftMatrix, ctx: ExecutionContext): DraftMatrix => {
  const existingById = new Map(matrix.columns.map((column) => [column.id, column]));
  const baseColumns = minimalDraftColumns.map((column) => resolveColumn(column, existingById.get(column.id)));

  const dynamicColumns: DraftMatrixColumn[] = [];
  STREET_TREE_DYNAMIC_COLUMN_RULES.forEach((rule) => {
    if (!rule.when(ctx)) return;
    rule.columns.forEach((column) => {
      dynamicColumns.push(resolveColumn(column, existingById.get(column.id)));
    });
  });

  const hasOverallScoreCell = matrix.rows.some((row) => row.cells.some((cell) => cell.columnId === overallScoreColumn.id));
  if (hasOverallScoreCell) {
    dynamicColumns.push(resolveColumn(overallScoreColumn, existingById.get(overallScoreColumn.id)));
  }

  const columnIds = new Set([...baseColumns, ...dynamicColumns].map((column) => column.id));
  const extraColumns = matrix.columns.filter((column) => !columnIds.has(column.id));

  const columns: DraftMatrixColumn[] = [];
  [...baseColumns, ...dynamicColumns, ...extraColumns].forEach((column) => {
    if (columns.some((existing) => existing.id === column.id)) return;
    columns.push(column);
  });

  return {
    ...matrix,
    columns
  };
};
