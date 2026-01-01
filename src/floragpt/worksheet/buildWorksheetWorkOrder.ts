import type { WorkOrder } from '../types';
import type { WorksheetSelectionSnapshot } from './types';

type WorksheetActionType = 'score_suitability' | 'write_spec' | 'check_policy';

const modeByAction: Record<WorksheetActionType, WorkOrder['mode']> = {
  score_suitability: 'suitability_scoring',
  write_spec: 'spec_writer',
  check_policy: 'policy_compliance'
};

export const buildWorksheetWorkOrder = (args: {
  actionType: WorksheetActionType;
  projectId: string;
  worksheetId: string;
  selection: WorksheetSelectionSnapshot | null;
  selectedDocs: WorkOrder['selectedDocs'];
  userLanguage?: WorkOrder['userLanguage'];
}): WorkOrder => {
  const { actionType, projectId, worksheetId, selection, selectedDocs, userLanguage } = args;
  return {
    mode: modeByAction[actionType],
    schemaVersion: 'v0.1',
    projectId,
    privateEnvelopeId: null,
    userQuery: `Worksheet action: ${actionType} for ${worksheetId}`,
    userLanguage: userLanguage ?? 'auto',
    responseMode: 'short',
    viewContext: 'worksheet',
    worksheetSelection: selection
      ? { sheetId: selection.matrixId, rangeA1: 'selection' }
      : { sheetId: worksheetId, rangeA1: 'all' },
    selectedDocs,
    evidencePolicy: {
      includeProjectEnvelope: true,
      includeGlobalKB: true,
      includePolicyDocs: actionType === 'check_policy' ? 'only_if_selected' : 'only_if_selected'
    }
  };
};
