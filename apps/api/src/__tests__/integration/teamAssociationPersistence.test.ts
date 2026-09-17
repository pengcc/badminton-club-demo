import { randomUUID } from 'node:crypto';
import {
  acquireMongoTestDatabase,
  type MongoTestDatabaseLease,
} from '../infrastructure/mongoTestDatabase';
import {
  Gender,
  LineupPosition,
  MatchAvailabilityParticipation,
  MatchDirection,
  MembershipStatus,
  PlayerType,
  AccountKind,
  Capability,
  TeamLevel,
} from '@club/shared-types/core/enums';
import mongoose from 'mongoose';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { Match } from '../../models/Match';
import { Player } from '../../models/Player';
import { Team } from '../../models/Team';
import { User } from '../../models/User';
import { PlayerService } from '../../services/playerService';
import { AppError } from '../../utils/errors';
import { withMatchScheduleDuplicateKey } from '../../services/matchScheduleDuplicateKey';

let mongoLease: MongoTestDatabaseLease;

async function createUser(
  membershipStatus: MembershipStatus = MembershipStatus.ACTIVE
) {
  return User.create({
    email: `${randomUUID()}@example.test`,
    firstName: 'Test',
    lastName: 'Player',
    password: 'ValidPassword1',
    gender: Gender.FEMALE,
    dateOfBirth: '1990-01-01',
    accountKind: AccountKind.PERSON,
    administratorDesignation: false,
    displayName: 'Member',
    capabilities: [Capability.AUTHENTICATED_ACCOUNT],
    membershipStatus,
    isPlayer: true,
  });
}

async function createPlayer(
  userId: mongoose.Types.ObjectId,
  type: PlayerType = PlayerType.MEMBER,
  isActivePlayer = true
) {
  return Player.create({
    userId,
    type,
    singlesRanking: 0,
    doublesRanking: 0,
    preferredPositions: [],
    isActivePlayer,
    teamIds: [],
  });
}

async function createTeam(
  createdById: mongoose.Types.ObjectId,
  teamId: string
) {
  return Team.create({
    teamId,
    shortName: `Team ${teamId}`,
    leagueTeamName: `League Team ${teamId}`,
    matchLevel: TeamLevel.G,
    createdById,
  });
}

beforeAll(async () => {
  mongoLease = await acquireMongoTestDatabase('teamAssociation');
  mongoLease.assertOwnedDatabase();
  await Promise.all([
    User.syncIndexes(),
    Player.syncIndexes(),
    Team.syncIndexes(),
    Match.syncIndexes(),
  ]);
}, 120_000);

beforeEach(async () => {
  mongoLease.assertOwnedDatabase();
  await Promise.all([
    User.deleteMany({}),
    Player.deleteMany({}),
    Team.deleteMany({}),
    Match.deleteMany({}),
  ]);
});

afterAll(async () => {
  await mongoLease.release();
});

