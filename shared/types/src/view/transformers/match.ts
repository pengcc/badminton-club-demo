import type { Api } from '../../api/match';
import { MATCH_TIME_ZONE } from '../../api/match';
import type { MatchView } from '../match';

function berlinDate(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: MATCH_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function nextIsoDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return next.toISOString().slice(0, 10);
}

function dayDifference(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) /
      86_400_000
  );
}

export const MatchViewTransformers = {
  toMatchCard(
    match: Api.MatchResponse,
    clubTeamName = '',
    now = new Date()
  ): MatchView.MatchCard {
    const today = berlinDate(now);
    const difference = dayDifference(today, match.localStart.date);
    return {
      ...match,
      clubTeamName,
      scoreDisplay: match.result
        ? `${match.result.homeScore} - ${match.result.awayScore}`
        : '—',
      dateTimeDisplay: `${match.localStart.date} ${match.localStart.time}`,
      isUpcoming: Date.parse(match.startAt) > now.getTime(),
      isToday: match.localStart.date === today,
      isTomorrow: match.localStart.date === nextIsoDate(today),
      daysRemaining: difference,
    };
  },

  toMatchDetails(
    match: Api.MatchDetailResponse,
    clubTeamName = ''
  ): MatchView.MatchDetails {
    return {
      ...match,
      clubTeamName,
      scoreDisplay: match.result
        ? `${match.result.homeScore} - ${match.result.awayScore}`
        : '—',
      lineupWarnings: match.lineupWarnings,
    };
  },

  toCreateRequest(formData: MatchView.MatchFormData): Api.CreateMatchRequest {
    const arrivalGuidance = formData.arrivalGuidance.trim();
    const { arrivalGuidance: _ignored, ...baseFormData } = formData;
    return {
      ...baseFormData,
      ...(arrivalGuidance ? { arrivalGuidance } : {}),
    };
  },

  toUpdateRequest(
    formData: MatchView.MatchFormData,
    expectedVersion: number
  ): Api.UpdateMatchRequest {
    const arrivalGuidance = formData.arrivalGuidance.trim();
    const { arrivalGuidance: _ignored, ...baseFormData } = formData;
    return {
      expectedVersion,
      ...baseFormData,
      ...(arrivalGuidance ? { arrivalGuidance } : {}),
    };
  },
};
