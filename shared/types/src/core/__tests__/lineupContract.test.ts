import { describe, expect, it } from 'vitest';
import {
  Gender,
  LineupPosition,
  LineupViolationCode,
  MatchAvailabilityParticipation,
} from '../../core/enums';
import {
  LINEUP_POSITION_DEFINITIONS,
  LINEUP_POSITION_ORDER,
} from '../../domain/lineup';
import {
  lineupCandidateSchema,
  lineupContextSchema,
  lineupEntrySchema,
  lineupWarningSchema,
  updateLineupSchema,
} from '../../schemas/match';

const playerId = '507f1f77bcf86cd799439011';
const matchId = '507f1f77bcf86cd799439012';

describe('canonical Lineup contract', () => {
  it('defines the exact eight positions in fixed order', () => {
    expect(Object.values(LineupPosition)).toEqual(LINEUP_POSITION_ORDER);
    expect(LINEUP_POSITION_ORDER).toEqual([
      LineupPosition.MEN_SINGLES_1,
      LineupPosition.MEN_SINGLES_2,
      LineupPosition.OPEN_SINGLES,
      LineupPosition.WOMEN_SINGLES,
      LineupPosition.MENS_DOUBLES,
      LineupPosition.OPEN_DOUBLES,
      LineupPosition.WOMEN_DOUBLES,
      LineupPosition.MIXED_DOUBLES,
    ]);
    expect(
      LINEUP_POSITION_ORDER.map(
        (position) => LINEUP_POSITION_DEFINITIONS[position].order
      )
    ).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it('accepts empty and partial versioned intents and rejects legacy or snapshot input', () => {
    expect(
      updateLineupSchema.parse({ expectedVersion: 2, lineup: [] })
    ).toEqual({ expectedVersion: 2, lineup: [] });
    expect(
      updateLineupSchema.parse({
        expectedVersion: 2,
        lineup: [{ position: LineupPosition.OPEN_SINGLES, playerId }],
      })
    ).toEqual({
      expectedVersion: 2,
      lineup: [{ position: LineupPosition.OPEN_SINGLES, playerId }],
    });
    expect(
      updateLineupSchema.safeParse({
        lineup: { men_singles_1: [{ id: playerId }] },
      }).success
    ).toBe(false);
    expect(
      updateLineupSchema.safeParse({
        expectedVersion: 2,
        lineup: [
          {
            position: LineupPosition.OPEN_SINGLES,
            playerId,
            playerNameSnapshot: 'Client supplied',
          },
        ],
      }).success
    ).toBe(false);
    expect(
      updateLineupSchema.safeParse({
        expectedVersion: 2,
        lineup: [{ position: 'men_singles_3', playerId }],
      }).success
    ).toBe(false);
    expect(
      updateLineupSchema.safeParse({
        expectedVersion: 2,
        lineup: [{ position: LineupPosition.OPEN_SINGLES, playerId: null }],
      }).success
    ).toBe(false);
  });

  it('validates canonical entries, warnings, candidates, and context', () => {
    const entry = lineupEntrySchema.parse({
      position: LineupPosition.OPEN_SINGLES,
      playerId,
      playerNameSnapshot: 'Ada Player',
    });
    const warning = lineupWarningSchema.parse({
      code: LineupViolationCode.PLAYER_UNAVAILABLE,
      position: LineupPosition.OPEN_SINGLES,
      playerId,
    });
    const candidate = lineupCandidateSchema.parse({
      playerId,
      playerName: 'Ada Player',
      gender: Gender.NON_BINARY,
      singlesRanking: 1200,
      doublesRanking: 1300,
      participation: MatchAvailabilityParticipation.AVAILABLE,
    });
    expect(
      lineupContextSchema.parse({
        matchId,
        version: 3,
        lineup: [entry],
        lineupWarnings: [warning],
        candidates: [candidate],
      })
    ).toMatchObject({ matchId, version: 3 });
  });
});
