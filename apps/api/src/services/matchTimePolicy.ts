import { Temporal } from '@js-temporal/polyfill';
import { MATCH_TIME_ZONE, type Api } from '@club/shared-types/api/match';
import { AppError } from '../utils/errors';

export const MATCH_TIME_ZONE_ID = MATCH_TIME_ZONE;

export function berlinLocalStartToDate(
  localDate: string,
  localTime: string
): Date {
  const [year, month, day] = localDate.split('-').map(Number);
  const [hour, minute] = localTime.split(':').map(Number);

  try {
    const zonedDateTime = Temporal.ZonedDateTime.from(
      {
        timeZone: MATCH_TIME_ZONE_ID,
        calendar: 'iso8601',
        year,
        month,
        day,
        hour,
        minute,
        second: 0,
        millisecond: 0,
      },
      {
        disambiguation: 'reject',
        overflow: 'reject',
      }
    );
    return new Date(zonedDateTime.epochMilliseconds);
  } catch (error) {
    if (error instanceof RangeError) {
      throw AppError.validation(
        'Match start must be a valid, unambiguous Europe/Berlin local time'
      );
    }
    throw error;
  }
}

export function dateToBerlinLocalStart(startAt: Date): Api.MatchLocalStart {
  const zonedDateTime = Temporal.Instant.fromEpochMilliseconds(
    startAt.getTime()
  ).toZonedDateTimeISO(MATCH_TIME_ZONE_ID);

  return {
    date: zonedDateTime.toPlainDate().toString(),
    time: `${String(zonedDateTime.hour).padStart(2, '0')}:${String(
      zonedDateTime.minute
    ).padStart(2, '0')}`,
    timeZone: MATCH_TIME_ZONE_ID,
  };
}
