import { z } from 'zod';
import {
  Gender,
  LineupPosition,
  LineupViolationCode,
  MatchAvailabilityParticipation,
  MatchDirection,
  MatchListView,
} from '../core/enums';
import {
  MATCH_ARRIVAL_GUIDANCE_MAX_LENGTH,
  MATCH_RESULT_NOTE_MAX_LENGTH,
} from '../api/match';

const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, 'Invalid identifier');

function isRealIsoDate(value: string): boolean {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
  .refine(isRealIsoDate, 'Date must be a real calendar date');

const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be in HH:mm format');

const versionSchema = z
  .number()
  .int('Expected version must be an integer')
  .min(0, 'Expected version must not be negative');

const teamIdSchema = objectIdSchema;
const opponentNameSchema = z.string().trim().min(1).max(100);
const locationSchema = z.string().trim().min(2).max(100);
const arrivalGuidanceSchema = z
  .string()
  .trim()
  .max(MATCH_ARRIVAL_GUIDANCE_MAX_LENGTH)
  .optional()
  .transform((value) => value || undefined);

const baseMatchFields = {
  teamId: teamIdSchema,
  opponentName: opponentNameSchema,
  direction: z.enum(MatchDirection),
  localDate: dateSchema,
  localTime: timeSchema,
  location: locationSchema,
  arrivalGuidance: arrivalGuidanceSchema,
};

export const createMatchSchema = z.object(baseMatchFields).strict();

export const updateMatchSchema = z
  .object({
    expectedVersion: versionSchema,
    ...baseMatchFields,
  })
  .strict();

export const deleteMatchSchema = z
  .object({ expectedVersion: versionSchema })
  .strict();

export const setMatchResultSchema = z
  .object({
    expectedVersion: versionSchema,
    homeScore: z.number().int().min(0),
    awayScore: z.number().int().min(0),
    note: z
      .string()
      .trim()
      .max(MATCH_RESULT_NOTE_MAX_LENGTH)
      .optional()
      .transform((value) => value || undefined),
  })
  .strict();

export const setOwnMatchAvailabilitySchema = z
  .object({
    expectedVersion: versionSchema,
    participation: z.enum(MatchAvailabilityParticipation),
  })
  .strict();

export const setPlayerMatchAvailabilitySchema = setOwnMatchAvailabilitySchema;

export const matchListQuerySchema = z
  .object({
    view: z.enum(MatchListView).default(MatchListView.ALL),
  })
  .strict();

export const matchCsvImportFieldsSchema = z
  .object({
    teamId: teamIdSchema,
  })
  .strict();

export const lineupEntrySchema = z
  .object({
    position: z.enum(LineupPosition),
    playerId: objectIdSchema,
    playerNameSnapshot: z.string().trim().min(1).max(200),
  })
  .strict();

export const lineupWarningSchema = z
  .object({
    code: z.enum(LineupViolationCode),
    position: z.enum(LineupPosition).optional(),
    playerId: objectIdSchema.optional(),
    positions: z.array(z.enum(LineupPosition)).optional(),
    playerIds: z.array(objectIdSchema).optional(),
  })
  .strict();

export const lineupCandidateSchema = z
  .object({
    playerId: objectIdSchema,
    playerName: z.string().trim().min(1).max(200),
    gender: z.enum(Gender),
    singlesRanking: z.number().min(0).max(5000),
    doublesRanking: z.number().min(0).max(5000),
    participation: z.enum(MatchAvailabilityParticipation),
  })
  .strict();

export const updateLineupSchema = z
  .object({
    expectedVersion: versionSchema,
    lineup: z.array(
      z
        .object({
          position: z.enum(LineupPosition),
          playerId: objectIdSchema,
        })
        .strict()
    ),
  })
  .strict();

export const lineupContextSchema = z
  .object({
    matchId: objectIdSchema,
    version: versionSchema,
    lineup: z.array(lineupEntrySchema),
    lineupWarnings: z.array(lineupWarningSchema),
    candidates: z.array(lineupCandidateSchema),
  })
  .strict();

export type CreateMatchInput = z.infer<typeof createMatchSchema>;
export type UpdateMatchInput = z.infer<typeof updateMatchSchema>;
export type DeleteMatchInput = z.infer<typeof deleteMatchSchema>;
export type SetMatchResultInput = z.infer<typeof setMatchResultSchema>;
export type SetOwnMatchAvailabilityInput = z.infer<
  typeof setOwnMatchAvailabilitySchema
>;
export type SetPlayerMatchAvailabilityInput = z.infer<
  typeof setPlayerMatchAvailabilitySchema
>;
export type MatchListQueryInput = z.infer<typeof matchListQuerySchema>;
export type MatchCsvImportFieldsInput = z.infer<
  typeof matchCsvImportFieldsSchema
>;
export type UpdateLineupInput = z.infer<typeof updateLineupSchema>;
