import type { Types } from 'mongoose';
import type { MatchDirection } from '@club/shared-types/core/enums';

export const MATCH_SCHEDULE_DUPLICATE_INDEX =
  'unique_match_schedule_duplicate_key';

export function normalizeMatchScheduleText(value: string): string {
  return value.normalize('NFC').trim().replace(/\s+/gu, ' ');
}

export function normalizeMatchScheduleComparison(value: string): string {
  return normalizeMatchScheduleText(value).toLocaleLowerCase('de-DE');
}

export function buildMatchScheduleDuplicateKey(input: {
  teamId: string | Types.ObjectId;
  opponentName: string;
  direction: MatchDirection;
  startAt: Date;
  location: string;
}): string {
  return JSON.stringify([
    input.teamId.toString(),
    normalizeMatchScheduleComparison(input.opponentName),
    input.direction,
    input.startAt.toISOString(),
    normalizeMatchScheduleComparison(input.location),
  ]);
}

export function withMatchScheduleDuplicateKey<
  T extends Parameters<typeof buildMatchScheduleDuplicateKey>[0],
>(input: T): T & { scheduleDuplicateKey: string } {
  return {
    ...input,
    scheduleDuplicateKey: buildMatchScheduleDuplicateKey(input),
  };
}

export function isMatchScheduleDuplicateError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as {
    code?: number;
    message?: string;
    keyPattern?: Record<string, unknown>;
  };
  if (candidate.code !== 11000) return false;
  return (
    candidate.message?.includes(MATCH_SCHEDULE_DUPLICATE_INDEX) === true ||
    candidate.keyPattern?.scheduleDuplicateKey === 1
  );
}
