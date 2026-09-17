import { randomUUID } from 'node:crypto';
import express from 'express';
import request from 'supertest';
import {
  createAuthSessionCookie,
  FIRST_PARTY_ORIGIN,
} from '../helpers/authSession';
import {
  acquireMongoTestDatabase,
  type MongoTestDatabaseLease,
} from '../infrastructure/mongoTestDatabase';
import {
  Gender,
  LineupPosition,
  MatchAvailabilityParticipation,
  MatchDirection,
  MatchListView,
  MembershipStatus,
  PlayerType,
  AccountKind,
  TeamLevel,
} from '@club/shared-types/core/enums';
import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import matchRoutes from '../../routes/matches';
import { errorHandler } from '../../middleware/errorHandler';
import { Match } from '../../models/Match';
import { AuthSession } from '../../models/AuthSession';
import { Player } from '../../models/Player';
import { Team } from '../../models/Team';
import { User } from '../../models/User';
import { MatchService } from '../../services/matchService';
import { MatchLineupService } from '../../services/matchLineupService';
import { PlayerService } from '../../services/playerService';
import { TeamService } from '../../services/teamService';
import { withMatchScheduleDuplicateKey } from '../../services/matchScheduleDuplicateKey';

let mongoLease: MongoTestDatabaseLease;

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/matches', matchRoutes);
  app.use(errorHandler);
  return app;
}

async function createUser(
  administratorDesignation: boolean,
  membershipStatus: MembershipStatus,
  isPlayer: boolean
) {
  return User.create({
    email: `${randomUUID()}@example.test`,
    firstName: 'Scope',
    lastName: 'Tester',
    password: 'ValidPassword1',
    gender: Gender.FEMALE,
    dateOfBirth: '1990-01-01',
    accountKind: AccountKind.PERSON,
    administratorDesignation,
    membershipStatus,
    isPlayer,
  });
}

async function createPlayer(
  userId: mongoose.Types.ObjectId,
  type: PlayerType,
  teamIds: mongoose.Types.ObjectId[],
  isActivePlayer = true
) {
  return Player.create({
    userId,
    type,
    singlesRanking: 0,
    doublesRanking: 0,
    preferredPositions: [],
    isActivePlayer,
    teamIds,
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
    matchLevel: TeamLevel.B,
    createdById,
  });
}

async function createMatch(
  createdById: mongoose.Types.ObjectId,
  teamId: mongoose.Types.ObjectId,
  suffix: string,
  retainedPlayerId?: mongoose.Types.ObjectId
) {
  return Match.create(
    withMatchScheduleDuplicateKey({
      startAt: new Date(`2027-08-0${suffix}T10:00:00.000Z`),
      location: `Hall ${suffix}`,
      direction: MatchDirection.HOME,
      teamId,
      opponentName: `Visitors ${suffix}`,
      lineup: retainedPlayerId
        ? [
            {
              position: LineupPosition.WOMEN_SINGLES,
              playerId: retainedPlayerId,
              playerNameSnapshot: 'Retained Player',
            },
          ]
        : [],
      availability: retainedPlayerId
        ? [
            {
              playerId: retainedPlayerId,
              participation: MatchAvailabilityParticipation.UNAVAILABLE,
            },
          ]
        : [],
      createdById,
    })
  );
}

function tokenFor(userId: mongoose.Types.ObjectId): Promise<string> {
  return createAuthSessionCookie(userId.toString());
}

async function get(userId: mongoose.Types.ObjectId, path: string) {
  return request(createApp())
    .get(path)
    .set('Cookie', await tokenFor(userId));
}

async function post(
  userId: mongoose.Types.ObjectId,
  path: string,
  body: Record<string, unknown>
) {
  return request(createApp())
    .post(path)
    .set('Cookie', await tokenFor(userId))
    .set('Origin', FIRST_PARTY_ORIGIN)
    .send(body);
}

async function put(
  userId: mongoose.Types.ObjectId,
  path: string,
  body: Record<string, unknown>
) {
  return request(createApp())
    .put(path)
    .set('Cookie', await tokenFor(userId))
    .set('Origin', FIRST_PARTY_ORIGIN)
    .send(body);
}

async function remove(
  userId: mongoose.Types.ObjectId,
  path: string,
  body: Record<string, unknown>
) {
  return request(createApp())
    .delete(path)
    .set('Cookie', await tokenFor(userId))
    .set('Origin', FIRST_PARTY_ORIGIN)
    .send(body);
}

beforeAll(async () => {
  mongoLease = await acquireMongoTestDatabase('matchTeamScope');
  mongoLease.assertOwnedDatabase();
  await Promise.all([
    User.syncIndexes(),
    Player.syncIndexes(),
    Team.syncIndexes(),
    Match.syncIndexes(),
    AuthSession.syncIndexes(),
  ]);
}, 120_000);

beforeEach(async () => {
  mongoLease.assertOwnedDatabase();
  await Promise.all([
    User.deleteMany({}),
    Player.deleteMany({}),
    Team.deleteMany({}),
    Match.deleteMany({}),
    AuthSession.deleteMany({}),
  ]);
});

