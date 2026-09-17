const QUARTER_ENDS = [
  [3, 31],
  [6, 30],
  [9, 30],
  [12, 31],
] as const;

export const MEMBERSHIP_TERMINATION_TIME_ZONE = 'Europe/Berlin';

export function berlinDateOnly(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: MEMBERSHIP_TERMINATION_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((value) => value.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function latestNoticeDate(year: number, month: number): string {
  return new Date(Date.UTC(year, month - 1, 0)).toISOString().slice(0, 10);
}

export function eligibleMembershipTerminationDates({
  requestedAt,
  evaluatedAt,
  limit = 8,
}: {
  requestedAt: Date;
  evaluatedAt: Date;
  limit?: number;
}): string[] {
  if (
    !Number.isFinite(requestedAt.getTime()) ||
    !Number.isFinite(evaluatedAt.getTime()) ||
    requestedAt.getTime() > evaluatedAt.getTime() ||
    limit < 1
  ) {
    return [];
  }
  const requestDate = berlinDateOnly(requestedAt);
  const evaluationDate = berlinDateOnly(evaluatedAt);
  const startYear = Number(evaluationDate.slice(0, 4));
  const dates: string[] = [];
  for (let year = startYear; dates.length < limit; year += 1) {
    for (const [month, day] of QUARTER_ENDS) {
      const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      if (
        date > evaluationDate &&
        requestDate <= latestNoticeDate(year, month)
      ) {
        dates.push(date);
      }
      if (dates.length === limit) break;
    }
  }
  return dates;
}

export function isEligibleMembershipTerminationDate(
  value: string,
  input: { requestedAt: Date; evaluatedAt: Date }
): boolean {
  if (
    !/^\d{4}-(03-31|06-30|09-30|12-31)$/.test(value) ||
    !Number.isFinite(input.requestedAt.getTime()) ||
    !Number.isFinite(input.evaluatedAt.getTime()) ||
    input.requestedAt.getTime() > input.evaluatedAt.getTime()
  ) {
    return false;
  }
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  return (
    value > berlinDateOnly(input.evaluatedAt) &&
    berlinDateOnly(input.requestedAt) <= latestNoticeDate(year, month)
  );
}
