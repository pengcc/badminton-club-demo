import type { Api } from '../../api/match';
import type { MatchView } from '../match';
import type { WithStringId, WithTimestamp } from '../../core/typeUtils';
import { MatchStatus, LineupPosition, Gender } from '../../core/enums';
import type { BaseLineupPlayer } from '../../core/base';

/**
 * Helper functions to transform between API and view layer types
 */
export const MatchViewTransformers = {
  /**
   * Transform API response to match card view
   * @param match - API match response
   * @param homeTeamName - Name of home team (looked up from teams data)
   */
  toMatchCard(match: Api.MatchResponse & WithStringId, homeTeamName: string = ''): MatchView.MatchCard {
    const matchDate = new Date(match.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const matchDateOnly = new Date(matchDate);
    matchDateOnly.setHours(0, 0, 0, 0);

    const isToday = matchDateOnly.getTime() === today.getTime();
    const isTomorrow = matchDateOnly.getTime() === tomorrow.getTime();
    const daysRemaining = calculateDaysRemaining(matchDate);
    const result = calculateResult(match.scores, match.status);

    return {
      ...match,
      statusBadge: getMatchStatusBadge(match.status),
      scoreDisplay: formatScore(match.scores),
      homeTeamName,
      dateTimeDisplay: formatDateTime(matchDate, match.time),
      isUpcoming: match.status === MatchStatus.SCHEDULED,
      isToday,
      isTomorrow,
      daysRemaining,
      result
    };
  },

  /**
   * Transform API response to match profile view
   */
  toMatchDetails(match: Api.MatchResponse & WithStringId & WithTimestamp): MatchView.MatchDetails {
    return {
      ...match,
      statusBadge: getMatchStatusBadge(match.status),
      scoreDisplay: formatScore(match.scores),
      homeTeamName: '', // To be populated from teams data
      lineupDisplay: {}, // To be populated from lineup data
      unavailablePlayersDisplay: [] // To be populated from players data
    };
  },

  /**
   * Transform form data to create match request
   */
  toCreateRequest(formData: MatchView.MatchFormData): Api.CreateMatchRequest {
    const { lineup, ...rest } = formData;
    return {
      ...rest,
      date: formData.date,
      createdById: '', // To be set by the controller
      lineup: transformLineup(lineup)
    };
  },

  /**
   * Transform form data to update match request
   */
  toUpdateRequest(formData: Partial<MatchView.MatchFormData>): Api.UpdateMatchRequest {
    const { lineup, date, homeScore, awayScore, ...rest } = formData;

    const request: Api.UpdateMatchRequest = {
      ...rest,
      date: date ? date : undefined,
      lineup: lineup ? transformLineup(lineup) : undefined
    };

    // Include scores if both homeScore and awayScore are provided
    if (homeScore !== undefined && awayScore !== undefined) {
      request.scores = {
        homeScore,
        awayScore
      };
    }

    return request;
  }
};

// Helper functions
function getMatchStatusBadge(status: MatchStatus): MatchView.MatchDisplay['statusBadge'] {
  switch (status) {
    case MatchStatus.SCHEDULED:
      return { label: 'Scheduled', color: 'default' };
    case MatchStatus.IN_PROGRESS:
      return { label: 'In Progress', color: 'warning' };
    case MatchStatus.COMPLETED:
      return { label: 'Completed', color: 'success' };
    case MatchStatus.CANCELLED:
      return { label: 'Cancelled', color: 'error' };
  }
}

function formatScore(scores?: Api.MatchResponse['scores']): string {
  if (!scores) return 'TBD';
  return `${scores.homeScore} - ${scores.awayScore}`;
}

function formatDateTime(date: Date, time: string): string {
  return `${date.toLocaleDateString()} ${time}`;
}

function calculateDaysRemaining(matchDate: Date): string {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const matchDateOnly = new Date(matchDate);
  matchDateOnly.setHours(0, 0, 0, 0);

  const diffTime = matchDateOnly.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return 'Past';
  } else if (diffDays === 0) {
    return 'Today';
  } else if (diffDays === 1) {
    return 'Tomorrow';
  } else {
    return `${diffDays} days`;
  }
}

function calculateResult(
  scores: Api.MatchResponse['scores'],
  status: MatchStatus
): 'win' | 'loss' | 'draw' | undefined {
  if (status !== MatchStatus.COMPLETED || !scores) {
    return undefined;
  }

  const { homeScore, awayScore } = scores;

  if (homeScore > awayScore) {
    return 'win';
  } else if (homeScore < awayScore) {
    return 'loss';
  } else {
    return 'draw';
  }
}

function transformLineup(
  lineup: Record<LineupPosition, string[]>
): Record<LineupPosition, BaseLineupPlayer[]> {
  const result = {} as Record<LineupPosition, BaseLineupPlayer[]>;

  // Initialize all positions with empty arrays
  Object.values(LineupPosition).forEach(position => {
    result[position] = [];
  });

  // Transform player IDs to lineup players
  // This is a placeholder - actual implementation will need to look up player details
  Object.entries(lineup).forEach(([position, playerIds]) => {
    if (position in LineupPosition) {
      result[position as LineupPosition] = playerIds.map(id => ({
        id,
        firstName: '',
        lastName: '',
        gender: Gender.MALE // Default value, should be replaced with actual player data
      }));
    }
  });

  return result;
}