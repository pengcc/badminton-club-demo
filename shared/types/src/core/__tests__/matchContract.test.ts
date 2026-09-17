import { describe, expect, it } from 'vitest';
import {
  MatchAvailabilityParticipation,
  MatchDirection,
  MatchListView,
} from '../../core/enums';
import {
  createMatchSchema,
  deleteMatchSchema,
  matchListQuerySchema,
  matchCsvImportFieldsSchema,
  setOwnMatchAvailabilitySchema,
  setPlayerMatchAvailabilitySchema,
  setMatchResultSchema,
  updateMatchSchema,
} from '../../schemas/match';
import {
  getMatchAvailability,
  DEFAULT_MATCH_AVAILABILITY,
} from '../../domain/match';

const base = {
  teamId: '507f1f77bcf86cd799439011',
  opponentName: 'Visitors',
  direction: MatchDirection.HOME,
  localDate: '2028-02-29',
  localTime: '19:30',
  location: 'Competition Hall',
};

describe('canonical Match transport contract', () => {
  it('accepts canonical create and full versioned update inputs', () => {
    expect(createMatchSchema.parse(base)).toEqual(base);
    expect(updateMatchSchema.parse({ expectedVersion: 0, ...base })).toEqual({
      expectedVersion: 0,
      ...base,
    });
  });

  it.each([
    [{ ...base, localDate: '2027-02-29' }],
    [{ ...base, localTime: '9:30' }],
    [{ ...base, teamId: 'not-an-object-id' }],
    [{ ...base, status: 'scheduled' }],
    [{ ...base, scores: { homeScore: 1, awayScore: 0 } }],
    [{ ...base, lineup: {} }],
    [{ ...base, createdById: '507f1f77bcf86cd799439012' }],
  ])('rejects non-canonical create input %#', (input) => {
    expect(createMatchSchema.safeParse(input).success).toBe(false);
  });

  it('defaults omitted list view to all and validates explicit views', () => {
    expect(matchListQuerySchema.parse({})).toEqual({
      view: MatchListView.ALL,
    });
    expect(
      matchListQuerySchema.parse({ view: MatchListView.UPCOMING })
    ).toEqual({ view: MatchListView.UPCOMING });
    expect(matchListQuerySchema.safeParse({ view: 'scheduled' }).success).toBe(
      false
    );
  });

  it('accepts only one canonical Team ID multipart field', () => {
    expect(matchCsvImportFieldsSchema.parse({ teamId: base.teamId })).toEqual({
      teamId: base.teamId,
    });
    expect(
      matchCsvImportFieldsSchema.safeParse({ teamId: 'not-an-id' }).success
    ).toBe(false);
    expect(
      matchCsvImportFieldsSchema.safeParse({
        teamId: base.teamId,
        mapping: 'custom',
      }).success
    ).toBe(false);
  });

  it('requires non-negative integer versions for existing-Match mutations', () => {
    expect(deleteMatchSchema.parse({ expectedVersion: 2 })).toEqual({
      expectedVersion: 2,
    });
    expect(deleteMatchSchema.safeParse({ expectedVersion: -1 }).success).toBe(
      false
    );
    expect(
      setMatchResultSchema.safeParse({
        expectedVersion: 0.5,
        homeScore: 1,
        awayScore: 1,
      }).success
    ).toBe(false);
  });

  it('normalizes an empty result note to absence and permits a draw', () => {
    expect(
      setMatchResultSchema.parse({
        expectedVersion: 0,
        homeScore: 3,
        awayScore: 3,
        note: '   ',
      })
    ).toEqual({
      expectedVersion: 0,
      homeScore: 3,
      awayScore: 3,
      note: undefined,
    });
  });

  it('validates strict Player-self and administrator Availability commands', () => {
    expect(
      setOwnMatchAvailabilitySchema.parse({
        expectedVersion: 2,
        participation: MatchAvailabilityParticipation.UNAVAILABLE,
      })
    ).toEqual({
      expectedVersion: 2,
      participation: MatchAvailabilityParticipation.UNAVAILABLE,
    });
    expect(
      setPlayerMatchAvailabilitySchema.parse({
        expectedVersion: 2,
        participation: MatchAvailabilityParticipation.AVAILABLE,
      })
    ).toEqual({
      expectedVersion: 2,
      participation: MatchAvailabilityParticipation.AVAILABLE,
    });
    expect(
      setOwnMatchAvailabilitySchema.safeParse({
        expectedVersion: 0,
        participation: MatchAvailabilityParticipation.AVAILABLE,
        replyStatus: 'confirmed',
      }).success
    ).toBe(false);
    expect(
      setPlayerMatchAvailabilitySchema.safeParse({
        expectedVersion: 0,
        participation: MatchAvailabilityParticipation.AVAILABLE,
        replyStatus: 'pending',
      }).success
    ).toBe(false);
    expect(
      setPlayerMatchAvailabilitySchema.safeParse({
        expectedVersion: -1,
        participation: 'maybe',
      }).success
    ).toBe(false);
  });

  it('derives Available only when no explicit entry exists', () => {
    expect(getMatchAvailability([], 'player-1')).toBe(
      DEFAULT_MATCH_AVAILABILITY
    );
    expect(
      getMatchAvailability(
        [
          {
            playerId: 'player-1',
            participation: MatchAvailabilityParticipation.UNAVAILABLE,
          },
        ],
        'player-1'
      )
    ).toEqual({
      participation: MatchAvailabilityParticipation.UNAVAILABLE,
    });
  });
});
