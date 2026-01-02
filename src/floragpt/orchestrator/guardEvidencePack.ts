import type { EvidencePack, WorkOrder } from '../types';
import { ensureContext } from './ensureContext.ts';

export const guardEvidencePack = async (args: {
  workOrder: WorkOrder;
  buildEvidencePack: () => Promise<EvidencePack>;
}): Promise<{ gate: ReturnType<typeof ensureContext>; evidencePack: EvidencePack | null }> => {
  const { workOrder, buildEvidencePack } = args;
  const gate = ensureContext(workOrder);
  if (gate) {
    return { gate, evidencePack: null };
  }
  const evidencePack = await buildEvidencePack();
  return { gate: null, evidencePack };
};
