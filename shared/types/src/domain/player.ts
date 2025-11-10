import { z } from 'zod';
import { PlayerPosition } from '../core/enums';

/**
 * Player Domain Types - Sports Management Entity
 *
 * Player is a separate entity linked to User via userId.
 * Every Player must have a corresponding User.
 * User.isPlayer flag controls Player entity lifecycle.
 */
export namespace Domain {
  export interface Player {
    id: string;                    // Standard field - unique identifier
    // Required user association
    userId: string;                // References User.id
    // Sports management fields
    singlesRanking: number;        // Ranking for singles play (0-5000)
    doublesRanking: number;        // Ranking for doubles play (0-5000)
    preferredPositions?: PlayerPosition[];
    isActivePlayer: boolean;       // Controls availability for team selection
    // Team relationships (stored)
    teamIds: string[];             // Direct team memberships
    // Match history (COMPUTED from Match.lineup - not stored)
    // Use PlayerService.getPlayerMatches() to populate
    matchIds?: string[];
    createdAt: Date;               // Standard field - audit timestamp
    updatedAt: Date;               // Standard field - audit timestamp
  }
}

/**
 * Player validation schemas with business rules
 */
export const PlayerSchema = {
  // Domain schema for Player entity
  player: z.object({
    id: z.string().optional(),
    userId: z.string().uuid(),
    singlesRanking: z.number().min(0, 'Singles ranking must be at least 0').max(5000, 'Singles ranking cannot exceed 5000'),
    doublesRanking: z.number().min(0, 'Doubles ranking must be at least 0').max(5000, 'Doubles ranking cannot exceed 5000'),
    preferredPositions: z.array(z.enum(PlayerPosition)).optional(),
    isActivePlayer: z.boolean(),
    teamIds: z.array(z.string().uuid()),
    matchIds: z.array(z.string().uuid()).optional(), // Computed field
    createdAt: z.date().optional(),
    updatedAt: z.date().optional()
  }),

  // Validation for create operations (without id and timestamps)
  create: z.object({
    userId: z.string().uuid(),
    singlesRanking: z.number().min(0).max(5000).default(0),
    doublesRanking: z.number().min(0).max(5000).default(0),
    preferredPositions: z.array(z.enum(PlayerPosition)).optional(),
    isActivePlayer: z.boolean().default(true),
    teamIds: z.array(z.string().uuid()).default([])
  }),

  // Validation for update operations (all fields optional except constraints)
  update: z.object({
    singlesRanking: z.number().min(0).max(5000).optional(),
    doublesRanking: z.number().min(0).max(5000).optional(),
    preferredPositions: z.array(z.enum(PlayerPosition)).optional(),
    isActivePlayer: z.boolean().optional(),
    teamIds: z.array(z.string().uuid()).optional()
  })
};

/**
 * Type inference helpers
 */
export type Player = z.infer<typeof PlayerSchema.player>;
