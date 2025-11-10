/**
 * Base Service Utilities
 *
 * Common utilities and patterns for all services
 */

export interface ServiceHookResult<T> {
  data: T | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch?: () => void;
}

export class BaseService {
  /**
   * Standardized error handling
   */
  static handleError(error: unknown): Error {
    if (error instanceof Error) return error;
    if (typeof error === 'string') return new Error(error);
    return new Error('An unknown error occurred');
  }

  /**
   * Query key generator for consistent cache keys
   */
  static queryKey(entity: string, operation: string, params?: Record<string, any>): string[] {
    const key = [entity, operation];
    if (params) {
      // Sort keys for consistent cache keys
      const sortedParams = Object.keys(params)
        .sort()
        .reduce((acc, k) => ({ ...acc, [k]: params[k] }), {});
      key.push(JSON.stringify(sortedParams));
    }
    return key;
  }
}
