export class AgenticRuntimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AgenticRuntimeError';
  }
}

export class AgentProfileNotFoundError extends AgenticRuntimeError {
  constructor(agentId: string, version?: string) {
    super(`Agent profile not found: ${agentId}${version ? `@${version}` : ''}`);
    this.name = 'AgentProfileNotFoundError';
  }
}

export class AgentHandlerError extends AgenticRuntimeError {
  public readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'AgentHandlerError';
    this.cause = cause;
  }
}
