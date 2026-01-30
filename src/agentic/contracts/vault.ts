import type { UUID, ISO8601, ScopeId, Json, Provenance, SemVer } from './primitives';

export type VaultObjectKind =
  | 'file'
  | 'document'
  | 'dataset'
  | 'record'
  | 'policy'
  | 'geometry'
  | 'image'
  | 'artifact'
  | 'op_result'
  | 'agent_output';

export type MimeType = string;

export interface VaultRef {
  vault_id: UUID;
  version: number; // monotonically increasing
}

export interface VaultPointer {
  // A stable pointer used everywhere (ledger, run context, flows, UI)
  ref: VaultRef;

  // Optional sub-selection, for datasets/docs (JSON pointer, CSV range, etc.)
  selector?: VaultSelector;

  // Human display metadata (not authoritative)
  label?: string;
}

export type VaultSelector =
  | { kind: 'json_pointer'; pointer: string } // e.g. "#/properties/x"
  | { kind: 'table_range'; sheet?: string; a1: string } // e.g. A1:D50
  | { kind: 'text_span'; start: number; end: number }
  | { kind: 'page_range'; from: number; to: number }
  | { kind: 'geo_feature'; feature_id: string }
  | { kind: 'none' };

export interface VaultObjectBase {
  vault_id: UUID;
  scope_id: ScopeId;

  kind: VaultObjectKind;

  // Stable identity for showing in UI (name) + tags
  title: string;
  description?: string;
  tags?: string[];

  // Versioning
  version: number;
  created_at: ISO8601;
  created_by: Provenance;

  // For audit + cache correctness
  content_hash?: string; // e.g. sha256 of bytes or canonical JSON
  schema_version?: SemVer; // optional schema for structured objects
}

export interface VaultFileObject extends VaultObjectBase {
  kind: 'file';
  mime_type: MimeType;
  bytes: number;
  storage: { provider: 'local' | 's3' | 'gcs'; uri: string };
  original_filename?: string;
}

export interface VaultDocumentObject extends VaultObjectBase {
  kind: 'document' | 'policy';
  mime_type?: MimeType;
  // canonical extracted text lives here (ops-produced)
  text?: string;
  // optional structured representation (chunks, sections)
  structure?: Json;
  source_file?: VaultRef;
}

export interface VaultDatasetObject extends VaultObjectBase {
  kind: 'dataset';
  mime_type?: MimeType; // csv/xlsx/parquet/etc.
  // minimal schema descriptor (not a full catalog)
  columns?: Array<{ name: string; type: 'string' | 'number' | 'boolean' | 'date' | 'json' }>;
  row_count?: number;
  source_file?: VaultRef;
}

export interface VaultGeometryObject extends VaultObjectBase {
  kind: 'geometry';
  // GeoJSON or pointer to external file. Keep it generic.
  geojson?: Json;
  source_file?: VaultRef;
  crs?: string; // e.g. "EPSG:28992"
}

export interface VaultRecordObject extends VaultObjectBase {
  kind: 'record' | 'op_result' | 'agent_output' | 'artifact';
  data: Json;
  // Optional: "what schema is this?"
  schema_id?: string; // e.g. "weflora.agent_output.compliance.policy_grounded"
}

export type VaultObject =
  | VaultFileObject
  | VaultDocumentObject
  | VaultDatasetObject
  | VaultGeometryObject
  | VaultRecordObject;

export interface VaultWriteRequest {
  scope_id: ScopeId;
  kind: VaultObjectKind;
  title: string;
  description?: string;
  tags?: string[];
  schema_id?: string;
  schema_version?: SemVer;
  created_by: Provenance;

  // for record-like kinds
  data?: Json;

  // for file-like kinds
  file?: {
    mime_type: MimeType;
    bytes: number;
    storage: { provider: 'local' | 's3' | 'gcs'; uri: string };
    original_filename?: string;
    content_hash?: string;
  };

  // linking
  source_file?: VaultRef;
}
