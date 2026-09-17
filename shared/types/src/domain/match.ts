import { z } from 'zod';
import {
  LineupPosition,
  MatchAvailabilityParticipation,
  MatchDirection,
} from '../core/enums';
import type { MatchLineupEntry } from './lineup';

export namespace Domain {
  export interface MatchResult {
    homeScore: number;
    awayScore: number;
    note?: string;
  }

  export interface MatchAvailabilityEntry {
    playerId: string;
    participation: MatchAvailabilityParticipation;
  }

  export interface MatchAvailabilityState {
    participation: MatchAvailabilityParticipation;
  }

  export interface MatchCore {
    id: string;
    version: number;
    teamId: string;
    opponentName: string;
    direction: MatchDirection;
    startAt: Date;
    location: string;
    arrivalGuidance?: string;
    result?: MatchResult;
    createdById: string;
    createdAt: Date;
    updatedAt: Date;
    isDemoScratch?: boolean;
  }

  export interface MatchRelations {
    lineup: MatchLineupEntry[];
    availability: MatchAvailabilityEntry[];
  }

  export type Match = MatchCore & MatchRelations;
}

const resultSchema = z.object({
  homeScore: z.number().int().min(0),
  awayScore: z.number().int().min(0),
  note: z.string().optional(),
});

const lineupEntrySchema = z.object({
  position: z.enum(LineupPosition),
  playerId: z.string(),
  playerNameSnapshot: z.string().min(1),
});

const availabilityEntrySchema = z.object({
  playerId: z.string(),
  participation: z.enum(MatchAvailabilityParticipation),
});

const relationsSchema = z.object({
  lineup: z.array(lineupEntrySchema),
  availability: z.array(availabilityEntrySchema),
});

export const MatchSchema = {
  result: resultSchema,
  lineupEntry: lineupEntrySchema,
  availabilityEntry: availabilityEntrySchema,
  core: z.object({
    id: z.string(),
    version: z.number().int().min(0),
    teamId: z.string(),
    opponentName: z.string(),
    direction: z.enum(MatchDirection),
    startAt: z.date(),
    location: z.string(),
    arrivalGuidance: z.string().optional(),
    result: resultSchema.optional(),
    createdById: z.string(),
    createdAt: z.date(),
    updatedAt: z.date(),
    isDemoScratch: z.boolean().optional(),
  }),
  relations: relationsSchema,
  match: z
    .object({
      id: z.string(),
      version: z.number().int().min(0),
      teamId: z.string(),
      opponentName: z.string(),
      direction: z.enum(MatchDirection),
      startAt: z.date(),
      location: z.string(),
      arrivalGuidance: z.string().optional(),
      result: resultSchema.optional(),
      createdById: z.string(),
      createdAt: z.date(),
      updatedAt: z.date(),
      isDemoScratch: z.boolean().optional(),
    })
    .and(relationsSchema),
};

export type MatchCore = z.infer<typeof MatchSchema.core>;
export type MatchRelations = z.infer<typeof MatchSchema.relations>;
export type Match = z.infer<typeof MatchSchema.match>;

export const DEFAULT_MATCH_AVAILABILITY: Readonly<Domain.MatchAvailabilityState> =
  {
    participation: MatchAvailabilityParticipation.AVAILABLE,
  };

export function getMatchAvailability(
  entries: readonly Domain.MatchAvailabilityEntry[],
  playerId: string
): Domain.MatchAvailabilityState {
  const entry = entries.find((candidate) => candidate.playerId === playerId);
  return entry
    ? {
        participation: entry.participation,
      }
    : DEFAULT_MATCH_AVAILABILITY;
}