afterAll(async () => {
  await mongoLease.release();
});

describe('C2 current-Team Match scope', () => {
  it('keeps administrators unrestricted and scopes Member and External Players to current Teams', async () => {
    const admin = await createUser(true, MembershipStatus.ACTIVE, false);
    const member = await createUser(false, MembershipStatus.ACTIVE, true);
    const external = await createUser(false, MembershipStatus.INACTIVE, true);
    const teams = await Promise.all([
      createTeam(admin._id, 't1'),
      createTeam(admin._id, 't2'),
      createTeam(admin._id, 't3'),
    ]);
    const memberPlayer = await createPlayer(member._id, PlayerType.MEMBER, [
      teams[0]._id,
      teams[1]._id,
    ]);
    await createPlayer(external._id, PlayerType.EXTERNAL, [teams[2]._id]);
    const matches = await Promise.all([
      createMatch(admin._id, teams[0]._id, '1'),
      createMatch(admin._id, teams[1]._id, '2', memberPlayer._id),
      createMatch(admin._id, teams[2]._id, '3'),
    ]);

    const adminList = await get(admin._id, '/api/matches');
    expect(adminList.status).toBe(200);
    expect(
      adminList.body.data.map((match: { id: string }) => match.id)
    ).toHaveLength(3);

    const memberList = await get(member._id, '/api/matches');
    expect(
      new Set(memberList.body.data.map((match: { id: string }) => match.id))
    ).toEqual(new Set([matches[0]._id.toString(), matches[1]._id.toString()]));
    expect(
      (await get(member._id, `/api/matches/${matches[0]._id}`)).status
    ).toBe(200);
    expect(
      (await get(member._id, `/api/matches/${matches[2]._id}`)).status
    ).toBe(404);

    const externalList = await get(external._id, '/api/matches');
    expect(
      externalList.body.data.map((match: { id: string }) => match.id)
    ).toEqual([matches[2]._id.toString()]);
    expect(
      (await get(external._id, `/api/matches/${matches[2]._id}`)).status
    ).toBe(200);

    await PlayerService.removePlayerFromTeam(
      memberPlayer._id.toString(),
      teams[1]._id.toString()
    );
    const memberAfterRemoval = await get(member._id, '/api/matches');
    expect(
      memberAfterRemoval.body.data.map((match: { id: string }) => match.id)
    ).toEqual([matches[0]._id.toString()]);
    expect(
      (await get(member._id, `/api/matches/${matches[1]._id}`)).status
    ).toBe(404);
    expect(
      (await get(admin._id, `/api/matches/${matches[1]._id}`)).body.data
        .availability
    ).toContainEqual({
      playerId: memberPlayer._id.toString(),
      participation: MatchAvailabilityParticipation.UNAVAILABLE,
    });
    expect(
      (await TeamService.getTeamPlayers(teams[1]._id.toString())).map(
        (player) => player.id
      )
    ).not.toContain(memberPlayer._id.toString());
    await expect(
      MatchLineupService.setLineup(matches[1]._id.toString(), {
        expectedVersion: matches[1].__v,
        lineup: [
          {
            position: LineupPosition.WOMEN_SINGLES,
            playerId: memberPlayer._id.toString(),
          },
          {
            position: LineupPosition.OPEN_DOUBLES,
            playerId: memberPlayer._id.toString(),
          },
        ],
      })
    ).rejects.toMatchObject({
      code: 'LINEUP_VALIDATION_FAILED',
      details: {
        violations: expect.arrayContaining([
          expect.objectContaining({
            code: 'player_not_on_match_team',
          }),
        ]),
      },
    });
  });

  it('returns empty/non-disclosing scope for no Player, inactive Player, and zero Teams', async () => {
    const admin = await createUser(true, MembershipStatus.ACTIVE, false);
    const team = await createTeam(admin._id, 't1');
    const match = await createMatch(admin._id, team._id, '1');
    const noPlayer = await createUser(false, MembershipStatus.ACTIVE, false);
    const inactivePlayerUser = await createUser(
      false,
      MembershipStatus.ACTIVE,
      true
    );
    await createPlayer(
      inactivePlayerUser._id,
      PlayerType.MEMBER,
      [team._id],
      false
    );
    const zeroTeamUser = await createUser(false, MembershipStatus.ACTIVE, true);
    await createPlayer(zeroTeamUser._id, PlayerType.MEMBER, []);

    for (const user of [noPlayer, inactivePlayerUser, zeroTeamUser]) {
      const list = await get(user._id, '/api/matches');
      expect(list.status).toBe(200);
      expect(list.body.data).toEqual([]);
      expect((await get(user._id, `/api/matches/${match._id}`)).status).toBe(
        404
      );
    }
  });

  it('keeps omitted/all compatibility and applies stable time-derived view ordering', async () => {
    const admin = await createUser(true, MembershipStatus.ACTIVE, false);
    const team = await createTeam(admin._id, 't1');
    const ids = {
      historyLow: new mongoose.Types.ObjectId('100000000000000000000001'),
      historyHigh: new mongoose.Types.ObjectId('100000000000000000000002'),
      upcomingLow: new mongoose.Types.ObjectId('200000000000000000000001'),
      upcomingHigh: new mongoose.Types.ObjectId('200000000000000000000002'),
    };
    const common = {
      teamId: team._id,
      opponentName: 'Ordering Visitors',
      direction: MatchDirection.HOME,
      location: 'Ordering Hall',
      lineup: [],
      availability: [],
      createdById: admin._id,
    };
    await Match.create(
      [
        {
          _id: ids.historyLow,
          ...common,
          opponentName: 'Ordering Visitors A',
          startAt: new Date('2020-01-01T10:00:00.000Z'),
        },
        {
          _id: ids.historyHigh,
          ...common,
          opponentName: 'Ordering Visitors B',
          startAt: new Date('2020-01-01T10:00:00.000Z'),
        },
        {
          _id: ids.upcomingLow,
          ...common,
          opponentName: 'Ordering Visitors C',
          startAt: new Date('2099-01-01T10:00:00.000Z'),
        },
        {
          _id: ids.upcomingHigh,
          ...common,
          opponentName: 'Ordering Visitors D',
          startAt: new Date('2099-01-01T10:00:00.000Z'),
        },
      ].map(withMatchScheduleDuplicateKey)
    );

    const omitted = await get(admin._id, '/api/matches');
    const all = await get(admin._id, `/api/matches?view=${MatchListView.ALL}`);
    const upcoming = await get(
      admin._id,
      `/api/matches?view=${MatchListView.UPCOMING}`
    );
    const history = await get(
      admin._id,
      `/api/matches?view=${MatchListView.HISTORY}`
    );
    const idsFrom = (response: request.Response) =>
      response.body.data.map((match: { id: string }) => match.id);

    expect(omitted.status).toBe(200);
    expect(idsFrom(omitted)).toEqual(idsFrom(all));
    expect(idsFrom(all)).toEqual([
      ids.upcomingHigh.toString(),
      ids.upcomingLow.toString(),
      ids.historyHigh.toString(),
      ids.historyLow.toString(),
    ]);
    expect(idsFrom(upcoming)).toEqual([
      ids.upcomingLow.toString(),
      ids.upcomingHigh.toString(),
    ]);
    expect(idsFrom(history)).toEqual([
      ids.historyHigh.toString(),
      ids.historyLow.toString(),
    ]);
    expect(all.body.data[0]).not.toHaveProperty('status');
    expect(all.body.data[0]).not.toHaveProperty('cancellationReason');
  });

  it('preserves the canonical command error contract through the real route chain', async () => {
    const admin = await createUser(true, MembershipStatus.ACTIVE, false);
    const member = await createUser(false, MembershipStatus.ACTIVE, true);
    const team = await createTeam(admin._id, 't1');
    await createPlayer(member._id, PlayerType.MEMBER, [team._id]);
    const match = await createMatch(admin._id, team._id, '1');
    const canonicalCreate = {
      teamId: team._id.toString(),
      opponentName: 'Route Visitors',
      direction: MatchDirection.AWAY,
      localDate: '2027-09-01',
      localTime: '19:30',
      location: 'Route Hall',
    };

    expect(
      (await post(member._id, '/api/matches', canonicalCreate)).status
    ).toBe(403);
    expect(
      (
        await put(member._id, `/api/matches/${match._id}`, {
          expectedVersion: 0,
          ...canonicalCreate,
        })
      ).status
    ).toBe(403);
    expect(
      (
        await remove(member._id, `/api/matches/${match._id}`, {
          expectedVersion: 0,
        })
      ).status
    ).toBe(403);
    expect(
      (
        await put(member._id, `/api/matches/${match._id}/result`, {
          expectedVersion: 0,
          homeScore: 1,
          awayScore: 0,
        })
      ).status
    ).toBe(403);
    expect((await get(admin._id, '/api/matches?view=scheduled')).status).toBe(
      400
    );
    expect((await get(admin._id, '/api/matches/not-an-id')).status).toBe(400);
    expect(
      (
        await put(admin._id, '/api/matches/507f1f77bcf86cd799439099', {
          expectedVersion: 0,
          ...canonicalCreate,
        })
      ).status
    ).toBe(404);
    expect(
      (
        await put(admin._id, `/api/matches/${match._id}`, {
          expectedVersion: -1,
          ...canonicalCreate,
        })
      ).status
    ).toBe(400);
    expect(
      (
        await put(admin._id, `/api/matches/${match._id}/result`, {
          expectedVersion: 99,
          homeScore: 1,
          awayScore: 0,
        })
      ).status
    ).toBe(409);
    expect(
      (
        await remove(admin._id, `/api/matches/${match._id}`, {
          expectedVersion: 99,
        })
      ).status
    ).toBe(409);
  });
});
