import { useState, useCallback } from 'react';
import { safeAction, generateTraceId, type SafeActionOptions } from '../safeAction';

/**
 * Return type for useSafeAction hook
 */
export interface UseSafeActionReturn<T, Args extends unknown[]> {
  execute: (...args: Args) => Promise<T | null>;
  isLoading: boolean;
  error: Error | null;
  traceId: string | null;
  reset: () => void;
}

/**
 * React hook for using safeAction with loading and error states.
 * 
 * Usage:
 * ```typescript
 * const { execute, isLoading, error, traceId } = useSafeAction(
 *   async (id: string) => {
 *     const result = await supabase.from('table').select().eq('id', id);
 *     if (result.error) throw result.error;
 *     return result.data;
 *   },
 *   {
 *     onError: (error) => showNotification(error.message, 'error'),
 *     onSuccess: () => showNotification('Loaded!', 'success')
 *   }
 * );
 * 
 * // In component:
 * <button onClick={() => execute('123')} disabled={isLoading}>
 *   {isLoading ? 'Loading...' : 'Load Data'}
 * </button>
 * {error && <span>Error: {error.message} (trace: {traceId})</span>}
 * ```
 */
export function useSafeAction<T, Args extends unknown[]>(
  action: (...args: Args) => Promise<T>,
  options: SafeActionOptions<T> = {}
): UseSafeActionReturn<T, Args> {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [traceId, setTraceId] = useState<string | null>(null);

  const execute = useCallback(
    async (...args: Args): Promise<T | null> => {
      const currentTraceId = options.traceId || generateTraceId();
      setTraceId(currentTraceId);
      setIsLoading(true);
      setError(null);

      const result = await safeAction(
        () => action(...args),
        {
          ...options,
          traceId: currentTraceId,
          onError: (err, tid) => {
            setError(err);
            options.onError?.(err, tid);
          },
          onSuccess: (res, tid) => {
            options.onSuccess?.(res, tid);
          }
        }
      );

      setIsLoading(false);
      return result;
    },
    [action, options]
  );

  const reset = useCallback(() => {
    setIsLoading(false);
    setError(null);
    setTraceId(null);
  }, []);

  return { execute, isLoading, error, traceId, reset };
}

/**
 * Simplified hook that just returns execute and isLoading for quick usage.
 * 
 * Usage:
 * ```typescript
 * const [handleSave, isSaving] = useAsyncAction(async () => {
 *   await saveData();
 * }, { onError: (e) => showError(e.message) });
 * 
 * <button onClick={handleSave} disabled={isSaving}>Save</button>
 * ```
 */
export function useAsyncAction<T>(
  action: () => Promise<T>,
  options: SafeActionOptions<T> = {}
): [() => Promise<T | null>, boolean] {
  const { execute, isLoading } = useSafeAction(action, options);
  return [execute, isLoading];
}
