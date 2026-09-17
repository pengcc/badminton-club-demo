export function isAmbiguousMutationError(error: unknown): boolean {
  return !(
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    error.response !== undefined
  );
}

export function retryAmbiguousLifecycleMutation(
  failureCount: number,
  error: unknown
): boolean {
  if (failureCount >= 1) return false;
  return isAmbiguousMutationError(error);
}
