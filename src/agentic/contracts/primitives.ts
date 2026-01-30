export type UUID = string; // use uuid v4 in impl
export type ISO8601 = string; // e.g. new Date().toISOString()

// JSON Pointer-like paths for structured state/payloads.
export type PointerPath = `/${string}`;

// Identifies a tenant/workspace/project scope.
export type ScopeId = string;

// Used for schema version pinning.
export type SemVer = `${number}.${number}.${number}`;

// Simple confidence scale used across events.
export type Confidence = 'low' | 'medium' | 'high';

// Common status for step results.
export type StepStatus = 'ok' | 'insufficient_data' | 'rejected' | 'error' | 'skipped';

// Used for deterministic ops (ETL/FME-like)
export type OpsStatus = 'queued' | 'running' | 'complete' | 'failed' | 'skipped';

// Where a value came from (human/system/import/agent)
export type Provenance =
  | { kind: 'human'; actor_id?: string }
  | { kind: 'agent'; agent_id: string; run_id: UUID; step_id?: UUID }
  | { kind: 'ops'; op_id: string; job_id: UUID }
  | { kind: 'import'; source: 'upload' | 'connector'; connector_id?: string }
  | { kind: 'system'; reason?: string };

// Generic JSON value (without Date/Map/etc.)
export type Json =
  | null
  | boolean
  | number
  | string
  | Json[]
  | { [k: string]: Json };
