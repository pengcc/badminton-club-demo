import { describe, expect, it } from 'vitest';
import { TeamLevel } from '../core/enums';
import {
  createTeamSchema,
  teamFilterSchema,
  teamMatchLevelSchema,
  updateTeamSchema,
} from '../schemas/team';

const canonicalLevels = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

describe('Team class contract', () => {
  it('owns the exact BVBB A-through-G letter values', () => {
    expect(Object.values(TeamLevel)).toEqual(canonicalLevels);
  });

  it.each(
    canonicalLevels
  )('accepts canonical level %s across Team inputs', (matchLevel) => {
    expect(teamMatchLevelSchema.safeParse(matchLevel).success).toBe(true);
    expect(
      createTeamSchema.safeParse({
        teamId: 't1',
        shortName: 'DCBV I',
        leagueTeamName: 'DCBV I',
        matchLevel,
      }).success
    ).toBe(true);
    expect(updateTeamSchema.safeParse({ matchLevel }).success).toBe(true);
    expect(teamFilterSchema.safeParse({ matchLevel }).success).toBe(true);
  });

  it.each([
    'Class C',
    'BVBB B',
    'B-Klasse',
    'H',
  ])('rejects non-canonical level %s', (matchLevel) => {
    expect(teamMatchLevelSchema.safeParse(matchLevel).success).toBe(false);
    expect(
      createTeamSchema.safeParse({
        teamId: 't1',
        shortName: 'DCBV I',
        leagueTeamName: 'DCBV I',
        matchLevel,
      }).success
    ).toBe(false);
    expect(updateTeamSchema.safeParse({ matchLevel }).success).toBe(false);
    expect(teamFilterSchema.safeParse({ matchLevel }).success).toBe(false);
  });
});
