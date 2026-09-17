import { randomUUID } from 'node:crypto';
import {
  acquireMongoTestDatabase,
  type MongoTestDatabaseLease,
} from '../infrastructure/mongoTestDatabase';
import {
  AccountKind,
  AuditEventType,
  Capability,
  EntityType,
  Gender,
  LineupPosition,
  MatchAvailabilityParticipation,
  MatchDirection,
  MembershipStatus,
  PlayerType,
  TeamLevel,
} from '@club/shared-types/core/enums';
import mongoose from 'mongoose';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { AuditLog } from '../../models/AuditLog';
import { Match } from '../../models/Match';
import { Player } from '../../models/Player';
import { Team } from '../../models/Team';
import { User } from '../../models/User';
import {
  MatchService,
  type MatchCommandActor,
} from '../../services/matchService';
import { PlayerService } from '../../services/playerService';
import { TeamService } from '../../services/teamService';
import { withMatchScheduleDuplicateKey } from '../../services/matchScheduleDuplicateKey';
import { RequiredAuditPersistenceError } from '../../utils/errors';

let mongoLease: MongoTestDatabaseLease;

async function createAdmin() {
  return User.create({
    email: `${randomUUID()}@example.test`,
    firstName: 'Team',
    lastName: 'Administrator',
    password: 'ValidPassword1',
    gender: Gender.FEMALE,
    dateOfBirth: '1990-01-01',
    accountKind: AccountKind.PERSON,
    administratorDesignation: true,
    displayName: 'Administrator',
    capabilities: [Capability.ADMINISTRATION],
    membershipStatus: MembershipStatus.ACTIVE,
    isPlayer: false,
  });
}

async function createPlayer(userId: mongoose.Types.ObjectId) {
  return Player.create({
    userId,
    type: PlayerType.MEMBER,
    singlesRanking: 0,
    doublesRanking: 0,
    preferredPositions: [],
    isActivePlayer: true,
    teamIds: [],
  });
}

async function createTeam(createdById: mongoose.Types.ObjectId) {
  const teamId = randomUUID().replaceAll('-', '').slice(0, 10);
  return Team.create({
    teamId,
    shortName: `Team ${teamId}`,
    leagueTeamName: `League Team ${teamId}`,
    matchLevel: TeamLevel.A,
    createdById,
  });
}

function actorFor(
  admin: Awaited<ReturnType<typeof createAdmin>>
): MatchCommandActor {
  return {
    id: admin._id.toString(),
    email: admin.email,
    accountKind: AccountKind.PERSON,
    displayName: 'Administrator',
    capabilities: [Capability.ADMINISTRATION],
    ipAddress: '127.0.0.1',
    userAgent: 'Team deletion persistence test',
  };
}

function matchRequest(teamId: string, overrides: Record<string, unknown> = {}) {
  return {
    teamId,
    opponentName: 'Visitors',
    direction: MatchDirection.HOME,
    localDate: '2026-08-15',
    localTime: '19:30',
    location: 'Team Deletion Hall',
    ...overrides,
  };
}

async function createRetainedMatch(
  teamId: mongoose.Types.ObjectId,
  createdById: mongoose.Types.ObjectId
) {
  const retainedPlayerId = new mongoose.Types.ObjectId();
  return Match.create(
    withMatchScheduleDuplicateKey({
      teamId,
      opponentName: 'Retained Visitors',
      direction: MatchDirection.HOME,
      startAt: new Date('2026-08-15T17:30:00.000Z'),
      location: 'Retained Hall',
      lineup: [
        {
          position: LineupPosition.MEN_SINGLES_1,
          playerId: retainedPlayerId,
          playerNameSnapshot: 'Retained Player',
        },
      ],
      availability: [
        {
          playerId: retainedPlayerId,
          participation: MatchAvailabilityParticipation.UNAVAILABLE,
        },
      ],
      createdById,
    })
  );
}

async function expectDependencyConflict(
  teamId: mongoose.Types.ObjectId,
  actor: MatchCommandActor
) {
  await expect(
    TeamService.deleteTeam(teamId.toString(), actor)
  ).rejects.toMatchObject({
    statusCode: 409,
    code: 'TEAM_DELETE_DEPENDENCIES',
  });
}

