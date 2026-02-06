export class PlannerRlsDeniedError extends Error {
  cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'PlannerRlsDeniedError';
    this.cause = cause;
  }
}

export class PlannerAuthRequiredError extends Error {
  cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'PlannerAuthRequiredError';
    this.cause = cause;
  }
}

export class PlannerRpcMissingError extends Error {
  rpcName: string;
  cause?: unknown;

  constructor(operation: string, cause?: unknown) {
    super(`Backend mismatch: RPC for ${operation} not deployed`);
    this.name = 'PlannerRpcMissingError';
    this.rpcName = operation;
    this.cause = cause;
  }
}

export const handleSupabaseError = (error: any, operation: string): never => {
  const isAuthError = error?.status === 401 || error?.code === 'PGRST301';
  const isRlsError = error?.status === 403 || error?.code === '42501';
  const isRpcMissing = error?.code === 'PGRST202';

  if (isRpcMissing) {
    console.error(`[RPC missing] ${operation}`, {
      code: error.code,
      message: error.message,
      details: error.details,
    });
    throw new PlannerRpcMissingError(operation, error);
  }

  if (isAuthError) {
    throw new PlannerAuthRequiredError(
      `Authentication required for ${operation}: ${error.message}`,
      error
    );
  }

  if (isRlsError) {
    throw new PlannerRlsDeniedError(
      `Access denied by RLS policy for ${operation}: ${error.message}`,
      error
    );
  }

  throw new Error(`${operation} failed: ${error.message}`);
};
