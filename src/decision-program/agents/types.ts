import type { DecisionProgram, DecisionStep, EvidenceRef, ExecutionContext, ExecutionState, Phase } from '../types.ts';

export interface AgentRunInput {
  context: ExecutionContext;
  step?: DecisionStep;
  program: DecisionProgram;
  state: ExecutionState;
}

export interface AgentRunResult {
  patches: Array<{ pointer: string; value: unknown }>;
  evidence?: EvidenceRef[];
  notes?: string[];
}

export interface Agent {
  id: string;
  title: string;
  phase: Phase;
  requiredPointers: string[];
  producesPointers: string[];
  run: (input: AgentRunInput) => Promise<AgentRunResult> | AgentRunResult;
}

export type AgentRegistry = Map<string, Agent>;
