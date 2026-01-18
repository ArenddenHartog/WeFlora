/**
 * PCIV RLS Error Classes
 * 
 * Typed errors for Row Level Security failures in PCIV Supabase operations.
 * These distinguish authentication failures from authorization denials.
 */

/**
 * Thrown when a PCIV operation is denied by RLS policy.
 * HTTP 403 or PostgreSQL error code 42501.
 * User is authenticated but lacks permission for the operation.
 */
export class PcivRlsDeniedError extends Error {
  cause?: unknown;
  
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'PcivRlsDeniedError';
    this.cause = cause;
  }
}

/**
 * Thrown when a PCIV operation requires authentication but user is not authenticated.
 * HTTP 401 or PostgREST error code PGRST301.
 * User needs to log in to perform the operation.
 */
export class PcivAuthRequiredError extends Error {
  cause?: unknown;
  
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'PcivAuthRequiredError';
    this.cause = cause;
  }
}

/**
 * Thrown when a database query references columns that don't exist in the schema.
 * HTTP 400 or PostgREST error PGRST204 (column not found).
 * Indicates a schema mismatch - do not retry.
 */
export class PcivSchemaMismatchError extends Error {
  cause?: unknown;
  
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'PcivSchemaMismatchError';
    this.cause = cause;
  }
}

/**
 * Thrown when a database query references columns that don't exist in the schema.
 * HTTP 400 or PostgREST error PGRST204 (column not found).
 * Indicates a schema mismatch - do not retry.
 */
export class PcivSchemaMismatchError extends Error {
  cause?: unknown;
  
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'PcivAuthRequiredError';
    this.cause = cause;
  }
}
