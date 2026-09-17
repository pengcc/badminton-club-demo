import type {
  TasterSessionLocale,
  TasterSessionPlayerLevel,
  TasterSessionStatus,
} from '../api/tasterSessionRequest';

export const TASTER_SESSION_TIME_ZONE = 'Europe/Berlin' as const;

const LOCALE_TAGS: Record<TasterSessionLocale, string> = {
  de: 'de-DE',
  en: 'en-GB',
  zh: 'zh-CN',
};

export interface TasterSessionPreferencePresentation {
  date: string;
  time: string;
  dateTime: string;
}

export function formatTasterSessionPreferenceInstant(
  value: string | Date,
  locale: TasterSessionLocale
): TasterSessionPreferencePresentation {
  const instant = value instanceof Date ? value : new Date(value);
  const localeTag = LOCALE_TAGS[locale];
  const dateOptions: Intl.DateTimeFormatOptions = {
    timeZone: TASTER_SESSION_TIME_ZONE,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  };
  const timeOptions: Intl.DateTimeFormatOptions = {
    timeZone: TASTER_SESSION_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
  };

  return {
    date: new Intl.DateTimeFormat(localeTag, dateOptions).format(instant),
    time: new Intl.DateTimeFormat(localeTag, timeOptions).format(instant),
    dateTime: new Intl.DateTimeFormat(localeTag, {
      ...dateOptions,
      ...timeOptions,
    }).format(instant),
  };
}

export function formatTasterSessionPreferenceDetails(
  value: string | Date,
  locationName: string,
  locale: TasterSessionLocale
): string {
  const { dateTime } = formatTasterSessionPreferenceInstant(value, locale);
  return `${dateTime} · ${locationName}`;
}

export function formatTasterSessionLocalDate(
  localDate: string,
  locale: TasterSessionLocale
): string {
  return new Intl.DateTimeFormat(LOCALE_TAGS[locale], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${localDate}T12:00:00Z`));
}

export interface StoredTasterSessionPreferencePresentation {
  startsAt: string | Date;
  locationName: string;
  locationAddress?: string;
  localDate?: string;
  startTime?: string;
  endTime?: string;
  participationNote?: string;
}

export function formatStoredTasterSessionPreferenceDetails(
  preference: StoredTasterSessionPreferencePresentation,
  locale: TasterSessionLocale
): string {
  if (preference.localDate && preference.startTime && preference.endTime) {
    return [
      `${formatTasterSessionLocalDate(preference.localDate, locale)} · ${preference.startTime}–${preference.endTime}`,
      preference.locationName,
      preference.locationAddress,
      preference.participationNote,
    ]
      .filter(Boolean)
      .join(' · ');
  }
  return formatTasterSessionPreferenceDetails(
    preference.startsAt,
    preference.locationName,
    locale
  );
}

export interface TasterSessionRequestFilters {
  status: TasterSessionStatus | 'all';
  playerLevel: TasterSessionPlayerLevel | 'all';
  archived: 'exclude' | 'include' | 'only';
}
