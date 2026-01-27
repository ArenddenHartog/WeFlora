import type { AgentProfile, InputFieldSpec, JsonPointer } from '../../decision-program/contracts/types';

export type VaultRecordType = 'Policy' | 'SpeciesList' | 'Site' | 'Vision' | 'Climate' | 'Other';

export type Confidence = number; // 0..1
export type RelevanceLevel = 'High' | 'Medium' | 'Low';

export interface VaultScopeRef {
  kind: 'global' | 'project';
  project_id?: string;
}

export interface VaultFileRef {
  file_id: string;
  filename: string;
  mime: string;
  bytes?: number;
  storage_path?: string;
}

export interface ProvenanceLocator {
  page?: number;
  line_start?: number;
  line_end?: number;
  bbox?: [number, number, number, number];
}

export interface FieldProvenance {
  file_id: string;
  locator: ProvenanceLocator;
  snippet?: string;
  confidence?: Confidence;
}

export interface VaultRecord {
  vault_id: string;
  type: VaultRecordType;
  title: string;
  scope: VaultScopeRef;
  data: Record<string, unknown>;
  confidence_by_pointer?: Partial<Record<JsonPointer, Confidence>>;
  provenance_by_pointer?: Partial<Record<JsonPointer, FieldProvenance[]>>;
  confidence: Confidence;
  files?: VaultFileRef[];
  tags?: string[];
  created_at: string;
  updated_at: string;
}

export type ReadinessStatus = 'ready' | 'needs_review' | 'missing' | 'blocked';

export interface RelevanceResult {
  level: RelevanceLevel;
  score: number; // 0..1
  reasons: string[];
}

export interface CandidateMatch {
  vault_id: string;
  title: string;
  type: VaultRecordType;
  scope: VaultScopeRef;
  pointer_coverage?: {
    pointer: JsonPointer;
    present: boolean;
    confidence: Confidence;
    confidence_ok: boolean;
    provenance_count: number;
    provenance_ok: boolean;
  };
  file_coverage?: {
    matched: boolean;
    matched_files?: VaultFileRef[];
  };
  confidence: Confidence;
  relevance: RelevanceResult;
  issues: Array<
    | { code: 'pointer_missing'; message: string }
    | { code: 'low_confidence'; message: string; observed: Confidence; threshold: Confidence }
    | { code: 'missing_provenance'; message: string }
    | { code: 'file_type_mismatch'; message: string }
    | { code: 'schema_mismatch'; message: string }
  >;
}

export interface InputCoverage {
  input_key: string;
  required: boolean;
  source: 'vault_record' | 'vault_file' | 'manual' | 'mixed';
  pointer?: JsonPointer;
  candidates: CandidateMatch[];
  selected?: SkillBinding;
  issues: Array<
    | { code: 'missing_required'; message: string }
    | { code: 'needs_manual'; message: string }
    | { code: 'no_candidates'; message: string }
  >;
}

export type SkillBinding =
  | { kind: 'vault_record'; vault_id: string; pointer?: JsonPointer }
  | { kind: 'vault_file'; file_id: string; vault_id?: string }
  | { kind: 'manual'; value: unknown; pointer?: JsonPointer };

export interface SkillBindings {
  inputs: Record<string, SkillBinding>;
  reads: Partial<Record<JsonPointer, { kind: 'from_input'; input_key: string } | SkillBinding>>;
}

export interface SkillReadinessResult {
  status: ReadinessStatus;
  profile_id: string;
  spec_version: string;
  schema_version: string;
  coverage: InputCoverage[];
  bindings: SkillBindings;
  explanation: {
    summary: string;
    reasons: string[];
    missing_inputs: string[];
    warnings: string[];
  };
  actions: {
    add_now: Array<{
      input_key: string;
      suggested_record_type?: VaultRecordType;
      suggested_accept?: string[];
      suggested_control?: InputControlHint;
    }>;
    fill_manually: Array<{ input_key: string }>;
    review_queue: Array<{ input_key: string; vault_id: string }>;
  };
  metrics: {
    required_total: number;
    required_satisfied: number;
    missing_required: number;
    needs_review: number;
  };
}

export type InputControlHint = 'text' | 'textarea' | 'select' | 'checkbox' | 'number' | 'json';

export interface ReadinessEngineOptions {
  min_confidence_default?: Confidence;
  require_provenance_default?: boolean;
  prefer_scope?: VaultScopeRef;
}

export interface ComputeReadinessArgs {
  profile: AgentProfile;
  vault: VaultRecord[];
  existingBindings?: Partial<SkillBindings>;
  opts?: ReadinessEngineOptions;
}

export type SourcePreference = {
  minConf: number;
  preferScope?: VaultScopeRef;
  requireProvenanceDefault: boolean;
};

export type CandidateContext = {
  input: InputFieldSpec;
  vault: VaultRecord[];
  prefs: SourcePreference;
};
