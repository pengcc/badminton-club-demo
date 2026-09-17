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
  AuditEventType,
  Gender,
  LineupPosition,
  LineupViolationCode,
  MatchAvailabilityParticipation,
  MatchDirection,
  MembershipStatus,
  PlayerType,
  AccountKind,
  Capability,
  TeamLevel,
} from '@club/shared-types/core/enums';
import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import matchRoutes from '../../routes/matches';
import { errorHandler } from '../../middleware/errorHandler';
import { AuditLog } from '../../models/AuditLog';
import { AuthSession } from '../../models/AuthSession';
import { Match } from '../../models/Match';
import { Player } from '../../models/Player';
import { Team } from '../../models/Team';
import { User } from '../../models/User';
import { MatchLineupService } from '../../services/matchLineupService';
import { MatchAvailabilityService } from '../../services/matchAvailabilityService';
import {
  MatchService,
  type MatchCommandActor,
} from '../../services/matchService';
import { PlayerService } from '../../services/playerService';
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
    firstName: 'Availability',
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

async function createTeam(createdById: mongoose.Types.ObjectId) {
  return Team.create({
    teamId: randomUUID().slice(0, 8),
    shortName: 'C3 Team',
    leagueTeamName: 'C3 League Team',
    matchLevel: TeamLevel.C,
    createdById,
  });
}

async function createPlayer(
  userId: mongoose.Types.ObjectId,
  type: PlayerType,
  teamIds: mongoose.Types.ObjectId[]
) {
  return Player.create({
    userId,
    type,
    singlesRanking: 0,
    doublesRanking: 0,
    preferredPositions: [],
    isActivePlayer: true,
    teamIds,
  });
}

async function createMatch(input: {
  createdById: mongoose.Types.ObjectId;
  teamId: mongoose.Types.ObjectId;
  startAt?: Date;
  availability?: Array<{
    playerId: mongoose.Types.ObjectId;
    participation: MatchAvailabilityParticipation;
  }>;
  lineup?: Array<{
    position: LineupPosition;
    playerId: mongoose.Types.ObjectId;
    playerNameSnapshot: string;
  }>;
}) {
  return Match.create(
    withMatchScheduleDuplicateKey({
      teamId: input.teamId,
      opponentName: 'C3 Visitors',
      direction: MatchDirection.HOME,
      startAt: input.startAt ?? new Date('2099-08-01T10:00:00.000Z'),
      location: 'C3 Hall',
      lineup: input.lineup ?? [],
      availability: input.availability ?? [],
      createdById: input.createdById,
    })
  );
}

