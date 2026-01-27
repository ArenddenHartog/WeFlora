import type { VaultRecord, VaultRecordType } from '../readiness/types';

export interface VaultIndex {
  byId: Map<string, VaultRecord>;
  byType: Map<VaultRecordType, VaultRecord[]>;
  byPointer: Map<string, string[]>;
  bestByPointer: Map<string, string[]>;
  updatedAt: number;
}

const compareRecords = (a: VaultRecord, b: VaultRecord) => {
  const updatedA = new Date(a.updated_at).getTime();
  const updatedB = new Date(b.updated_at).getTime();
  return updatedB - updatedA;
};

export const buildVaultIndex = (records: VaultRecord[]): VaultIndex => {
  const byId = new Map<string, VaultRecord>();
  const byType = new Map<VaultRecordType, VaultRecord[]>();
  const byPointer = new Map<string, string[]>();
  const bestByPointer = new Map<string, string[]>();

  records.forEach((record) => {
    byId.set(record.vault_id, record);
    const list = byType.get(record.type) ?? [];
    list.push(record);
    byType.set(record.type, list);

    if (record.confidence_by_pointer) {
      Object.keys(record.confidence_by_pointer).forEach((pointer) => {
        const ids = byPointer.get(pointer) ?? [];
        ids.push(record.vault_id);
        byPointer.set(pointer, ids);
      });
    }
    if (record.provenance_by_pointer) {
      Object.keys(record.provenance_by_pointer).forEach((pointer) => {
        const ids = byPointer.get(pointer) ?? [];
        if (!ids.includes(record.vault_id)) ids.push(record.vault_id);
        byPointer.set(pointer, ids);
      });
    }
  });

  byType.forEach((list, key) => {
    byType.set(key, list.sort(compareRecords));
  });

  byPointer.forEach((ids, pointer) => {
    const sorted = [...ids].sort((a, b) => {
      const recA = byId.get(a);
      const recB = byId.get(b);
      if (!recA || !recB) return 0;
      const provA = recA.type === 'Policy'
        ? (recA.provenance_by_pointer?.[pointer]?.length ?? 0)
        : 0;
      const provB = recB.type === 'Policy'
        ? (recB.provenance_by_pointer?.[pointer]?.length ?? 0)
        : 0;
      if (provA !== provB) return provB - provA;
      if (recA.confidence !== recB.confidence) return recB.confidence - recA.confidence;
      return compareRecords(recA, recB);
    });
    bestByPointer.set(pointer, sorted);
  });

  return { byId, byType, byPointer, bestByPointer, updatedAt: Date.now() };
};