describe('C2 Team-association persistence', () => {
  it('supports replay-safe zero, one, and multiple Team states for member and external Players', async () => {
    const memberUser = await createUser();
    const externalUser = await createUser(MembershipStatus.INACTIVE);
    const memberPlayer = await createPlayer(memberUser._id);
    const externalPlayer = await createPlayer(
      externalUser._id,
      PlayerType.EXTERNAL
    );
    const teams = await Promise.all([
      createTeam(memberUser._id, 't1'),
      createTeam(memberUser._id, 't2'),
      createTeam(memberUser._id, 't3'),
    ]);

    await PlayerService.addPlayerToTeam(
      memberPlayer._id.toString(),
      teams[0]._id.toString()
    );
    await PlayerService.addPlayerToTeam(
      memberPlayer._id.toString(),
      teams[0]._id.toString()
    );
    await PlayerService.addPlayerToTeam(
      memberPlayer._id.toString(),
      teams[1]._id.toString()
    );
    await PlayerService.addPlayerToTeam(
      externalPlayer._id.toString(),
      teams[0]._id.toString()
    );
    await PlayerService.addPlayerToTeam(
      externalPlayer._id.toString(),
      teams[2]._id.toString()
    );

    expect(
      (await Player.findById(memberPlayer._id))?.teamIds.map((id) =>
        id.toString()
      )
    ).toEqual([teams[0]._id.toString(), teams[1]._id.toString()]);
    expect(
      (await Player.findById(externalPlayer._id))?.teamIds.map((id) =>
        id.toString()
      )
    ).toEqual([teams[0]._id.toString(), teams[2]._id.toString()]);

    await PlayerService.removePlayerFromTeam(
      memberPlayer._id.toString(),
      teams[0]._id.toString()
    );
    await PlayerService.removePlayerFromTeam(
      memberPlayer._id.toString(),
      teams[0]._id.toString()
    );
    expect(
      (await Player.findById(memberPlayer._id))?.teamIds.map((id) =>
        id.toString()
      )
    ).toEqual([teams[1]._id.toString()]);
  });

  it('rejects invalid, missing, and ineligible assignment inputs without partial writes', async () => {
    const user = await createUser(MembershipStatus.INACTIVE);
    const player = await createPlayer(user._id);
    const team = await createTeam(user._id, 't1');

    await expect(
      PlayerService.addPlayerToTeam('invalid', team._id.toString())
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      PlayerService.addPlayerToTeam(
        player._id.toString(),
        new mongoose.Types.ObjectId().toString()
      )
    ).rejects.toMatchObject({ statusCode: 404 });
    await expect(
      PlayerService.addPlayerToTeam(
        new mongoose.Types.ObjectId().toString(),
        team._id.toString()
      )
    ).rejects.toMatchObject({ statusCode: 404 });
    await expect(
      PlayerService.addPlayerToTeam(player._id.toString(), team._id.toString())
    ).rejects.toMatchObject({ statusCode: 400 });
    expect((await Player.findById(player._id))?.teamIds).toHaveLength(0);

    await Player.updateOne(
      { _id: player._id },
      { $addToSet: { teamIds: team._id } }
    );
    expect(
      await PlayerService.getActivePlayersForTeam(team._id.toString())
    ).toHaveLength(0);
    expect(
      (await Player.findById(player._id))?.teamIds.map((id) => id.toString())
    ).toEqual([team._id.toString()]);
  });

  it('fails closed on an optimistic-version conflict', async () => {
    const user = await createUser();
    const player = await createPlayer(user._id);
    const team = await createTeam(user._id, 't1');
    vi.spyOn(Player, 'updateOne').mockResolvedValueOnce({
      matchedCount: 0,
    } as never);

    await expect(
      PlayerService.addPlayerToTeam(player._id.toString(), team._id.toString())
    ).rejects.toMatchObject({ statusCode: 409 });
    vi.restoreAllMocks();

    expect((await Player.findById(player._id))?.teamIds).toHaveLength(0);
  });

  it('persists more than 50 Team associations without a product-level Team cap', async () => {
    const user = await createUser();
    const player = await createPlayer(user._id);
    const teams = await Promise.all(
      Array.from({ length: 60 }, (_, index) =>
        createTeam(user._id, `t${index}`)
      )
    );

    await PlayerService.batchUpdatePlayers([player._id.toString()], {
      addToTeams: teams.map((team) => team._id.toString()),
    });

    expect((await Player.findById(player._id))?.teamIds).toHaveLength(60);
  });

  it('preserves past and future Lineup and Availability references after single and batch removal', async () => {
    const user = await createUser();
    const player = await createPlayer(user._id);
    const teams = await Promise.all([
      createTeam(user._id, 't1'),
      createTeam(user._id, 't2'),
    ]);
    await PlayerService.batchUpdatePlayers([player._id.toString()], {
      addToTeams: teams.map((team) => team._id.toString()),
    });
    const matches = await Match.create(
      [
        {
          startAt: new Date('2025-08-01T10:00:00.000Z'),
          location: 'Past Hall',
          direction: MatchDirection.HOME,
          teamId: teams[0]._id,
          opponentName: 'Visitors',
          lineup: [
            {
              position: LineupPosition.MEN_SINGLES_1,
              playerId: player._id,
              playerNameSnapshot: 'Retained Player',
            },
          ],
          availability: [
            {
              playerId: player._id,
              participation: MatchAvailabilityParticipation.UNAVAILABLE,
            },
          ],
          createdById: user._id,
        },
        {
          startAt: new Date('2027-08-01T10:00:00.000Z'),
          location: 'Future Hall',
          direction: MatchDirection.HOME,
          teamId: teams[1]._id,
          opponentName: 'Visitors',
          lineup: [
            {
              position: LineupPosition.MEN_SINGLES_1,
              playerId: player._id,
              playerNameSnapshot: 'Retained Player',
            },
          ],
          availability: [
            {
              playerId: player._id,
              participation: MatchAvailabilityParticipation.UNAVAILABLE,
            },
          ],
          createdById: user._id,
        },
      ].map(withMatchScheduleDuplicateKey)
    );

    await PlayerService.removePlayerFromTeam(
      player._id.toString(),
      teams[0]._id.toString()
    );
    await PlayerService.batchUpdatePlayers([player._id.toString()], {
      removeFromTeams: [teams[1]._id.toString()],
    });

    const persistedMatches = await Match.find({
      _id: { $in: matches.map((match) => match._id) },
    }).sort({ startAt: 1 });
    expect(
      persistedMatches.map((match) =>
        match.lineup.map((entry) => entry.playerId.toString())
      )
    ).toEqual([[player._id.toString()], [player._id.toString()]]);
    expect(
      persistedMatches.map((match) =>
        match.availability.map((entry) => entry.playerId.toString())
      )
    ).toEqual([[player._id.toString()], [player._id.toString()]]);
  });

  it('does not lose an unrelated Team association during concurrent mutations', async () => {
    const user = await createUser();
    const player = await createPlayer(user._id);
    const teams = await Promise.all([
      createTeam(user._id, 't1'),
      createTeam(user._id, 't2'),
    ]);
    await PlayerService.addPlayerToTeam(
      player._id.toString(),
      teams[0]._id.toString()
    );

    await Promise.all([
      PlayerService.removePlayerFromTeam(
        player._id.toString(),
        teams[0]._id.toString()
      ),
      PlayerService.addPlayerToTeam(
        player._id.toString(),
        teams[1]._id.toString()
      ),
    ]);

    expect(
      (await Player.findById(player._id))?.teamIds.map((id) => id.toString())
    ).toEqual([teams[1]._id.toString()]);
  });

  it('converges concurrent additions of the same Team without duplicates', async () => {
    const user = await createUser();
    const player = await createPlayer(user._id);
    const team = await createTeam(user._id, 't1');

    await Promise.all([
      PlayerService.addPlayerToTeam(player._id.toString(), team._id.toString()),
      PlayerService.addPlayerToTeam(player._id.toString(), team._id.toString()),
    ]);

    expect(
      (await Player.findById(player._id))?.teamIds.map((id) => id.toString())
    ).toEqual([team._id.toString()]);
  });

  it('applies a multi-Player, multi-Team command atomically and replay-safely', async () => {
    const users = await Promise.all([createUser(), createUser()]);
    const players = await Promise.all(
      users.map((user) => createPlayer(user._id))
    );
    const teams = await Promise.all([
      createTeam(users[0]._id, 't1'),
      createTeam(users[0]._id, 't2'),
      createTeam(users[0]._id, 't3'),
    ]);
    await Player.updateMany(
      { _id: { $in: players.map((player) => player._id) } },
      { $addToSet: { teamIds: teams[0]._id } }
    );

    const command = {
      addToTeams: [teams[1]._id.toString(), teams[2]._id.toString()],
      removeFromTeams: [teams[0]._id.toString()],
    };
    const result = await PlayerService.batchUpdatePlayers(
      players.map((player) => player._id.toString()),
      command
    );
    await PlayerService.batchUpdatePlayers(
      players.map((player) => player._id.toString()),
      command
    );

    expect(result).toEqual({ updatedCount: 2 });
    expect(
      (
        await Player.find({ _id: { $in: players.map((player) => player._id) } })
      ).map((player) => player.teamIds.map((teamId) => teamId.toString()))
    ).toEqual([
      [teams[1]._id.toString(), teams[2]._id.toString()],
      [teams[1]._id.toString(), teams[2]._id.toString()],
    ]);
  });

  it.each([
    {
      name: 'duplicate Player IDs',
      playerIds: (playerId: string) => [playerId, playerId],
      updates: (teamId: string) => ({ addToTeams: [teamId] }),
    },
    {
      name: 'duplicate Team IDs',
      playerIds: (playerId: string) => [playerId],
      updates: (teamId: string) => ({ addToTeams: [teamId, teamId] }),
    },
    {
      name: 'overlapping additions and removals',
      playerIds: (playerId: string) => [playerId],
      updates: (teamId: string) => ({
        addToTeams: [teamId],
        removeFromTeams: [teamId],
      }),
    },
  ])('rejects $name before writes', async ({ playerIds, updates }) => {
    const user = await createUser();
    const player = await createPlayer(user._id);
    const team = await createTeam(user._id, 't1');

    await expect(
      PlayerService.batchUpdatePlayers(
        playerIds(player._id.toString()),
        updates(team._id.toString())
      )
    ).rejects.toMatchObject({ statusCode: 400 });
    expect((await Player.findById(player._id))?.teamIds).toHaveLength(0);
  });

  it('rejects 51 Players before writes', async () => {
    const user = await createUser();
    const player = await createPlayer(user._id);
    const team = await createTeam(user._id, 't1');

    await expect(
      PlayerService.batchUpdatePlayers(
        Array.from({ length: 51 }, () =>
          new mongoose.Types.ObjectId().toString()
        ),
        { addToTeams: [team._id.toString()] }
      )
    ).rejects.toMatchObject({ statusCode: 400 });
    expect((await Player.findById(player._id))?.teamIds).toHaveLength(0);
  });

  it('rolls back earlier Player updates when an intermediate mutation fails', async () => {
    const users = await Promise.all([createUser(), createUser()]);
    const players = await Promise.all(
      users.map((user) => createPlayer(user._id))
    );
    const team = await createTeam(users[0]._id, 't1');
    const originalUpdateOne = Player.updateOne.bind(Player);
    let updateCalls = 0;
    vi.spyOn(Player, 'updateOne').mockImplementation((...args) => {
      updateCalls += 1;
      if (updateCalls === 2) {
        throw AppError.internal('Injected intermediate failure');
      }
      return originalUpdateOne(...args);
    });

    await expect(
      PlayerService.batchUpdatePlayers(
        players.map((player) => player._id.toString()),
        { addToTeams: [team._id.toString()] }
      )
    ).rejects.toThrow('Injected intermediate failure');
    vi.restoreAllMocks();

    expect(
      await Player.countDocuments({
        _id: { $in: players.map((player) => player._id) },
        teamIds: team._id,
      })
    ).toBe(0);
  });
});
