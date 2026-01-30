import type { UUID, ISO8601, ScopeId, Json, PointerPath, Provenance } from './primitives';
import type { VaultPointer } from './vault';

export type RunKind = 'skill' | 'flow' | 'agent_string' | 'ops';

export interface RunContext {
  run_id: UUID;
  scope_id: ScopeId;

  kind: RunKind;

  // What user thinks they're doing
  title: string;
  intent?: string;

  // What they ran
  skill_id?: string; // for kind=skill
  flow_id?: string; // for kind=flow
  agent_ids?: string[]; // for kind=agent_string

  // Who/what started it
  created_at: ISO8601;
  created_by: Provenance;

  // Runtime knobs
  runtime: {
    model?: string; // e.g. "gpt-5"
    temperature?: number;
    max_tokens?: number;
    locale?: string; // "nl-NL"
    timezone?: string; // "Europe/Amsterdam"
  };

  // Canonical input bindings used by the runner
  // Examples:
  // "/inputs/species_list" -> pointer to dataset
  // "/inputs/policy_refs" -> pointer to document
  input_bindings: Record<PointerPath, VaultPointer>;

  // Scratch for runner (not UI). Still persisted for reproducibility.
  // E.g. computed intermediate pointers, resolved connector refs, etc.
  runtime_state?: {
    resolved?: Record<string, Json>;
    warnings?: string[];
  };

  // Optional: explicit constraints for strict flows
  constraints?: {
    strict_mode?: boolean;
    require_evidence?: boolean;
    max_cost_eur?: number;
  };
}
