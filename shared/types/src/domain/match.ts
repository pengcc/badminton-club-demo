import { z } from 'zod';
import { MatchStatus, LineupPosition } from '../core/enums';
import { BaseLineupPlayer } from '../core/base';

/**
 * Core match domain types - pure business logic without infrastructure concerns
 */
export namespace Domain {
  export interface MatchCore {
    id: string; // Standard field - unique identifier
    date: Date;
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
    createdAt: Date; // Standard field - audit timestamp
    updatedAt: Date; // Standard field - audit timestamp
  }

  export interface MatchRelations {
    lineup: Record<LineupPosition, BaseLineupPlayer[]>; // References players (User ids where isPlayer: true)
    unavailablePlayers: string[]; // User ids of unavailable players
  }

  export type Match = MatchCore & MatchRelations;
}

/**
 * Match validation schemas
 */
export const MatchSchema = {
  scores: z.object({
    homeScore: z.number().int().min(0),
    awayScore: z.number().int().min(0)
  }),

  lineupPlayer: z.object({
    id: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    gender: z.string()
  }),

  core: z.object({
    id: z.string(),
    date: z.date(),
    time: z.string(),
    location: z.string(),
    status: z.enum(MatchStatus),
    homeTeamId: z.string(),
    awayTeamName: z.string(),
    createdById: z.string(),
    scores: z.object({
      homeScore: z.number().int().min(0),
      awayScore: z.number().int().min(0)
    }).optional(),
    createdAt: z.date(),
    updatedAt: z.date()
  }),

  relations: z.object({
    lineup: z.record(z.enum(LineupPosition), z.array(
      z.object({
        id: z.string(),
        firstName: z.string(),
        lastName: z.string(),
        gender: z.string()
      })
    )),
    unavailablePlayers: z.array(z.string())
  }),

  // Combined schema
  match: z.object({
    id: z.string(),
    date: z.date(),
    time: z.string(),
    location: z.string(),
    status: z.enum(MatchStatus),
    homeTeamId: z.string(),
    awayTeamName: z.string(),
    createdById: z.string(),
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
    )),
    unavailablePlayers: z.array(z.string()),
    createdAt: z.date(),
    updatedAt: z.date()
  })
};

/**
 * Type inference helpers
 */
export type MatchCore = z.infer<typeof MatchSchema.core>;
export type MatchRelations = z.infer<typeof MatchSchema.relations>;
export type Match = z.infer<typeof MatchSchema.match>;