import { z } from 'zod';
import { Domain, PlayerSchema } from '../domain/player';
import { PlayerPosition } from '../core/enums';

/**
 * API layer types for Player
 * Serializes Domain.Player for transport (Date → ISO string)
 */
export namespace Api {
  // API response type - converts Date to ISO string
  export interface PlayerResponse {
    id: string;
    userId: string;                // Reference to User

    // User info (populated from User)
    userName: string;              // Computed from user's firstName/lastName
    userEmail: string;
    userGender?: string;           // Gender from User entity

    // Player-specific fields
    singlesRanking: number;        // Ranking for singles play (0-5000)
    doublesRanking: number;        // Ranking for doubles play (0-5000)
    rankingDisplay: string;        // COMPUTED: "singlesRanking/doublesRanking"
    preferredPositions?: PlayerPosition[];
    isActivePlayer: boolean;

    // Relationships
    teamIds: string[];
    matchCount: number;            // Computed from matchIds.length

    createdAt: string;             // ISO string for JSON serialization
    updatedAt: string;             // ISO string for JSON serialization
  }

  // List response
  export interface PlayerListResponse {
    items: PlayerResponse[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }

  // Create request
  export interface CreatePlayerRequest {
    userId: string;                // Must reference valid User with isPlayer: true
    singlesRanking?: number;
    doublesRanking?: number;
    preferredPositions?: PlayerPosition[];
    isActivePlayer?: boolean;
    teamIds?: string[];
  }

  // Update request
  export interface UpdatePlayerRequest {
    singlesRanking?: number;
    doublesRanking?: number;
    preferredPositions?: PlayerPosition[];
    isActivePlayer?: boolean;
    teamIds?: string[];
  }

  // Query parameters
  export interface PlayerQueryParams {
    page?: number;
    limit?: number;
    teamId?: string;
    isActivePlayer?: boolean;
  }

  // URL parameters
  export interface PlayerUrlParams {
    id: string;
  }
}

/**
 * API validation schemas
 */
export const ApiSchemas = {
  createPlayer: z.object({
    userId: z.string().uuid(),
    singlesRanking: z.number().min(0).max(5000).optional(),
    doublesRanking: z.number().min(0).max(5000).optional(),
    ranking: z.number().min(0).max(1000).optional(), // @deprecated
    preferredPositions: z.array(z.enum(PlayerPosition)).optional(),
    isActivePlayer: z.boolean().optional(),
    teamIds: z.array(z.string().uuid()).optional()
  }),

  updatePlayer: z.object({
    singlesRanking: z.number().min(0).max(5000).optional(),
    doublesRanking: z.number().min(0).max(5000).optional(),
    ranking: z.number().min(0).max(1000).optional(), // @deprecated
    preferredPositions: z.array(z.enum(PlayerPosition)).optional(),
    isActivePlayer: z.boolean().optional(),
    teamIds: z.array(z.string().uuid()).optional()
  }),

  queryParams: z.object({
    page: z.number().int().min(1).optional(),
    limit: z.number().int().min(1).max(100).optional(),
    teamId: z.string().optional(),
    isActivePlayer: z.boolean().optional()
  }),

  urlParams: z.object({
    id: z.string()
  })
};
