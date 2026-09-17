import { createHash } from 'node:crypto';
import { Temporal } from '@js-temporal/polyfill';
import type {
  TasterSessionPlayerLevel,
  TasterSessionPreferenceOption,
  TasterSessionLocale,
} from '@club/shared-types/api/tasterSessionRequest';
import { Language } from '@club/shared-types/core/enums';
import { LOCATION_TASTER_SESSION_LEVELS } from '@club/shared-types/api/location';
import { Location } from '../models/Location';
import { AppError } from '../utils/errors';

const TIME_ZONE = 'Europe/Berlin';
const HORIZON_DAYS = 21;

function optionId(
  locationId: string,
  timeSlotId: string,
  startsAt: string
): string {
  return createHash('sha256')
    .update(`${locationId}:${timeSlotId}:${startsAt}`)
    .digest('hex')
    .slice(0, 24);
}

function berlinDateTime(
  date: Temporal.PlainDate,
  time: string
): Temporal.ZonedDateTime {
  const [hour, minute] = time.split(':').map(Number);
  return Temporal.ZonedDateTime.from(
    {
      timeZone: TIME_ZONE,
      calendar: 'iso8601',
      year: date.year,
      month: date.month,
      day: date.day,
      hour,
      minute,
    },
    { disambiguation: 'reject', overflow: 'reject' }
  );
}

export class TasterSessionPreferencePolicy {
  static async listOptions(
    playerLevel: TasterSessionPlayerLevel,
    locale: TasterSessionLocale,
    now = Temporal.Now.instant()
  ): Promise<TasterSessionPreferenceOption[]> {
    const locations = await Location.find({ isActive: true }).lean();
    const today = now.toZonedDateTimeISO(TIME_ZONE).toPlainDate();
    const options: TasterSessionPreferenceOption[] = [];

    for (let dayOffset = 0; dayOffset < HORIZON_DAYS; dayOffset += 1) {
      const date = today.add({ days: dayOffset });
      const weekday = [
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
        'saturday',
        'sunday',
      ][date.dayOfWeek - 1];

      for (const location of locations) {
        const translation =
          location.translations[locale as Language] ??
          location.translations[Language.ENGLISH] ??
          Object.values(location.translations)[0];
        if (!translation) continue;
        for (const slot of location.timeSlots ?? []) {
          const acceptedLevels = slot.tasterSessionAcceptedLevels ?? [
            ...LOCATION_TASTER_SESSION_LEVELS,
          ];
          if (
            !slot.active ||
            slot.tasterSessionEnabled === false ||
            slot.weekday !== weekday ||
            !acceptedLevels.includes(playerLevel)
          )
            continue;

          let start: Temporal.ZonedDateTime;
          let end: Temporal.ZonedDateTime;
          try {
            start = berlinDateTime(date, slot.startTime);
            end = berlinDateTime(date, slot.endTime);
          } catch (error) {
            if (error instanceof RangeError) {
              throw AppError.validation(
                'Taster Session preferences must use valid, unambiguous Europe/Berlin times'
              );
            }
            throw error;
          }

          if (
            Temporal.Instant.compare(start.toInstant(), now) <= 0 ||
            Temporal.ZonedDateTime.compare(end, start) <= 0
          )
            continue;

          const locationId = String(location._id);
          const startsAt = start.toInstant().toString();
          const note =
            slot.note?.[locale] ??
            slot.note?.en ??
            Object.values(slot.note ?? {}).find(Boolean);
          options.push({
            id: optionId(locationId, slot.id, startsAt),
            timeSlotId: slot.id,
            localDate: date.toString(),
            startTime: slot.startTime,
            endTime: slot.endTime,
            startsAt,
            endsAt: end.toInstant().toString(),
            location: {
              id: locationId,
              name: translation.name,
              address: translation.address,
            },
            note: note || undefined,
          });
        }
      }
    }

    return options.sort((left, right) =>
      left.startsAt.localeCompare(right.startsAt)
    );
  }

  static async validateSelection(
    playerLevel: TasterSessionPlayerLevel,
    locale: TasterSessionLocale,
    selection?: { optionId: string; startsAt: string }
  ): Promise<
    | {
        optionId: string;
        startsAt: Date;
        locationId: string;
        locationName: string;
        timeSlotId: string;
        locationAddress: string;
        localDate: string;
        startTime: string;
        endTime: string;
        participationNote?: string;
      }
    | undefined
  > {
    const options = await this.listOptions(playerLevel, locale);
    if (options.length > 0 && !selection) {
      throw AppError.validation(
        'Select one non-binding Taster Session preference'
      );
    }
    if (options.length === 0) {
      if (selection) {
        throw AppError.validation(
          'No active Taster Session preference is currently available'
        );
      }
      return undefined;
    }

    if (!selection) {
      throw AppError.validation(
        'Select one non-binding Taster Session preference'
      );
    }
    const matchingOption = options.find(
      (option) =>
        option.id === selection.optionId &&
        option.startsAt === selection.startsAt
    );
    if (!matchingOption) {
      throw AppError.validation(
        'The selected Taster Session preference is no longer available'
      );
    }
    return {
      optionId: matchingOption.id,
      startsAt: new Date(matchingOption.startsAt),
      locationId: matchingOption.location.id,
      locationName: matchingOption.location.name,
      timeSlotId: matchingOption.timeSlotId,
      locationAddress: matchingOption.location.address,
      localDate: matchingOption.localDate,
      startTime: matchingOption.startTime,
      endTime: matchingOption.endTime,
      participationNote: matchingOption.note,
    };
  }
}
