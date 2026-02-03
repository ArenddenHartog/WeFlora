import { track } from '../src/agentic/telemetry/telemetry';

/**
 * Error that includes a trace ID for debugging
 */
export class TracedError extends Error {
  traceId: string;
  originalError: unknown;

  constructor(message: string, traceId: string, originalError: unknown) {
    super(message);
    this.name = 'TracedError';
    this.traceId = traceId;
    this.originalError = originalError;
  }
}

/**
 * Options for safeAction wrapper
 */
export interface SafeActionOptions<T> {
  /** Called when the action fails */
  onError?: (error: Error, traceId: string) => void;
  /** Called when the action succeeds */
  onSuccess?: (result: T, traceId: string) => void;
  /** Custom error message prefix */
  errorPrefix?: string;
  /** Whether to rethrow the error after handling */
  rethrow?: boolean;
  /** Custom trace ID (auto-generated if not provided) */
  traceId?: string;
}

/**
 * Generates a unique trace ID for debugging
 */
export const generateTraceId = (): string => {
  return `act-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

/**
 * Gets the last trace ID from the global debug state (for DebugPanel)
 */
let lastTraceId: string | null = null;
let lastError: { message: string; traceId: string; at: string } | null = null;

export const getLastTraceId = (): string | null => lastTraceId;
export const getLastError = () => lastError;

/**
 * Wraps an async action with error handling, trace ID, and telemetry.
 * 
 * Usage:
 * ```typescript
 * const handleSave = () => safeAction(
 *   async () => {
 *     const result = await supabase.from('table').upsert(data);
 *     if (result.error) throw result.error;
 *     return result.data;
 *   },
 *   {
 *     onError: (error, traceId) => {
 *       showNotification(`Save failed: ${error.message}`, 'error');
 *     },
 *     onSuccess: () => {
 *       showNotification('Saved successfully', 'success');
 *     }
 *   }
 * );
 * ```
 */
export async function safeAction<T>(
  action: () => Promise<T>,
  options: SafeActionOptions<T> = {}
): Promise<T | null> {
  const traceId = options.traceId || generateTraceId();
  lastTraceId = traceId;

  try {
    const result = await action();
    
    // Track success
    track('safe_action.success', { traceId });
    
    // Call success callback
    options.onSuccess?.(result, traceId);
    
    return result;
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    const message = options.errorPrefix 
      ? `${options.errorPrefix}: ${error.message}`
      : error.message;

    // Update last error for debug panel
    lastError = {
      message,
      traceId,
      at: new Date().toISOString()
    };

    // Log to console with full context
    console.error('[safeAction] Action failed:', {
      traceId,
      message,
      error: err,
      stack: error.stack
    });

    // Track in telemetry
    track('safe_action.error', {
      traceId,
      message,
      name: error.name
    });

    // Call error callback
    options.onError?.(error, traceId);

    // Rethrow if requested
    if (options.rethrow) {
      throw new TracedError(message, traceId, err);
    }

    return null;
  }
}

/**
 * Creates a wrapped click handler that uses safeAction.
 * 
 * Usage:
 * ```typescript
 * const handleClick = createSafeHandler(
 *   async () => {
 *     await doAsyncThing();
 *   },
 *   {
 *     onError: (error) => showNotification(error.message, 'error')
 *   }
 * );
 * 
 * <button onClick={handleClick}>Do Thing</button>
 * ```
 */
export function createSafeHandler<T>(
  action: () => Promise<T>,
  options: SafeActionOptions<T> = {}
): () => Promise<T | null> {
  return () => safeAction(action, options);
}

/**
 * Wraps a sync click handler with error handling.
 * 
 * Usage:
 * ```typescript
 * <button onClick={safeSyncHandler(() => {
 *   // sync code that might throw
 *   riskyOperation();
 * })}>
 *   Click me
 * </button>
 * ```
 */
export function safeSyncHandler(
  handler: () => void,
  options: { onError?: (error: Error, traceId: string) => void } = {}
): () => void {
  return () => {
    const traceId = generateTraceId();
    lastTraceId = traceId;

    try {
      handler();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      
      lastError = {
        message: error.message,
        traceId,
        at: new Date().toISOString()
      };

      console.error('[safeSyncHandler] Handler failed:', {
        traceId,
        message: error.message,
        error: err
      });

      track('safe_sync_handler.error', {
        traceId,
        message: error.message
      });

      options.onError?.(error, traceId);
    }
  };
}

/**
 * Last RPC call info for debugging
 */
interface RpcCallInfo {
  name: string;
  status: number | null;
  latencyMs: number;
  at: string;
  hasAuthHeader: boolean;
  hasApiKey: boolean;
}

let lastRpcCall: RpcCallInfo | null = null;

export const getLastRpcCall = (): RpcCallInfo | null => lastRpcCall;

/**
 * Records an RPC call for debugging
 */
export const recordRpcCall = (info: Omit<RpcCallInfo, 'at'>) => {
  lastRpcCall = {
    ...info,
    at: new Date().toISOString()
  };
};

/**
 * Enhanced debug state accessor for the debug panel
 */
export const getDebugState = () => ({
  lastTraceId,
  lastError,
  lastRpcCall
});

/**
 * Formats an error message with a trace ID for user-facing notifications.
 * 
 * Usage:
 * ```typescript
 * safeAction(
 *   async () => { ... },
 *   {
 *     onError: (error, traceId) => {
 *       showNotification(formatErrorWithTrace('Save failed', error.message, traceId), 'error');
 *     }
 *   }
 * );
 * ```
 */
export const formatErrorWithTrace = (
  prefix: string,
  message: string,
  traceId: string
): string => {
  return `${prefix}: ${message} [${traceId}]`;
};
