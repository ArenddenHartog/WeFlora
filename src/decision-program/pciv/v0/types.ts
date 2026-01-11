export type PcivStage = 'import' | 'map' | 'validate';

export type PcivSourceStatus = 'pending' | 'parsed' | 'failed' | 'unsupported';
export type PcivSourceType = 'file' | 'location_hint' | 'manual_note';

export type PcivFieldProvenance = 'source-backed' | 'model-inferred' | 'user-entered' | 'unknown';

export type PcivFieldType = 'text' | 'select' | 'boolean';

export type PcivDomain = 'site' | 'regulatory' | 'equity' | 'biophysical';

export interface PcivSource {
  id: string;
  type: PcivSourceType;
  name: string;
  mimeType?: string;
  size?: number;
  status: PcivSourceStatus;
  content?: string;
  error?: string;
  createdAt: string;
}

export interface PcivField {
  pointer: string;
  label: string;
  group: PcivDomain;
  required: boolean;
  type: PcivFieldType;
  options?: string[];
  value?: string | number | boolean | null;
  provenance: PcivFieldProvenance;
  sourceId?: string;
  snippet?: string;
}

export interface PcivConstraint {
  id: string;
  key: string;
  domain: PcivDomain;
  label: string;
  value: string | number | boolean;
  provenance: PcivFieldProvenance;
  sourceId?: string;
  snippet?: string;
}

export interface PcivDraft {
  projectId: string;
  runId?: string | null;
  userId?: string | null;
  locationHint?: string;
  sources: PcivSource[];
  fields: Record<string, PcivField>;
  constraints: PcivConstraint[];
  errors: string[];
}

export interface PcivMetrics {
  sources_count: number;
  sources_ready_count: number;
  fields_total: number;
  fields_filled_count: number;
  required_unresolved_count: number;
  constraints_count: number;
  confidence_overall: number;
}

export interface PcivCommittedContext {
  status: 'committed' | 'partial_committed';
  committed_at: string;
  allow_partial: boolean;
  projectId: string;
  runId?: string | null;
  userId?: string | null;
  sources: PcivSource[];
  fields: Record<string, PcivField>;
  constraints: PcivConstraint[];
  metrics: PcivMetrics;
}

export interface PcivContextIntakeRun {
  id: string;
  projectId: string;
  userId?: string | null;
  runId?: string | null;
  status: 'draft' | 'committed' | 'partial_committed';
  draft: PcivDraft;
  commit?: PcivCommittedContext | null;
  metrics: PcivMetrics;
  createdAt: string;
  updatedAt: string;
}
