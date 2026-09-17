import type { Api } from '../api/match';
import type { MatchDirection, MatchListView } from '../core/enums';

export namespace MatchView {
  export interface MatchDisplay extends Api.MatchResponse {
    clubTeamName: string;
    scoreDisplay: string;
  }

  export interface MatchCard extends MatchDisplay {
    dateTimeDisplay: string;
    isUpcoming: boolean;
    isToday: boolean;
    isTomorrow: boolean;
    daysRemaining: number;
  }

  export interface MatchDetails extends MatchDisplay {
    lineupWarnings: Api.MatchDetailResponse['lineupWarnings'];
  }

  export interface MatchFormData {
    teamId: string;
    opponentName: string;
    direction: MatchDirection;
    localDate: string;
    localTime: string;
    location: string;
    arrivalGuidance: string;
  }

  export interface MatchListState {
    items: MatchCard[];
    view: MatchListView;
    isLoading: boolean;
    error?: string;
  }
}
