import { z } from 'zod';
import { TeamLevel } from '../core/enums';

/**
 * Core team domain types - pure business logic without infrastructure concerns
 * Club has exactly two teams: "team1" and "team2"
 *
 * PHASE 3 ARCHITECTURE (Unidirectional):
 * - Team schema does NOT store playerIds
 * - Team roster is computed from Player.teamIds (single source of truth)
 * - playerIds is only included in API responses for convenience
 */
export namespace Domain {
  export interface TeamCore {
    id: string; // Standard field - unique identifier
    name: string;
    matchLevel: TeamLevel; // C or F class
    createdById: string;
    createdAt: Date; // Standard field - audit timestamp
    updatedAt: Date; // Standard field - audit timestamp
  }

  export interface TeamRelations {
    // COMPUTED FIELD (not stored in database):
    // playerIds is computed from Player.teamIds when needed for API responses
    playerIds: string[]; // Computed from Player collection where Player.teamIds contains this team's ID
  }

  export type Team = TeamCore & TeamRelations;
}

/**
 * Team validation schemas with business rules
 */
export const TeamSchema = {
  core: z.object({
    id: z.string(),
    name: z.string().min(2).max(100),
    matchLevel: z.enum(TeamLevel),
    createdById: z.string(),
    createdAt: z.date(),
    updatedAt: z.date()
  }),

  relations: z.object({
    playerIds: z.array(z.string())
  }),

  // Combined schema
  team: z.object({
    id: z.string(),
    name: z.string().min(2).max(100),
    matchLevel: z.enum(TeamLevel),
    createdById: z.string(),
    playerIds: z.array(z.string()),
    createdAt: z.date(),
    updatedAt: z.date()
  })
};

/**
 * Type inference helpers
 */
export type TeamCore = z.infer<typeof TeamSchema.core>;
export type TeamRelations = z.infer<typeof TeamSchema.relations>;
export type Team = z.infer<typeof TeamSchema.team>;