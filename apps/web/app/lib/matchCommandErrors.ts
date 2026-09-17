export type MatchCommandErrorMessageKey =
  | 'errors.duplicateSchedule'
  | 'errors.conflict'
  | 'errors.invalidStart';

export function getMatchCommandErrorMessageKey(
  error: unknown
): MatchCommandErrorMessageKey | null {
  const response = (
    error as { response?: { status?: number; data?: { code?: string } } }
  ).response;
  if (response?.data?.code === 'MATCH_SCHEDULE_DUPLICATE') {
    return 'errors.duplicateSchedule';
  }
  if (response?.status === 409) return 'errors.conflict';
  if (response?.status === 400) return 'errors.invalidStart';
  return null;
}
