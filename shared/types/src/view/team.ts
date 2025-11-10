import { Api } from '../api/team';
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
    name: string;
    matchLevel: string;
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
    name: z.string().min(2).max(100),
    playerIds: z.array(z.string())
  })
};