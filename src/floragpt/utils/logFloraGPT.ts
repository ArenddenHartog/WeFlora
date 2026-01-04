type EvidenceCounts = { global: number; project: number; policy: number };

export type FloraGPTSchemaLog = {
  projectId: string;
  mode: string;
  schemaVersionExpected: string;
  schemaVersionReceived?: string | null;
  evidenceCounts: EvidenceCounts;
  citationsCount: number;
  selectedDocsCount: number;
  fallbackTextLength?: number | null;
  schemaMismatch?: boolean;
  validationPassed: boolean;
  repairAttempted: boolean;
  fallbackUsed: boolean;
  failureReason?: string | null;
};

export const logFloraGPTSchemaAttempt = (payload: FloraGPTSchemaLog) => {
  // Dev-only diagnostic; telemetry can replace this later without UI impact.
  console.info('[floragpt:debug]', {
    event: 'FloraGPTSchemaAttempt',
    ...payload
  });
};
