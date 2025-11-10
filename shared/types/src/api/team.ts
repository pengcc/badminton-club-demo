import { z } from 'zod';
import { Domain, TeamSchema } from '../domain/team';

/**
 * API layer types for Team
 * Serializes Domain.Team for transport (Date → ISO string)
 *
 * PHASE 3 ARCHITECTURE (Unidirectional):
 * - playerIds is COMPUTED by backend from Player.teamIds (not stored in Team schema)
 * - Backend computes playerIds on-demand for API responses
 * - Use Player endpoints (/players/:playerId/teams/:teamId) for roster changes
 */
export namespace Api {
  // Team statistics for API responses
  export interface TeamStats {
    playerCount: number;
    activePlayerCount: number;
  }

  // API response type - converts Date to ISO string
  export interface TeamResponse {
    id: string;
    name: string;
    matchLevel: string; // "C" or "F"
    createdById: string;
    stats?: {
        playerCount: number,
        activePlayerCount: number,
      },
    playerIds: string[]; // COMPUTED: Backend queries Player.teamIds to build this array
    createdAt: string; // ISO string for JSON serialization
    updatedAt: string; // ISO string for JSON serialization
  }

  // List response
  export interface TeamListResponse {
    items: TeamResponse[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }

  // Create request
  export interface CreateTeamRequest {
    name: string;
    matchLevel: string;
    createdById: string;
    // playerIds removed - use Player endpoints to add players to teams
  }

  // Update request
  export interface UpdateTeamRequest {
    name?: string;
    matchLevel?: string;
    // playerIds removed - use Player endpoints for roster changes
    updatedById: string;
  }

  // Query parameters
  export interface TeamQueryParams {
    page?: number;
    limit?: number;
    playerId?: string;
    matchLevel?: string;
  }

  // URL parameters
  export interface TeamUrlParams {
    id: string;
  }
}

/**
 * API validation schemas (extend domain schemas)
 */
export const ApiSchemas = {
  createTeam: z.object({
    name: z.string().min(2).max(100),
    matchLevel: z.string(),
    createdById: z.string(),
    playerIds: z.array(z.string()).optional()
  }),

  updateTeam: z.object({
    name: z.string().min(2).max(100).optional(),
    matchLevel: z.string().optional(),
    playerIds: z.array(z.string()).optional()
  }),

  queryParams: z.object({
    page: z.number().int().min(1).optional(),
    limit: z.number().int().min(1).max(100).optional(),
    playerId: z.string().optional(),
    matchLevel: z.string().optional()
  }),

  urlParams: z.object({
    id: z.string()
  })
};