function tokenFor(userId: mongoose.Types.ObjectId): Promise<string> {
  return createAuthSessionCookie(userId.toString());
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

function lineupSnapshot(
  lineup: Array<{
    position: LineupPosition;
    playerId: mongoose.Types.ObjectId;
    playerNameSnapshot: string;
  }>
) {
  return lineup.map((entry) => ({
    position: entry.position,
    playerId: entry.playerId.toString(),
    playerNameSnapshot: entry.playerNameSnapshot,
  }));
}

beforeAll(async () => {
  mongoLease = await acquireMongoTestDatabase('matchAvailability');
  mongoLease.assertOwnedDatabase();
  await Promise.all([
    User.syncIndexes(),
    Player.syncIndexes(),
    Team.syncIndexes(),
    Match.syncIndexes(),
    AuditLog.syncIndexes(),
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
    AuditLog.deleteMany({}),
    AuthSession.deleteMany({}),
  ]);
});

afterAll(async () => {
  await mongoLease.release();
});

describe('C3 explicit Match Availability', () => {
  it('uses authenticated self identity, participation-only payloads, strict bodies, no-ops, and stale conflicts', async () => {
    const admin = await createUser(true, MembershipStatus.ACTIVE, false);
    const member = await createUser(false, MembershipStatus.ACTIVE, true);
    const otherMember = await createUser(false, MembershipStatus.ACTIVE, true);
    const team = await createTeam(admin._id);
    const otherTeam = await createTeam(admin._id);
    const player = await createPlayer(member._id, PlayerType.MEMBER, [
      team._id,
    ]);
    await createPlayer(otherMember._id, PlayerType.MEMBER, [otherTeam._id]);
    const match = await createMatch({
      createdById: admin._id,
      teamId: team._id,
    });

    const first = await put(
      member._id,
      `/api/matches/${match._id}/availability/self`,
      {
        expectedVersion: 0,
        participation: MatchAvailabilityParticipation.UNAVAILABLE,
      }
    );
    expect(first.status).toBe(200);
    expect(first.body.data).toMatchObject({
      version: 1,
      availability: [
        {
          playerId: player._id.toString(),
          participation: MatchAvailabilityParticipation.UNAVAILABLE,
        },
      ],
    });
    const updatedAt = first.body.data.updatedAt;

    const noOp = await put(
      member._id,
      `/api/matches/${match._id}/availability/self`,
      {
        expectedVersion: 1,
        participation: MatchAvailabilityParticipation.UNAVAILABLE,
      }
    );
    expect(noOp.status).toBe(200);
    expect(noOp.body.data).toMatchObject({
      version: 1,
      updatedAt,
    });

    const stale = await put(
      member._id,
      `/api/matches/${match._id}/availability/self`,
      {
        expectedVersion: 0,
        participation: MatchAvailabilityParticipation.UNAVAILABLE,
      }
    );
    expect(stale.status).toBe(409);

    const invalidSelfBody = await put(
      member._id,
      `/api/matches/${match._id}/availability/self`,
      {
        expectedVersion: 1,
        participation: MatchAvailabilityParticipation.AVAILABLE,
        replyStatus: 'pending',
      }
    );
    expect(invalidSelfBody.status).toBe(400);

    const adminTargetAsPlayer = await put(
      member._id,
      `/api/matches/${match._id}/availability/${player._id}`,
      {
        expectedVersion: 1,
        participation: MatchAvailabilityParticipation.AVAILABLE,
      }
    );
    expect(adminTargetAsPlayer.status).toBe(403);

    const unrelated = await createMatch({
      createdById: admin._id,
      teamId: otherTeam._id,
    });
    expect(
      (
        await put(
          member._id,
          `/api/matches/${unrelated._id}/availability/self`,
          {
            expectedVersion: 0,
            participation: MatchAvailabilityParticipation.AVAILABLE,
          }
        )
      ).status
    ).toBe(404);
  });

  it('treats missing Available as a no-op for both actors without claiming Player versions', async () => {
    const admin = await createUser(true, MembershipStatus.ACTIVE, false);
    const member = await createUser(false, MembershipStatus.ACTIVE, true);
    const team = await createTeam(admin._id);
    const player = await createPlayer(member._id, PlayerType.MEMBER, [
      team._id,
    ]);
    const match = await createMatch({
      createdById: admin._id,
      teamId: team._id,
    });
    const playerVersion = player.get('__v');
    const command = {
      expectedVersion: 0,
      participation: MatchAvailabilityParticipation.AVAILABLE,
    };
    for (const [actor, endpoint] of [
      [member._id, 'self'],
      [admin._id, player._id.toString()],
    ] as const) {
      const result = await put(
        actor,
        `/api/matches/${match._id}/availability/${endpoint}`,
        command
      );
      expect(result.status).toBe(200);
      expect(result.body.data).toMatchObject({
        version: 0,
        availability: [],
        updatedAt: match.updatedAt.toISOString(),
      });
      const obsolete = await put(
        actor,
        `/api/matches/${match._id}/availability/${endpoint}`,
        { ...command, replyStatus: 'confirmed' }
      );
      expect(obsolete.status).toBe(400);
    }
    expect((await Player.findById(player._id))?.get('__v')).toBe(playerVersion);
    await PlayerService.removePlayerFromTeam(
      player._id.toString(),
      team._id.toString()
    );
    await expect(
      MatchAvailabilityService.setPlayerAvailability(
        match._id.toString(),
        player._id.toString(),
        command
      )
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it.each([
    'confirmed',
    'pending',
  ])('ignores raw legacy %s values while preserving participation and Lineup references', async (replyStatus) => {
    const admin = await createUser(true, MembershipStatus.ACTIVE, false);
    const team = await createTeam(admin._id);
    const availableUser = await createUser(
      false,
      MembershipStatus.ACTIVE,
      true
    );
    const unavailableUser = await createUser(
      false,
      MembershipStatus.ACTIVE,
      true
    );
    const available = await createPlayer(availableUser._id, PlayerType.MEMBER, [
      team._id,
    ]);
    const unavailable = await createPlayer(
      unavailableUser._id,
      PlayerType.MEMBER,
      [team._id]
    );
    const match = await createMatch({
      createdById: admin._id,
      teamId: team._id,
      lineup: [
        {
          position: LineupPosition.WOMEN_SINGLES,
          playerId: unavailable._id,
          playerNameSnapshot: 'Retained Player',
        },
      ],
    });
    const legacyEntries = [
      {
        playerId: available._id,
        participation: MatchAvailabilityParticipation.AVAILABLE,
        replyStatus,
      },
      {
        playerId: unavailable._id,
        participation: MatchAvailabilityParticipation.UNAVAILABLE,
        replyStatus,
      },
    ];
    // Bypass Mongoose so the read actually encounters retained legacy BSON.
    await Match.collection.updateOne(
      { _id: match._id },
      { $set: { availability: legacyEntries } }
    );
    const untouched = await createMatch({
      createdById: admin._id,
      teamId: team._id,
      startAt: new Date('2099-08-02T10:00:00Z'),
    });
    await Match.collection.updateOne(
      { _id: untouched._id },
      { $set: { availability: legacyEntries } }
    );
    const expectedEntries = legacyEntries.map(
      ({ playerId, participation }) => ({
        playerId: playerId.toString(),
        participation,
      })
    );
    const detail = await request(createApp())
      .get(`/api/matches/${match._id}`)
      .set('Cookie', await tokenFor(admin._id));
    expect(detail.status).toBe(200);
    expect(detail.body.data.availability).toEqual(expectedEntries);
    expect(detail.body.data.lineup).toEqual(lineupSnapshot(match.lineup));
    const context = await MatchLineupService.getContext(match._id.toString());
    expect(context.candidates.map((entry) => entry.playerId)).toEqual([
      available._id.toString(),
    ]);
    expect(context.candidates[0]).not.toHaveProperty('replyStatus');
    expect(context.lineupWarnings).toContainEqual(
      expect.objectContaining({
        code: LineupViolationCode.PLAYER_UNAVAILABLE,
        playerId: unavailable._id.toString(),
      })
    );
    await expect(
      MatchLineupService.setLineup(match._id.toString(), {
        expectedVersion: 0,
        lineup: [
          {
            position: LineupPosition.MIXED_DOUBLES,
            playerId: unavailable._id.toString(),
          },
        ],
      })
    ).rejects.toMatchObject({ statusCode: 400 });
    const changed = await put(
      admin._id,
      `/api/matches/${match._id}/availability/${unavailable._id}`,
      {
        expectedVersion: 0,
        participation: MatchAvailabilityParticipation.AVAILABLE,
      }
    );
    expect(changed.status).toBe(200);
    expect(changed.body.data.version).toBe(1);
    expect(changed.body.data.lineup).toEqual(lineupSnapshot(match.lineup));
    expect(changed.body.data.availability).toEqual(
      expect.arrayContaining([
        {
          playerId: available._id.toString(),
          participation: MatchAvailabilityParticipation.AVAILABLE,
        },
        {
          playerId: unavailable._id.toString(),
          participation: MatchAvailabilityParticipation.AVAILABLE,
        },
      ])
    );
    const raw = await Match.collection.findOne({ _id: match._id });
    expect(raw?.availability).toHaveLength(2);
    for (const entry of raw?.availability ?? [])
      expect(entry).not.toHaveProperty('replyStatus');
    expect(
      (await Match.collection.findOne({ _id: untouched._id }))?.availability
    ).toEqual(legacyEntries);
    const updatedContext = await MatchLineupService.getContext(
      match._id.toString()
    );
    expect(updatedContext.lineupWarnings).not.toContainEqual(
      expect.objectContaining({ code: LineupViolationCode.PLAYER_UNAVAILABLE })
    );
  });

  it('enforces the exact Player start boundary while administrators remain unrestricted', async () => {
    const admin = await createUser(true, MembershipStatus.ACTIVE, false);
    const member = await createUser(false, MembershipStatus.ACTIVE, true);
    const team = await createTeam(admin._id);
    const player = await createPlayer(member._id, PlayerType.MEMBER, [
      team._id,
    ]);
    const startAt = new Date('2099-08-01T10:00:00.000Z');
    const match = await createMatch({
      createdById: admin._id,
      teamId: team._id,
      startAt,
    });

    await expect(
      MatchAvailabilityService.setOwnAvailability(
        match._id.toString(),
        {
          expectedVersion: 0,
          participation: MatchAvailabilityParticipation.UNAVAILABLE,
        },
        {
          userId: member._id.toString(),
          playerId: player._id.toString(),
        },
        new Date(startAt.getTime() - 1)
      )
    ).resolves.toMatchObject({ version: 1 });

    await expect(
      MatchAvailabilityService.setOwnAvailability(
        match._id.toString(),
        {
          expectedVersion: 1,
          participation: MatchAvailabilityParticipation.UNAVAILABLE,
        },
        {
          userId: member._id.toString(),
          playerId: player._id.toString(),
        },
        startAt
      )
    ).rejects.toMatchObject({ statusCode: 409 });
    expect((await Match.findById(match._id))?.__v).toBe(1);

    const pastMatch = await createMatch({
      createdById: admin._id,
      teamId: team._id,
      startAt: new Date('2000-01-01T00:00:00.000Z'),
    });
    await expect(
      MatchAvailabilityService.setPlayerAvailability(
        pastMatch._id.toString(),
        player._id.toString(),
        {
          expectedVersion: 0,
          participation: MatchAvailabilityParticipation.UNAVAILABLE,
        }
      )
    ).resolves.toMatchObject({ version: 1 });
  });

  it('supports both administrator states and preserves explicit default corrections', async () => {
    const admin = await createUser(true, MembershipStatus.ACTIVE, false);
    const member = await createUser(false, MembershipStatus.ACTIVE, true);
    const unrelatedUser = await createUser(
      false,
      MembershipStatus.ACTIVE,
      true
    );
    const team = await createTeam(admin._id);
    const unrelatedTeam = await createTeam(admin._id);
    const player = await createPlayer(member._id, PlayerType.MEMBER, [
      team._id,
    ]);
    const unrelatedPlayer = await createPlayer(
      unrelatedUser._id,
      PlayerType.MEMBER,
      [unrelatedTeam._id]
    );
    const match = await createMatch({
      createdById: admin._id,
      teamId: team._id,
    });

    const defaultNoOp = await MatchAvailabilityService.setPlayerAvailability(
      match._id.toString(),
      player._id.toString(),
      {
        expectedVersion: 0,
        participation: MatchAvailabilityParticipation.AVAILABLE,
      }
    );
    expect(defaultNoOp).toMatchObject({ version: 0, availability: [] });

    const states = [
      { participation: MatchAvailabilityParticipation.UNAVAILABLE },
      { participation: MatchAvailabilityParticipation.AVAILABLE },
    ];
    for (const [index, state] of states.entries()) {
      const updated = await MatchAvailabilityService.setPlayerAvailability(
        match._id.toString(),
        player._id.toString(),
        { expectedVersion: index, ...state }
      );
      expect(updated).toMatchObject({
        version: index + 1,
        availability: [{ playerId: player._id.toString(), ...state }],
      });
    }

    await expect(
      MatchAvailabilityService.setPlayerAvailability(
        match._id.toString(),
        unrelatedPlayer._id.toString(),
        {
          expectedVersion: 2,
          participation: MatchAvailabilityParticipation.UNAVAILABLE,
        }
      )
    ).rejects.toMatchObject({ statusCode: 400 });

    await expect(
      Match.create(
        withMatchScheduleDuplicateKey({
          teamId: team._id,
          opponentName: 'Duplicate Visitors',
          direction: MatchDirection.HOME,
          startAt: new Date('2099-08-02T10:00:00.000Z'),
          location: 'Duplicate Hall',
          lineup: [],
          availability: [
            { playerId: player._id, ...states[0] },
            { playerId: player._id, ...states[1] },
          ],
          createdById: admin._id,
        })
      )
    ).rejects.toThrow('only one entry per Player');
  });

  it('preserves retained entries and Lineup while former Players lose Match scope', async () => {
    const admin = await createUser(true, MembershipStatus.ACTIVE, false);
    const member = await createUser(false, MembershipStatus.ACTIVE, true);
    const team = await createTeam(admin._id);
    const player = await createPlayer(member._id, PlayerType.MEMBER, [
      team._id,
    ]);
    const match = await createMatch({
      createdById: admin._id,
      teamId: team._id,
      availability: [
        {
          playerId: player._id,
          participation: MatchAvailabilityParticipation.UNAVAILABLE,
        },
      ],
      lineup: [
        {
          position: LineupPosition.WOMEN_SINGLES,
          playerId: player._id,
          playerNameSnapshot: 'Retained Player',
        },
      ],
    });
    const lineupBefore = lineupSnapshot(match.lineup);

    await PlayerService.removePlayerFromTeam(
      player._id.toString(),
      team._id.toString()
    );
    await expect(
      MatchAvailabilityService.setOwnAvailability(
        match._id.toString(),
        {
          expectedVersion: 0,
          participation: MatchAvailabilityParticipation.AVAILABLE,
        },
        {
          userId: member._id.toString(),
          playerId: player._id.toString(),
        }
      )
    ).rejects.toMatchObject({ statusCode: 404 });

    const corrected = await MatchAvailabilityService.setPlayerAvailability(
      match._id.toString(),
      player._id.toString(),
      {
        expectedVersion: 0,
        participation: MatchAvailabilityParticipation.AVAILABLE,
      }
    );
    expect(corrected).toMatchObject({
      version: 1,
      availability: [
        {
          playerId: player._id.toString(),
          participation: MatchAvailabilityParticipation.AVAILABLE,
        },
      ],
    });
    const persisted = await Match.findById(match._id);
    expect(persisted && lineupSnapshot(persisted.lineup)).toEqual(lineupBefore);
    expect(await AuditLog.countDocuments({})).toBe(0);
  });

  it('uses Match versioning against a concurrent C1 writer and rolls back its Player claim on loss', async () => {
    const admin = await createUser(true, MembershipStatus.ACTIVE, false);
    const member = await createUser(false, MembershipStatus.ACTIVE, true);
    const team = await createTeam(admin._id);
    const player = await createPlayer(member._id, PlayerType.MEMBER, [
      team._id,
    ]);
    const match = await createMatch({
      createdById: admin._id,
      teamId: team._id,
    });
    const playerVersionBefore = player.get('__v');
    const actor: MatchCommandActor = {
      id: admin._id.toString(),
      email: admin.email,
      accountKind: AccountKind.PERSON,
      displayName: 'Administrator',
      capabilities: [Capability.ADMINISTRATION],
    };

    const outcomes = await Promise.allSettled([
      MatchAvailabilityService.setPlayerAvailability(
        match._id.toString(),
        player._id.toString(),
        {
          expectedVersion: 0,
          participation: MatchAvailabilityParticipation.UNAVAILABLE,
        }
      ),
      MatchService.updateMatch(
        match._id.toString(),
        {
          expectedVersion: 0,
          teamId: team._id.toString(),
          opponentName: 'Concurrent Visitors',
          direction: MatchDirection.HOME,
          localDate: '2099-08-01',
          localTime: '12:00',
          location: 'C3 Hall',
        },
        actor
      ),
    ]);

    expect(
      outcomes.filter((outcome) => outcome.status === 'fulfilled')
    ).toHaveLength(1);
    expect(
      outcomes.filter((outcome) => outcome.status === 'rejected')
    ).toHaveLength(1);
    expect(
      (
        outcomes.find(
          (outcome) => outcome.status === 'rejected'
        ) as PromiseRejectedResult
      ).reason
    ).toMatchObject({ statusCode: 409 });

    const persisted = await Match.findById(match._id);
    expect(persisted?.__v).toBe(1);
    const availabilityWon = persisted?.availability.length === 1;
    expect(persisted?.opponentName).toBe(
      availabilityWon ? 'C3 Visitors' : 'Concurrent Visitors'
    );
    expect((await Player.findById(player._id))?.get('__v')).toBe(
      playerVersionBefore + (availabilityWon ? 1 : 0)
    );
    expect(
      await AuditLog.countDocuments({
        eventType: AuditEventType.MATCH_UPDATED,
      })
    ).toBe(availabilityWon ? 0 : 1);
  });

  it('deletes embedded Availability with the Match aggregate', async () => {
    const admin = await createUser(true, MembershipStatus.ACTIVE, false);
    const member = await createUser(false, MembershipStatus.ACTIVE, true);
    const team = await createTeam(admin._id);
    const player = await createPlayer(member._id, PlayerType.MEMBER, [
      team._id,
    ]);
    const match = await createMatch({
      createdById: admin._id,
      teamId: team._id,
      availability: [
        {
          playerId: player._id,
          participation: MatchAvailabilityParticipation.UNAVAILABLE,
        },
      ],
    });
    const actor: MatchCommandActor = {
      id: admin._id.toString(),
      email: admin.email,
      accountKind: AccountKind.PERSON,
      displayName: 'Administrator',
      capabilities: [Capability.ADMINISTRATION],
    };

    await MatchService.deleteMatch(
      match._id.toString(),
      { expectedVersion: 0 },
      actor
    );
    expect(await Match.findById(match._id)).toBeNull();
    expect(
      await AuditLog.countDocuments({
        eventType: AuditEventType.MATCH_DELETED,
      })
    ).toBe(1);
  });
});
