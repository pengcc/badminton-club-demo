/**
 * Team Validation Schemas
 *
 * Zod schemas for team-related validation
 * Shared between frontend and backend for consistent validation
 */

import { z } from 'zod';
import { TeamLevel, TeamRole } from '../core/enums';

const objectIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, 'Must be a valid ObjectId');

const uniqueObjectIdArray = (label: string) =>
  z
    .array(objectIdSchema)
    .refine(
      (ids) => new Set(ids.map((id) => id.toLowerCase())).size === ids.length,
      {
        message: `${label} must contain unique identifiers`,
      }
    );

/**
 * Team ID validation schema
 */
const teamIdSchema = z
  .string()
  .regex(/^[a-z0-9]+$/, 'Team ID must be lowercase alphanumeric')
  .max(10, 'Team ID must be less than 10 characters');

/**
 * Team short name validation schema
 */
const teamShortNameSchema = z
  .string()
  .min(2, 'Team short name is required')
  .max(50, 'Team short name must be less than 50 characters');

/**
 * League team name validation schema
 */
const leagueTeamNameSchema = z
  .string()
  .min(1, 'League team name is required')
  .max(100, 'League team name must be less than 100 characters');

/**
 * Match level validation schema
 */
export const teamMatchLevelSchema = z.nativeEnum(TeamLevel);

/**
 * Create team schema
 */
export const createTeamSchema = z.object({
  teamId: teamIdSchema,
  shortName: teamShortNameSchema,
  leagueTeamName: leagueTeamNameSchema,
  matchLevel: teamMatchLevelSchema,
});

/**
 * Update team schema
 */
export const updateTeamSchema = z.object({
  shortName: teamShortNameSchema.optional(),
  leagueTeamName: leagueTeamNameSchema.optional(),
  matchLevel: teamMatchLevelSchema.optional(),
});

/**
 * Update player role in team schema
 */
export const updatePlayerRoleSchema = z.object({
  playerId: z.string().min(1, 'Player ID is required'),
  role: z.nativeEnum(TeamRole),
});

/**
 * Batch update players schema
 */
export const batchUpdatePlayersSchema = z
  .object({
    playerIds: uniqueObjectIdArray('playerIds')
      .min(1, 'At least one Player is required')
      .max(50, 'Maximum 50 Players per batch operation'),
    updates: z
      .object({
        singlesRanking: z.number().min(0).max(5000).optional(),
        doublesRanking: z.number().min(0).max(5000).optional(),
        singlesRankingOffset: z.number().optional(),
        doublesRankingOffset: z.number().optional(),
        addToTeams: uniqueObjectIdArray('addToTeams').optional(),
        removeFromTeams: uniqueObjectIdArray('removeFromTeams').optional(),
      })
      .strict(),
  })
  .strict()
  .superRefine(({ updates }, context) => {
    const addToTeams = updates.addToTeams ?? [];
    const removeFromTeams = updates.removeFromTeams ?? [];
    const hasTeamUpdates = addToTeams.length > 0 || removeFromTeams.length > 0;
    const hasRankingUpdates =
      updates.singlesRanking !== undefined ||
      updates.doublesRanking !== undefined ||
      updates.singlesRankingOffset !== undefined ||
      updates.doublesRankingOffset !== undefined;

    if (!hasTeamUpdates && !hasRankingUpdates) {
      context.addIssue({
        code: 'custom',
        path: ['updates'],
        message: 'At least one update is required',
      });
    }

    if (hasTeamUpdates && hasRankingUpdates) {
      context.addIssue({
        code: 'custom',
        path: ['updates'],
        message:
          'Team association changes cannot be combined with ranking changes',
      });
    }

    const removedTeams = new Set(
      removeFromTeams.map((teamId) => teamId.toLowerCase())
    );
    if (addToTeams.some((teamId) => removedTeams.has(teamId.toLowerCase()))) {
      context.addIssue({
        code: 'custom',
        path: ['updates'],
        message: 'Team additions and removals must not overlap',
      });
    }
  });

/**
 * Team filter schema
 */
export const teamFilterSchema = z.object({
  playerId: z.string().optional(),
  matchLevel: teamMatchLevelSchema.optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});

// Type exports for TypeScript
export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
export type UpdatePlayerRoleInput = z.infer<typeof updatePlayerRoleSchema>;
export type BatchUpdatePlayersInput = z.infer<typeof batchUpdatePlayersSchema>;
export type TeamFilterInput = z.infer<typeof teamFilterSchema>;
