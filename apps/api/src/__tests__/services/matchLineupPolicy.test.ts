import { describe, expect, it } from 'vitest';
import {
  Gender,
  LineupPosition,
  LineupViolationCode,
  MatchAvailabilityParticipation,
} from '@club/shared-types/core/enums';
import type { MatchLineupIntentEntry } from '@club/shared-types/domain/lineup';
import {
  blockingLineupWarnings,
  canonicalizeLineupIntent,
  classifyLineup,
  rawDuplicateWarnings,
  type LineupPolicyPlayerFact,
} from '../../services/matchLineupPolicy';

function id(number: number): string {
  return number.toString(16).padStart(24, '0');
}

function fact(
  playerId: string,
  gender: Gender,
  overrides: Partial<LineupPolicyPlayerFact> = {}
): LineupPolicyPlayerFact {
  return {
    playerId,
    referenceAvailable: true,
    currentlyEligible: true,
    onMatchTeam: true,
    playerName: `Player ${playerId}`,
    gender,
    singlesRanking: 1000,
    doublesRanking: 1000,
    participation: MatchAvailabilityParticipation.AVAILABLE,

    ...overrides,
  };
}

function warningCodes(
  entries: MatchLineupIntentEntry[],
  facts: Map<string, LineupPolicyPlayerFact>
) {
  return classifyLineup(entries, facts).map((warning) => warning.code);
}

