import { Temporal } from '@js-temporal/polyfill';
import type {
  GuestPlayLocale,
  GuestPlayOpportunity,
} from '@club/shared-types/api/guestPlay';
import { Location } from '../models/Location';
import { AppError } from '../utils/errors';

export const GUEST_PLAY_TIME_ZONE = 'Europe/Berlin';
export const GUEST_PLAY_WINDOW_DAYS = 21;

function opportunityStart(localDate: string, localTime: string): Date {
  const [year, month, day] = localDate.split('-').map(Number);
  const [hour, minute] = localTime.split(':').map(Number);
  try {
    const zoned = Temporal.ZonedDateTime.from(
      {
        timeZone: GUEST_PLAY_TIME_ZONE,
        year,
        month,
        day,
        hour,
        minute,
      },
      { disambiguation: 'reject', overflow: 'reject' }
    );
    return new Date(zoned.epochMilliseconds);
  } catch (error) {
    if (error instanceof RangeError) {
      throw AppError.validation(
        'Guest Play opportunity must use a valid, unambiguous Europe/Berlin time'
      );
    }
    throw error;
  }
}

function localToday(now: Date): Temporal.PlainDate {
  return Temporal.Instant.fromEpochMilliseconds(now.getTime())
    .toZonedDateTimeISO(GUEST_PLAY_TIME_ZONE)
    .toPlainDate();
}

export class GuestPlayOpportunityService {
  static async list(
    locale: GuestPlayLocale,
    now = new Date()
  ): Promise<GuestPlayOpportunity[]> {
    const locations = await Location.find({ isActive: true })
      .sort({ order: 1, _id: 1 })
      .lean();
    const today = localToday(now);
    const opportunities: GuestPlayOpportunity[] = [];

    for (let offset = 0; offset < GUEST_PLAY_WINDOW_DAYS; offset += 1) {
      const date = today.add({ days: offset });
      const localDate = date.toString();
      const weekday =
        date.dayOfWeek === 7
          ? 'sunday'
          : [
              '',
              'monday',
              'tuesday',
              'wednesday',
              'thursday',
              'friday',
              'saturday',
            ][date.dayOfWeek];

      for (const location of locations) {
        for (const slot of location.timeSlots ?? []) {
          if (
            !slot.active ||
            slot.guestPlayEnabled === false ||
            slot.weekday !== weekday
          ) {
            continue;
          }
          const startAt = opportunityStart(localDate, slot.startTime);
          if (startAt <= now) continue;
          const translation = location.translations[locale];
          opportunities.push({
            locationId: location._id.toString(),
            timeSlotId: slot.id,
            localDate,
            startTime: slot.startTime,
            endTime: slot.endTime,
            startAt: startAt.toISOString(),
            locationName: translation.name,
            locationAddress: translation.address,
            participationNote: slot.note?.[locale] || undefined,
          });
        }
      }
    }

    return opportunities.sort(
      (a, b) =>
        a.startAt.localeCompare(b.startAt) ||
        a.locationName.localeCompare(b.locationName)
    );
  }

  static async resolve(
    selection: {
      locationId: string;
      timeSlotId: string;
      localDate: string;
      locale: GuestPlayLocale;
    },
    now = new Date()
  ): Promise<GuestPlayOpportunity> {
    const option = (await this.list(selection.locale, now)).find(
      (candidate) =>
        candidate.locationId === selection.locationId &&
        candidate.timeSlotId === selection.timeSlotId &&
        candidate.localDate === selection.localDate
    );
    if (!option) {
      throw AppError.validation(
        'The selected Guest Play opportunity is no longer available'
      );
    }
    return option;
  }
}
