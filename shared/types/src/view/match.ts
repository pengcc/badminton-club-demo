import { Api } from '../api/match';
import { z } from 'zod';
import { LineupPosition, MatchStatus } from '../core/enums';

/**
 * View layer types for Match components
 */
export namespace MatchView {
  // Base match display type
  export interface MatchDisplay extends Api.MatchResponse {
    statusBadge: {
      label: string;
      color: 'success' | 'warning' | 'error' | 'default';
    };
    scoreDisplay: string;
    homeTeamName: string;
  }

  // Match card for list views
  export interface MatchCard extends MatchDisplay {
    dateTimeDisplay: string;
    isUpcoming: boolean;
    isToday: boolean;
    isTomorrow: boolean;
    daysRemaining: string;
    result?: 'win' | 'loss' | 'draw';
  }

  // Match details for profile view
  export interface MatchDetails extends MatchDisplay {
    lineupDisplay: {
      [P in LineupPosition]?: {
        position: string;
        players: {
          id: string;
          name: string;
          isConfirmed: boolean;
        }[];
      };
    };
    unavailablePlayersDisplay: {
      id: string;
      name: string;
      reason?: string;
    }[];
  }

  // Form data for create/edit
  export interface MatchFormData {
    date: string;
    time: string;
    location: string;
    homeTeamId: string;
    awayTeamName: string;
    status?: MatchStatus;
    homeScore?: number;
    awayScore?: number;
    cancellationReason?: string;
    lineup: Record<LineupPosition, string[]>;
    unavailablePlayers?: string[];
  }

  // Match list state
  export interface MatchListState {
    items: MatchCard[];
    filters: {
      status?: MatchStatus;
      teamId?: string;
      playerId?: string;
      dateRange?: {
        from: string;
        to: string;
      };
    };
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
    isLoading: boolean;
    error?: string;
  }
}

/**
 * Form validation schemas
 */
export const ViewSchemas = {
  matchForm: z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    time: z.string().regex(/^\d{2}:\d{2}$/),
    location: z.string().min(2),
    homeTeamId: z.string(),
    awayTeamName: z.string(),
    lineup: z.record(z.enum(LineupPosition), z.array(z.string())),
    unavailablePlayers: z.array(z.string()).optional()
  })
};