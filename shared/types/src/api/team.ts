import { z } from 'zod';
import { TeamLevel } from '../core/enums';
import type { CreateTeamInput, UpdateTeamInput } from '../schemas/team';

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

  export interface TeamRosterSummary {
    total: number;
    male: number;
    female: number;
    nonBinary: number;
  }

  // API response type - converts Date to ISO string
  export interface TeamResponse {
    id: string;
    teamId: string;
    shortName: string;
    leagueTeamName: string;
    matchLevel: TeamLevel;
    createdById: string;
    stats?: {
      playerCount: number;
      activePlayerCount: number;
    };
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

  // Caller-owned create request
  export type CreateTeamRequest = CreateTeamInput;

  // Caller-owned update request
  export type UpdateTeamRequest = UpdateTeamInput;

  // Query parameters
  export interface TeamQueryParams {
    page?: number;
    limit?: number;
    playerId?: string;
    matchLevel?: TeamLevel;
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
  queryParams: z.object({
    page: z.number().int().min(1).optional(),
    limit: z.number().int().min(1).max(100).optional(),
    playerId: z.string().optional(),
    matchLevel: z.nativeEnum(TeamLevel).optional(),
  }),

  urlParams: z.object({
    id: z.string(),
  }),
};
