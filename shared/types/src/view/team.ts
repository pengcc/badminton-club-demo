import type { Api } from '../api/team';
import type { TeamLevel } from '../core/enums';
import { z } from 'zod';

/**
 * View layer types for Team components
 */
export namespace TeamView {
  // Base team display type
  export interface TeamDisplay extends Api.TeamResponse {
    playerCount: number;
    captainName?: string;
  }

  // Team details for profile view
  export interface TeamCard extends TeamDisplay {
    players: {
      id: string;
      name: string;
    }[];
  }

  // Form data for create/edit
  export interface TeamFormData {
    teamId: string;
    shortName: string;
    leagueTeamName: string;
    matchLevel: TeamLevel;
  }

  // Team list state
  export interface TeamListState {
    items: TeamCard[];
    filters: {
      search?: string;
      playerId?: string;
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
  teamForm: z.object({
    teamId: z.string(),
    shortName: z.string().min(2).max(100),
    leagueTeamName: z.string().max(100),
    playerIds: z.array(z.string()),
  }),
};
