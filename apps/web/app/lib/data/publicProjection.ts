export type PublicProjectionResult<T> =
  | { status: 'ready'; data: T }
  | { status: 'unavailable' };
