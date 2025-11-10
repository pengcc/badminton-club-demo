import { z } from 'zod';
import type { Api } from '../api/player';
import type { PlayerPosition } from '../core/enums';

/**
 * View layer types for Player components
 */
export namespace PlayerView {
  // Base player display type
  export interface PlayerDisplay extends Api.PlayerResponse {
    displayName: string;
    statusBadge?: {
      label: string;
      color: 'success' |'default';
    };
  }

  // Player card type for list views
  export interface PlayerCard extends PlayerDisplay {
    stats?: {
      gamesPlayed: number;
    };
    teams: {
      id: string;
      name: string;
      role: 'captain' | 'member';
    }[];
  }

  // Player details for profile view
  export interface PlayerProfile extends PlayerDisplay {
    contactInfo: {
      email: string;
      phone?: string;
    };
    stats?: {
      gamesPlayed: number;
    };
    recentMatches?: {
      id: string;
      date: string;
      opponent: string;
      result: 'win' | 'loss';
      score: string;
    }[];
  }

  // Form data for edit
  export interface PlayerFormData {
    preferredPositions?: PlayerPosition[];
    isActivePlayer: boolean;
    teamIds: string[];
  }

  // Player search/filter options
  export interface PlayerFilterOptions {
    teams: { id: string; name: string }[];
    positions: { value: string; label: string }[];
    sortOptions: { value: string; label: string }[];
  }

  // Player list view state
  export interface PlayerListState {
    items: PlayerCard[];
    filters: {
      team?: string;
      position?: string;
      status?: 'active' | 'inactive';
      search?: string;
      sort?: string;
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
  playerForm: z.object({
    firstName: z.string().min(2).max(50),
    lastName: z.string().min(2).max(50),
    gender: z.string().min(2).max(50),
    phone: z.string().regex(/^\+?[\d\s-()]+$/).optional(),
    preferredPosition: z.string().optional(),
    isActivePlayer: z.boolean(),
    teamIds: z.array(z.string())
  }),

  filters: z.object({
    team: z.string().optional(),
    position: z.string().optional(),
    status: z.enum(['active', 'inactive']).optional(),
    search: z.string().optional(),
    sort: z.string().optional()
  })
};