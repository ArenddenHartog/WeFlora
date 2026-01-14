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
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = 'PcivRlsDeniedError';
  }
}

/**
 * Thrown when a PCIV operation requires authentication but user is not authenticated.
 * HTTP 401 or PostgREST error code PGRST301.
 * User needs to log in to perform the operation.
 */
export class PcivAuthRequiredError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = 'PcivAuthRequiredError';
  }
}