async function overlapFirstTwoClaims(
  operations: [() => Promise<unknown>, () => Promise<unknown>]
) {
  const originalClaim = TeamService.claimTeams;
  let claimCount = 0;
  let release: () => void;
  const bothClaimsReached = new Promise<void>((resolve) => {
    release = resolve;
  });

  vi.spyOn(TeamService, 'claimTeams').mockImplementation(
    async (teamIds, session) => {
      if (claimCount < 2) {
        claimCount += 1;
        if (claimCount === 2) release();
        await bothClaimsReached;
      }
      await originalClaim(teamIds, session);
    }
  );

  return Promise.allSettled(operations.map((operation) => operation()));
}

beforeAll(async () => {
  mongoLease = await acquireMongoTestDatabase('teamDeletion');
  mongoLease.assertOwnedDatabase();
  await Promise.all([
    User.syncIndexes(),
    Player.syncIndexes(),
    Team.syncIndexes(),
    Match.syncIndexes(),
    AuditLog.syncIndexes(),
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
  ]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await mongoLease.release();
});

describe('Issue #161 Team deletion persistence', () => {
  it('deletes an unreferenced Team with exactly one required audit', async () => {
    const admin = await createAdmin();
    const team = await createTeam(admin._id);
    const actor = actorFor(admin);

    await TeamService.deleteTeam(team._id.toString(), actor);

    expect(await Team.findById(team._id)).toBeNull();
    const audits = await AuditLog.find({
      eventType: AuditEventType.TEAM_DELETED,
      entityId: team._id,
    }).lean();
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      entityType: EntityType.TEAM,
      actorId: admin._id,
      actorAccountKind: AccountKind.PERSON,
      source: 'human',
    });
  });

  it('refuses deletion with a current Player association without mutation or deletion audit', async () => {
    const admin = await createAdmin();
    const team = await createTeam(admin._id);
    const player = await createPlayer(admin._id);
    const actor = actorFor(admin);
    await PlayerService.addPlayerToTeam(
      player._id.toString(),
      team._id.toString()
    );

    await expectDependencyConflict(team._id, actor);

    expect(await Team.findById(team._id)).not.toBeNull();
    expect((await Player.findById(player._id))?.teamIds.map(String)).toEqual([
      team._id.toString(),
    ]);
    expect(
      await AuditLog.countDocuments({
        eventType: AuditEventType.TEAM_DELETED,
        entityId: team._id,
      })
    ).toBe(0);
  });

  it('refuses deletion with a retained Match reference without rewriting Match-owned facts', async () => {
    const admin = await createAdmin();
    const team = await createTeam(admin._id);
    const actor = actorFor(admin);
    const match = await createRetainedMatch(team._id, admin._id);
    const before = await Match.findById(match._id).lean();

    await expectDependencyConflict(team._id, actor);

    const after = await Match.findById(match._id).lean();
    expect(await Team.findById(team._id)).not.toBeNull();
    expect(after).toMatchObject({
      teamId: before?.teamId,
      lineup: before?.lineup,
      availability: before?.availability,
    });
    expect(
      await AuditLog.countDocuments({
        eventType: AuditEventType.TEAM_DELETED,
        entityId: team._id,
      })
    ).toBe(0);
  });

  it('refuses deletion when both Player and Match dependencies exist without partial change', async () => {
    const admin = await createAdmin();
    const team = await createTeam(admin._id);
    const player = await createPlayer(admin._id);
    const actor = actorFor(admin);
    await PlayerService.addPlayerToTeam(
      player._id.toString(),
      team._id.toString()
    );
    const match = await createRetainedMatch(team._id, admin._id);
    const beforePlayer = await Player.findById(player._id).lean();
    const beforeMatch = await Match.findById(match._id).lean();

    await expectDependencyConflict(team._id, actor);

    expect(await Team.findById(team._id)).not.toBeNull();
    expect(await Player.findById(player._id).lean()).toMatchObject({
      teamIds: beforePlayer?.teamIds,
    });
    expect(await Match.findById(match._id).lean()).toMatchObject({
      teamId: beforeMatch?.teamId,
      lineup: beforeMatch?.lineup,
      availability: beforeMatch?.availability,
    });
    expect(
      await AuditLog.countDocuments({
        eventType: AuditEventType.TEAM_DELETED,
        entityId: team._id,
      })
    ).toBe(0);
  });

  it('keeps Team business fields and timestamps unchanged when dependency writers claim it', async () => {
    const admin = await createAdmin();
    const team = await createTeam(admin._id);
    const player = await createPlayer(admin._id);
    const actor = actorFor(admin);
    const before = await Team.findById(team._id).lean();

    await PlayerService.addPlayerToTeam(
      player._id.toString(),
      team._id.toString()
    );
    const afterPlayerAssociation = await Team.findById(team._id).lean();
    await MatchService.createMatch(matchRequest(team._id.toString()), actor);
    const afterMatchCreation = await Team.findById(team._id).lean();

    const beforeTimestamps = before as
      | (typeof before & { createdAt?: Date; updatedAt?: Date })
      | null;

    for (const version of [afterPlayerAssociation, afterMatchCreation]) {
      const versionTimestamps = version as
        | (typeof version & { createdAt?: Date; updatedAt?: Date })
        | null;
      expect(version).toMatchObject({
        teamId: before?.teamId,
        shortName: before?.shortName,
        leagueTeamName: before?.leagueTeamName,
        createdById: before?.createdById,
      });
      expect(version?.matchLevel).toBe(before?.matchLevel);
      expect(versionTimestamps?.createdAt?.toISOString()).toBe(
        beforeTimestamps?.createdAt?.toISOString()
      );
      expect(versionTimestamps?.updatedAt?.toISOString()).toBe(
        beforeTimestamps?.updatedAt?.toISOString()
      );
    }
    expect(afterPlayerAssociation?.__v).toBe((before?.__v ?? 0) + 1);
    expect(afterMatchCreation?.__v).toBe((before?.__v ?? 0) + 2);
  });

  it('prevents a concurrent Player association and deletion from committing a dangling reference', async () => {
    const admin = await createAdmin();
    const team = await createTeam(admin._id);
    const player = await createPlayer(admin._id);
    const actor = actorFor(admin);

    const results = await overlapFirstTwoClaims([
      () => TeamService.deleteTeam(team._id.toString(), actor),
      () =>
        PlayerService.addPlayerToTeam(
          player._id.toString(),
          team._id.toString()
        ),
    ]);

    expect(
      results.filter((result) => result.status === 'fulfilled')
    ).toHaveLength(1);
    const teamAfter = await Team.findById(team._id);
    const playerAfter = await Player.findById(player._id);
    expect(
      playerAfter?.teamIds.some((id) => id.equals(team._id)) ?? false
    ).toBe(teamAfter !== null);
  });

  it.each([
    'create',
    'reassign',
  ] as const)('prevents concurrent Match %s from committing a dangling Team reference', async (operation) => {
    const admin = await createAdmin();
    const deletingTeam = await createTeam(admin._id);
    const actor = actorFor(admin);
    const sourceTeam = await createTeam(admin._id);
    const existing =
      operation === 'reassign'
        ? await MatchService.createMatch(
            matchRequest(sourceTeam._id.toString()),
            actor
          )
        : undefined;

    const results = await overlapFirstTwoClaims([
      () => TeamService.deleteTeam(deletingTeam._id.toString(), actor),
      () =>
        operation === 'create'
          ? MatchService.createMatch(
              matchRequest(deletingTeam._id.toString()),
              actor
            )
          : MatchService.updateMatch(
              existing!.id,
              {
                expectedVersion: existing!.version,
                ...matchRequest(deletingTeam._id.toString()),
              },
              actor
            ),
    ]);

    expect(
      results.filter((result) => result.status === 'fulfilled')
    ).toHaveLength(1);
    const teamAfter = await Team.findById(deletingTeam._id);
    const matchReferences = await Match.countDocuments({
      teamId: deletingTeam._id,
    });
    expect(matchReferences > 0).toBe(teamAfter !== null);
    if (operation === 'reassign' && !teamAfter) {
      expect((await Match.findById(existing!.id))?.teamId).toEqual(
        sourceTeam._id
      );
    }
  });

  it('rolls back Team deletion when its required audit cannot persist', async () => {
    const admin = await createAdmin();
    const team = await createTeam(admin._id);
    const actor = actorFor(admin);
    vi.spyOn(AuditLog, 'create').mockRejectedValueOnce(
      new Error('Injected audit failure')
    );

    await expect(
      TeamService.deleteTeam(team._id.toString(), actor)
    ).rejects.toBeInstanceOf(RequiredAuditPersistenceError);

    expect(await Team.findById(team._id)).not.toBeNull();
    expect(
      await AuditLog.countDocuments({
        eventType: AuditEventType.TEAM_DELETED,
        entityId: team._id,
      })
    ).toBe(0);
  });
});
