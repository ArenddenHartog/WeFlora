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

export const handleSupabaseError = (error: any, operation: string): never => {
  const isAuthError = error?.status === 401 || error?.code === 'PGRST301';
  const isRlsError = error?.status === 403 || error?.code === '42501';

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
