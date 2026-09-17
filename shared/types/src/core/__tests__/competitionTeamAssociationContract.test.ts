import { describe, expect, it } from 'vitest';
import { batchUpdatePlayersSchema } from '../../schemas/team';

const playerId = '507f1f77bcf86cd799439011';
const secondPlayerId = '507f1f77bcf86cd799439012';
const teamId = '507f1f77bcf86cd799439013';
const secondTeamId = '507f1f77bcf86cd799439014';

describe('Competition Team association batch contract', () => {
  it('accepts a bounded Team-only association command without a Team-count cap', () => {
    const addToTeams = Array.from({ length: 60 }, (_, index) =>
      index.toString(16).padStart(24, '0')
    );

    expect(
      batchUpdatePlayersSchema.parse({
        playerIds: [playerId, secondPlayerId],
        updates: { addToTeams, removeFromTeams: [teamId] },
      })
    ).toEqual({
      playerIds: [playerId, secondPlayerId],
      updates: { addToTeams, removeFromTeams: [teamId] },
    });
  });

  it.each([
    {
      name: 'duplicate Player IDs',
      value: {
        playerIds: [playerId, playerId],
        updates: { addToTeams: [teamId] },
      },
    },
    {
      name: 'duplicate Team IDs',
      value: {
        playerIds: [playerId],
        updates: { addToTeams: [teamId, teamId] },
      },
    },
    {
      name: 'case-variant duplicate Team IDs',
      value: {
        playerIds: [playerId],
        updates: { addToTeams: [teamId, teamId.toUpperCase()] },
      },
    },
    {
      name: 'overlapping Team additions and removals',
      value: {
        playerIds: [playerId],
        updates: { addToTeams: [teamId], removeFromTeams: [teamId] },
      },
    },
    {
      name: 'case-variant overlapping Team additions and removals',
      value: {
        playerIds: [playerId],
        updates: {
          addToTeams: [teamId],
          removeFromTeams: [teamId.toUpperCase()],
        },
      },
    },
    {
      name: 'mixed Team and ranking changes',
      value: {
        playerIds: [playerId],
        updates: { addToTeams: [teamId], singlesRanking: 100 },
      },
    },
    {
      name: 'mixed Team and eligibility changes',
      value: {
        playerIds: [playerId],
        updates: { removeFromTeams: [teamId], isActivePlayer: false },
      },
    },
    {
      name: 'an empty command',
      value: { playerIds: [playerId], updates: {} },
    },
    {
      name: 'an invalid ObjectId',
      value: {
        playerIds: ['not-an-object-id'],
        updates: { removeFromTeams: [secondTeamId] },
      },
    },
  ])('rejects $name', ({ value }) => {
    expect(batchUpdatePlayersSchema.safeParse(value).success).toBe(false);
  });

  it('rejects 51 Players before service execution', () => {
    const playerIds = Array.from({ length: 51 }, (_, index) =>
      (index + 100).toString(16).padStart(24, '0')
    );

    expect(
      batchUpdatePlayersSchema.safeParse({
        playerIds,
        updates: { addToTeams: [teamId] },
      }).success
    ).toBe(false);
  });
});
