import type {
  LocationTimeSlot,
  LocationWeekday,
} from '@club/shared-types/api/location';

const WEEKDAY_DATES: Record<LocationWeekday, number> = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 7,
};

export const getLocationWeekdayLabel = (
  weekday: LocationWeekday,
  locale: string
): string =>
  new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(2024, 0, WEEKDAY_DATES[weekday]))
  );

export const getLocationTimeSlotNote = (
  timeSlot: LocationTimeSlot,
  locale: string
): string | undefined => {
  const language = locale as 'de' | 'en' | 'zh';
  return (
    timeSlot.note?.[language] ||
    timeSlot.note?.en ||
    Object.values(timeSlot.note ?? {}).find(Boolean)
  );
};
