import type { ContextItem, FloraGPTMode } from '../../types';

export type WorkOrderViewContext = 'chat' | 'worksheet' | 'report';

export interface WorkOrder {
  mode: FloraGPTMode;
  schemaVersion: 'v0.1';
  projectId: string;
  privateEnvelopeId: string | null;
  userQuery: string;
  userLanguage: 'auto';
  responseMode: 'short' | 'enriched';
  viewContext: WorkOrderViewContext;
  uiAction?: string | null;
  worksheetSelection?: { sheetId: string; rangeA1: string } | null;
  selectedDocs?: { sourceId: string; sourceType: 'upload' | 'policy_manual' | 'global_kb' | 'project' | 'worksheet' | 'report'; scope: string; title?: string };
  evidencePolicy?: {
    includeProjectEnvelope: boolean;
    includeGlobalKB: boolean;
    includePolicyDocs: 'only_if_selected' | boolean;
  };
  siteContext?: {
    jurisdiction?: string | null;
    siteType?: string | null;
    soil?: string | null;
    moisture?: string | null;
    sun?: string | null;
    spaceConstraints?: string | null;
    objectives?: string[];
  };
}

export interface EvidenceHit {
  sourceId: string;
  sourceType: 'upload' | 'global_kb' | 'policy_manual' | 'project' | 'worksheet' | 'report';
  title: string;
  locationHint?: string | null;
  snippet: string;
  score?: number;
  scope?: string | null;
}

export interface EvidencePack {
  globalHits: EvidenceHit[];
  projectHits: EvidenceHit[];
  policyHits: EvidenceHit[];
}

export interface FloraGPTContext {
  contextItems: ContextItem[];
  projectId: string;
}
