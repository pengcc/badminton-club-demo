import { z } from 'zod';
import { Domain, MatchSchema } from '../domain/match';
import { MatchStatus, LineupPosition } from '../core/enums';
import { BaseLineupPlayer } from '../core/base';

/**
 * API layer types for Match
 * Serializes Domain.Match for transport (Date → ISO string)
 */
export namespace Api {
  // Match metadata for API responses
  export interface MatchMetadata {
    formattedDate: string; // e.g., "January 15, 2025"
    statusBadge: {
      text: string;
      color: string;
    };
    availablePlayerCount: number;
    totalPlayerCount: number;
  }

  // API response type - converts Date to ISO string
  export interface MatchResponse {
    id: string;
    date: string; // ISO string for JSON serialization
    time: string;
    location: string;
    status: MatchStatus;
    homeTeamId: string;
    awayTeamName: string;
    createdById: string;
    scores?: {
      homeScore: number;
      awayScore: number;
    };
    cancellationReason?: string;
    lineup: Record<LineupPosition, BaseLineupPlayer[]>;
    unavailablePlayers: string[];
    metadata: MatchMetadata; // Computed metadata
    createdAt: string; // ISO string for JSON serialization
    updatedAt: string; // ISO string for JSON serialization
  }

  // List response
  export interface MatchListResponse {
    items: MatchResponse[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }

  // Create request
  export interface CreateMatchRequest {
    date: string; // ISO date string
    time: string;
    location: string;
    homeTeamId: string;
    awayTeamName: string;
    createdById: string;
    lineup?: Record<LineupPosition, BaseLineupPlayer[]>;
  }

  // Update request
  export interface UpdateMatchRequest {
    date?: string;
    time?: string;
    location?: string;
    status?: string;
    awayTeamName?: string;
    scores?: {
      homeScore: number;
      awayScore: number;
    };
    cancellationReason?: string;
    lineup?: Record<LineupPosition, BaseLineupPlayer[]>;
    unavailablePlayers?: string[];
  }

  // Query parameters
  export interface MatchQueryParams {
    page?: number;
    limit?: number;
    status?: MatchStatus;
    teamId?: string;
    playerId?: string;
    fromDate?: string;
    toDate?: string;
  }

  // URL parameters
  export interface MatchUrlParams {
    id: string;
    matchId?: string; // Deprecated - use id instead
  }
}

/**
 * API validation schemas (extend domain schemas)
 */
export const ApiSchemas = {
  createMatch: z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    time: z.string(),
    location: z.string(),
    homeTeamId: z.string(),
    awayTeamName: z.string(),
    createdById: z.string(),
    lineup: z.record(z.enum(LineupPosition), z.array(
      z.object({
        id: z.string(),
        firstName: z.string(),
        lastName: z.string(),
        gender: z.string()
      })
    )).optional()
  }),

  updateMatch: z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    time: z.string().optional(),
    location: z.string().optional(),
    status: z.enum(MatchStatus).optional(),
    awayTeamName: z.string().optional(),
    scores: z.object({
      homeScore: z.number().int().min(0),
      awayScore: z.number().int().min(0)
    }).optional(),
    lineup: z.record(z.enum(LineupPosition), z.array(
      z.object({
        id: z.string(),
        firstName: z.string(),
        lastName: z.string(),
        gender: z.string()
      })
    )).optional(),
    unavailablePlayers: z.array(z.string()).optional()
  }),

  queryParams: z.object({
    page: z.number().int().min(1).optional(),
    limit: z.number().int().min(1).max(100).optional(),
    status: z.enum(MatchStatus).optional(),
    teamId: z.string().optional(),
    playerId: z.string().optional(),
    fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
  }),

  urlParams: z.object({
    id: z.string()
  })
};