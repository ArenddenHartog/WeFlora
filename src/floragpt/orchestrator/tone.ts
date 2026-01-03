import type { WorkOrder } from '../types';

export const buildToneInstruction = (workOrder: WorkOrder): string => {
  if (workOrder.viewContext === 'worksheet') {
    return 'Tone: worksheet_prep — operational, checklist-driven, and action-oriented.';
  }
  if (workOrder.mode === 'suitability_scoring') {
    return 'Tone: analytical and decision-oriented with compact rationale.';
  }
  return 'Tone: strategic and exploratory with clear trade-offs.';
};
