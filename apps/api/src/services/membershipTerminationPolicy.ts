import { AppError } from '../utils/errors';
import { Temporal } from '@js-temporal/polyfill';

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const QUARTER_ENDS = new Set(['03-31', '06-30', '09-30', '12-31']);
export const MEMBERSHIP_TERMINATION_TIME_ZONE = 'Europe/Berlin';

export function utcDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function berlinDateOnly(date: Date): string {
  if (!Number.isFinite(date.getTime())) {
    throw AppError.validation('Timestamp is invalid');
  }
  return Temporal.Instant.fromEpochMilliseconds(date.getTime())
    .toZonedDateTimeISO(MEMBERSHIP_TERMINATION_TIME_ZONE)
    .toPlainDate()
    .toString();
}

export function parseDateOnly(value: string): Date {
  const match = DATE_ONLY_PATTERN.exec(value);
  if (!match) throw AppError.validation('Effective date must use YYYY-MM-DD');
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw AppError.validation('Effective date is not a valid calendar date');
  }
  return parsed;
}

export function isQuarterEnd(value: string): boolean {
  parseDateOnly(value);
  return QUARTER_ENDS.has(value.slice(5));
}

export function latestNoticeDate(value: string): string {
  const effectiveDate = parseDateOnly(value);
  if (!isQuarterEnd(value)) {
    throw AppError.validation('Effective date must be a calendar quarter end');
  }
  return utcDateOnly(
    new Date(
      Date.UTC(effectiveDate.getUTCFullYear(), effectiveDate.getUTCMonth(), 0)
    )
  );
}

export interface TerminationDateValidationInput {
  effectiveDate: string;
  requestedAt: Date;
  evaluatedAt: Date;
}

export function assertValidTerminationRequestTimestamp({
  requestedAt,
  evaluatedAt,
}: Pick<TerminationDateValidationInput, 'requestedAt' | 'evaluatedAt'>): void {
  if (!Number.isFinite(requestedAt.getTime())) {
    throw AppError.validation('Request timestamp is invalid');
  }
  if (!Number.isFinite(evaluatedAt.getTime())) {
    throw AppError.validation('Evaluation timestamp is invalid');
  }
  if (requestedAt.getTime() > evaluatedAt.getTime()) {
    throw AppError.validation('Request timestamp cannot be in the future');
  }
}

export function assertValidTerminationDate({
  effectiveDate,
  requestedAt,
  evaluatedAt,
}: TerminationDateValidationInput): void {
  assertValidTerminationRequestTimestamp({ requestedAt, evaluatedAt });
  if (!isQuarterEnd(effectiveDate)) {
    throw AppError.validation('Effective date must be a calendar quarter end');
  }
  const requestDate = berlinDateOnly(requestedAt);
  const evaluationDate = berlinDateOnly(evaluatedAt);
  if (effectiveDate <= evaluationDate) {
    throw AppError.validation('Effective date must be in the future');
  }
  if (requestDate > latestNoticeDate(effectiveDate)) {
    throw AppError.validation(
      'Effective date requires at least one full calendar month notice'
    );
  }
}