describe('Match Lineup fixed-rule policy', () => {
  it('rejects raw duplicate multiplicity before canonicalization', () => {
    const entry = {
      position: LineupPosition.OPEN_SINGLES,
      playerId: id(1),
    };
    expect(rawDuplicateWarnings([entry, entry])).toEqual([
      {
        code: LineupViolationCode.DUPLICATE_POSITION_ASSIGNMENT,
        position: LineupPosition.OPEN_SINGLES,
        playerId: id(1),
      },
    ]);
    expect(canonicalizeLineupIntent([entry, entry])).toHaveLength(2);
  });

  it.each([
    [LineupPosition.MEN_SINGLES_1, Gender.FEMALE, true],
    [LineupPosition.MEN_SINGLES_2, Gender.MALE, false],
    [LineupPosition.OPEN_SINGLES, Gender.NON_BINARY, false],
    [LineupPosition.WOMEN_SINGLES, Gender.MALE, true],
    [LineupPosition.MENS_DOUBLES, Gender.FEMALE, true],
    [LineupPosition.OPEN_DOUBLES, Gender.NON_BINARY, false],
    [LineupPosition.WOMEN_DOUBLES, Gender.MALE, true],
    [LineupPosition.MIXED_DOUBLES, Gender.NON_BINARY, true],
  ])('applies gender eligibility for %s', (position, gender, invalid) => {
    const playerId = id(1);
    expect(
      warningCodes(
        [{ position, playerId }],
        new Map([[playerId, fact(playerId, gender)]])
      ).includes(LineupViolationCode.POSITION_GENDER_MISMATCH)
    ).toBe(invalid);
  });

  it('permits a partial Mixed pair and requires one male plus one female when full', () => {
    const male = id(1);
    const female = id(2);
    const secondMale = id(3);
    const facts = new Map([
      [male, fact(male, Gender.MALE)],
      [female, fact(female, Gender.FEMALE)],
      [secondMale, fact(secondMale, Gender.MALE)],
    ]);
    expect(
      warningCodes(
        [{ position: LineupPosition.MIXED_DOUBLES, playerId: male }],
        facts
      )
    ).not.toContain(LineupViolationCode.MIXED_PAIR_COMPOSITION_INVALID);
    expect(
      warningCodes(
        [
          { position: LineupPosition.MIXED_DOUBLES, playerId: male },
          { position: LineupPosition.MIXED_DOUBLES, playerId: female },
        ],
        facts
      )
    ).not.toContain(LineupViolationCode.MIXED_PAIR_COMPOSITION_INVALID);
    expect(
      warningCodes(
        [
          { position: LineupPosition.MIXED_DOUBLES, playerId: male },
          { position: LineupPosition.MIXED_DOUBLES, playerId: secondMale },
        ],
        facts
      )
    ).toContain(LineupViolationCode.MIXED_PAIR_COMPOSITION_INVALID);
  });

  it('enforces capacity, two-event, no-two-singles, and distinct-Player limits', () => {
    const players = Array.from({ length: 13 }, (_, index) => id(index + 1));
    const facts = new Map(
      players.map((playerId) => [playerId, fact(playerId, Gender.MALE)])
    );
    const overCapacity = players.slice(0, 2).map((playerId) => ({
      position: LineupPosition.OPEN_SINGLES,
      playerId,
    }));
    expect(warningCodes(overCapacity, facts)).toContain(
      LineupViolationCode.POSITION_CAPACITY_EXCEEDED
    );

    const repeated = [
      { position: LineupPosition.MEN_SINGLES_1, playerId: players[0] },
      { position: LineupPosition.OPEN_SINGLES, playerId: players[0] },
      { position: LineupPosition.OPEN_DOUBLES, playerId: players[0] },
    ];
    expect(warningCodes(repeated, facts)).toEqual(
      expect.arrayContaining([
        LineupViolationCode.PLAYER_EVENT_LIMIT_EXCEEDED,
        LineupViolationCode.PLAYER_MULTIPLE_SINGLES,
      ])
    );

    const thirteen = players.map((playerId, index) => ({
      position:
        index % 2 === 0
          ? LineupPosition.OPEN_DOUBLES
          : LineupPosition.MIXED_DOUBLES,
      playerId,
    }));
    expect(warningCodes(thirteen, facts)).toContain(
      LineupViolationCode.DISTINCT_PLAYER_LIMIT_EXCEEDED
    );
  });

  it('uses effective Availability and current facts', () => {
    const playerId = id(1);
    expect(
      warningCodes(
        [{ position: LineupPosition.OPEN_SINGLES, playerId }],
        new Map([
          [
            playerId,
            fact(playerId, Gender.NON_BINARY, {
              participation: MatchAvailabilityParticipation.UNAVAILABLE,

              currentlyEligible: false,
              onMatchTeam: false,
            }),
          ],
        ])
      )
    ).toEqual(
      expect.arrayContaining([
        LineupViolationCode.PLAYER_NOT_CURRENTLY_ELIGIBLE,
        LineupViolationCode.PLAYER_NOT_ON_MATCH_TEAM,
        LineupViolationCode.PLAYER_UNAVAILABLE,
      ])
    );
  });

  it('blocks invalid new scope but leaves unrelated retained warnings editable', () => {
    const retained = id(1);
    const added = id(2);
    const entries = [
      { position: LineupPosition.MEN_SINGLES_1, playerId: retained },
      { position: LineupPosition.OPEN_DOUBLES, playerId: added },
    ];
    const facts = new Map([
      [retained, fact(retained, Gender.FEMALE, { currentlyEligible: false })],
      [added, fact(added, Gender.NON_BINARY)],
    ]);
    const current = [entries[0]];
    const baselineWarnings = classifyLineup(current, facts);
    const warnings = classifyLineup(entries, facts);
    expect(
      blockingLineupWarnings({
        currentEntries: current,
        proposedEntries: entries,
        baselineWarnings,
        proposedWarnings: warnings,
        newEntries: [entries[1]],
      })
    ).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ playerId: retained })])
    );
  });

  it('blocks aggregate invalidity in a touched scope but permits correcting and unrelated edits', () => {
    const retained = id(1);
    const extra = id(2);
    const replacement = id(3);
    const unrelated = id(4);
    const facts = new Map(
      [retained, extra, replacement, unrelated].map((playerId) => [
        playerId,
        fact(playerId, Gender.NON_BINARY),
      ])
    );
    const current = [
      { position: LineupPosition.OPEN_SINGLES, playerId: retained },
      { position: LineupPosition.OPEN_SINGLES, playerId: extra },
    ];
    const replaced = [
      { position: LineupPosition.OPEN_SINGLES, playerId: retained },
      { position: LineupPosition.OPEN_SINGLES, playerId: replacement },
    ];
    const unrelatedEdit = [
      ...current,
      { position: LineupPosition.OPEN_DOUBLES, playerId: unrelated },
    ];
    const baselineWarnings = classifyLineup(current, facts);

    expect(
      blockingLineupWarnings({
        currentEntries: current,
        proposedEntries: replaced,
        baselineWarnings,
        proposedWarnings: classifyLineup(replaced, facts),
        newEntries: [replaced[1]],
      })
    ).toEqual([
      expect.objectContaining({
        code: LineupViolationCode.POSITION_CAPACITY_EXCEEDED,
      }),
    ]);
    expect(
      blockingLineupWarnings({
        currentEntries: current,
        proposedEntries: unrelatedEdit,
        baselineWarnings,
        proposedWarnings: classifyLineup(unrelatedEdit, facts),
        newEntries: [unrelatedEdit[2]],
      })
    ).toEqual([]);
    expect(
      blockingLineupWarnings({
        currentEntries: current,
        proposedEntries: [current[0]],
        baselineWarnings,
        proposedWarnings: classifyLineup([current[0]], facts),
        newEntries: [],
      })
    ).toEqual([]);
  });
});
