import type { MatchOutcome } from '@club/shared-types/core/enums';

export function formatMatchDate(
  localDate: string,
  options: {
    includeWeekday?: boolean;
    locale?: string;
  } = {}
): string {
  const { includeWeekday = false, locale = 'de-DE' } = options;
  const date = new Date(`${localDate}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return localDate;

  return new Intl.DateTimeFormat(locale, {
    ...(includeWeekday ? { weekday: 'long' as const } : {}),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'UTC',
  }).format(date);
}

export function getResultBadgeClassName(result?: MatchOutcome): string {
  switch (result) {
    case 'win':
      return 'bg-green-100 text-green-800';
    case 'loss':
      return 'bg-red-100 text-red-800';
    case 'draw':
      return 'bg-yellow-100 text-yellow-800';
    default:
      return 'bg-muted text-muted-foreground';
  }
}
