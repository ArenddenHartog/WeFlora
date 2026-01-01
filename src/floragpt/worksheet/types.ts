export type WorksheetSelectionSnapshot = {
  matrixId: string;
  selectedRowIds: string[];
  selectedColumnIds: string[];
  activeCell?: { rowId: string; columnId: string };
};
