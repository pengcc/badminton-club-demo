import { randomUUID } from 'node:crypto';
import {
  acquireMongoTestDatabase,
  type MongoTestDatabaseLease,
} from '../infrastructure/mongoTestDatabase';
import mongoose, { type ClientSession } from 'mongoose';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  AuditEventType,
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
import {
  MembershipInactivePlayerOutcome,
  MembershipLifecycleOperation,
  type MembershipLifecycleCommand,
  type MembershipLifecycleResult,
  type MembershipLifecycleState,
  type TransitionMembershipCommand,
} from '@club/shared-types/domain/membershipLifecycle';
import { UserController } from '../../controllers/userController';
import { AuditLog } from '../../models/AuditLog';
import { Match } from '../../models/Match';
import { MemberBankingProfile } from '../../models/MemberBankingProfile';
import {
  MembershipLifecycleEvent,
  MembershipLifecycleEventStatus,
} from '../../models/MembershipLifecycleEvent';
import {
  RegistrationApprovalEvent,
  RegistrationApprovalStatus,
} from '../../models/RegistrationApprovalEvent';
import { withMatchScheduleDuplicateKey } from '../../services/matchScheduleDuplicateKey';
import { Player } from '../../models/Player';
import { Team } from '../../models/Team';
import { User } from '../../models/User';
import {
  MembershipLifecycleService,
  MongoMembershipLifecycleRepository,
  type LoadedLifecycleState,
} from '../../services/membershipLifecycleService';
import {
  MAX_PLAYER_BATCH_SIZE,
  PlayerService,
} from '../../services/playerService';
import { PlayerLifecycleAdministrationService } from '../../services/playerLifecycleAdministrationService';
import { PlayerCleanupService } from '../../services/playerCleanupService';
import { AccountDeletionService } from '../../services/accountDeletionService';

const actor = {
  id: new mongoose.Types.ObjectId().toString(),
  email: 'admin@example.test',
  accountKind: AccountKind.PERSON,
  administratorDesignation: true,
  displayName: 'Administrator',
  capabilities: [Capability.ADMINISTRATION],
};

class LoadBarrier {
  private arrivals = 0;
  private release!: () => void;
  private readonly released = new Promise<void>((resolve) => {
    this.release = resolve;
  });

  constructor(private readonly parties: number) {}

  async wait(): Promise<void> {
    this.arrivals += 1;
    if (this.arrivals >= this.parties) this.release();
    await this.released;
  }
}

class BarrierLifecycleRepository extends MongoMembershipLifecycleRepository {
  constructor(private readonly barrier: LoadBarrier) {
    super();
  }

  override async load(
    userId: string,
    session: ClientSession
  ): Promise<LoadedLifecycleState> {
    const loaded = await super.load(userId, session);
    await this.barrier.wait();
    return loaded;
  }
}

class DeferredLoadRepository extends MongoMembershipLifecycleRepository {
  private releaseLoad!: () => void;
  private markLoaded!: () => void;
  readonly loaded = new Promise<void>((resolve) => {
    this.markLoaded = resolve;
  });
  private readonly loadRelease = new Promise<void>((resolve) => {
    this.releaseLoad = resolve;
  });

  release(): void {
    this.releaseLoad();
  }

  override async load(
    userId: string,
    session: ClientSession
  ): Promise<LoadedLifecycleState> {
    const loaded = await super.load(userId, session);
    this.markLoaded();
    await this.loadRelease;
    return loaded;
  }
}

class AuditFailureRepository extends MongoMembershipLifecycleRepository {
  override async audit(
    _command: MembershipLifecycleCommand,
    _before: MembershipLifecycleState,
    _result: MembershipLifecycleResult,
    _session: ClientSession
  ): Promise<mongoose.Types.ObjectId> {
    throw new Error('injected audit failure');
  }
}

let mongoLease: MongoTestDatabaseLease;

async function createUser(
  membershipStatus: MembershipStatus = MembershipStatus.ACTIVE
) {
  return User.create({
    email: `${randomUUID()}@example.test`,
    firstName: 'Test',
    lastName: 'Member',
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

async function createMemberPlayer(userId: mongoose.Types.ObjectId) {
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

async function createMemberBankingProfile(userId: mongoose.Types.ObjectId) {
  const applicationId = new mongoose.Types.ObjectId();
  const approvalEvent = await RegistrationApprovalEvent.create({
    applicationId,
    idempotencyKey: `banking-cleanup-${randomUUID()}`,
    intentFingerprint: `banking-cleanup-${randomUUID()}`,
    status: RegistrationApprovalStatus.COMPLETED,
    result: {
      applicationId: applicationId.toString(),
      userId: userId.toString(),
      setupGeneration: 1,
      setupRequired: false,
    },
  });
  const profile = await MemberBankingProfile.create({
    userId,
    encryptedBanking: {
      keyVersion: 'fixture-key-version',
      nonce: 'fixture-nonce',
      ciphertext: 'fixture-ciphertext',
      authTag: 'fixture-auth-tag',
    },
    bankingSummary: { present: true, complete: true, ibanLastFour: '1234' },
    sourceApplicationId: applicationId,
  });
  return { approvalEvent, profile };
}

async function createTeam(createdById: mongoose.Types.ObjectId, teamId = 't1') {
  return Team.create({
    teamId,
    shortName: `Team ${teamId}`,
    leagueTeamName: `League Team ${teamId}`,
    matchLevel: TeamLevel.E,
    createdById,
  });
}

function transition(
  userId: string,
  idempotencyKey: string,
  expectedMembershipStatus: MembershipStatus,
  targetMembershipStatus: MembershipStatus
): TransitionMembershipCommand {
  return {
    operation: MembershipLifecycleOperation.TRANSITION_MEMBERSHIP,
    userId,
    expectedMembershipStatus,
    targetMembershipStatus,
    actor,
    reason: `Transition to ${targetMembershipStatus}`,
    idempotencyKey,
    occurredAt: new Date('2026-07-13T12:00:00.000Z'),
  };
}

beforeAll(async () => {
  mongoLease = await acquireMongoTestDatabase('membershipLifecycle');
  mongoLease.assertOwnedDatabase();
  await Promise.all([
    User.syncIndexes(),
    Player.syncIndexes(),
    Team.syncIndexes(),
    Match.syncIndexes(),
    AuditLog.syncIndexes(),
    MembershipLifecycleEvent.syncIndexes(),
    MemberBankingProfile.syncIndexes(),
    RegistrationApprovalEvent.syncIndexes(),
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
    MembershipLifecycleEvent.deleteMany({}),
    MemberBankingProfile.deleteMany({}),
    RegistrationApprovalEvent.deleteMany({}),
  ]);
});

afterAll(async () => {
  await mongoLease.release();
});

describe('WP5 real Mongoose persistence guarantees', () => {
  it('rolls back lifecycle claim, writes, audit, and completion with the caller transaction', async () => {
    const user = await createUser();
    await createMemberPlayer(user._id);
    const service = new MembershipLifecycleService();
    const session = await mongoose.startSession();

    try {
      await expect(
        session.withTransaction(async () => {
          await service.executeInSession(
            transition(
              user._id.toString(),
              'caller-session-rollback',
              MembershipStatus.ACTIVE,
              MembershipStatus.PASSIVE
            ),
            session
          );
          throw new Error('injected caller failure');
        })
      ).rejects.toThrow('injected caller failure');
    } finally {
      await session.endSession();
    }

    expect((await User.findById(user._id))?.membershipStatus).toBe(
      MembershipStatus.ACTIVE
    );
    expect(
      await MembershipLifecycleEvent.countDocuments({
        idempotencyKey: 'caller-session-rollback',
      })
    ).toBe(0);
    expect(await AuditLog.countDocuments({ entityId: user._id })).toBe(0);
  });

  it('replays a lost-response retry and rejects same-key different intent', async () => {
    const user = await createUser();
    await createMemberPlayer(user._id);
    const service = new MembershipLifecycleService();
    const key = 'single-lost-response-retry';
    const command = transition(
      user._id.toString(),
      key,
      MembershipStatus.ACTIVE,
      MembershipStatus.PASSIVE
    );

    const first = await service.execute(command);
    const replay = await service.execute({
      ...command,
      expectedMembershipStatus: MembershipStatus.PASSIVE,
      occurredAt: new Date('2026-07-13T12:05:00.000Z'),
    });

    expect(first.replayed).toBe(false);
    expect(replay).toEqual({ ...first, replayed: true });
    await expect(
      service.execute({
        ...command,
        targetMembershipStatus: MembershipStatus.ACTIVE,
      })
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(await MembershipLifecycleEvent.countDocuments({})).toBe(1);
    expect(await AuditLog.countDocuments({})).toBe(1);
  });

  it('forces conflicting commands to load the same stale state', async () => {
    const user = await createUser();
    await createMemberPlayer(user._id);
    const barrier = new LoadBarrier(2);
    const services = [
      new MembershipLifecycleService(new BarrierLifecycleRepository(barrier)),
      new MembershipLifecycleService(new BarrierLifecycleRepository(barrier)),
    ];

    const outcomes = await Promise.allSettled([
      services[0].execute(
        transition(
          user._id.toString(),
          'concurrent-command-passive',
          MembershipStatus.ACTIVE,
          MembershipStatus.PASSIVE
        )
      ),
      services[1].execute(
        transition(
          user._id.toString(),
          'concurrent-command-inactive',
          MembershipStatus.ACTIVE,
          MembershipStatus.INACTIVE
        )
      ),
    ]);

    expect(
      outcomes.filter((outcome) => outcome.status === 'fulfilled')
    ).toHaveLength(1);
    expect(
      outcomes.filter((outcome) => outcome.status === 'rejected')
    ).toHaveLength(1);
    expect(await AuditLog.countDocuments({})).toBe(1);
    expect(
      await MembershipLifecycleEvent.countDocuments({
        status: MembershipLifecycleEventStatus.COMPLETED,
      })
    ).toBe(1);
  });

  it('rolls back coordinated lifecycle writes when auditing fails', async () => {
    const user = await createUser();
    const player = await createMemberPlayer(user._id);
    const service = new MembershipLifecycleService(
      new AuditFailureRepository()
    );

    await expect(
      service.execute(
        transition(
          user._id.toString(),
          'transaction-rollback',
          MembershipStatus.ACTIVE,
          MembershipStatus.PASSIVE
        )
      )
    ).rejects.toThrow('injected audit failure');

    expect((await User.findById(user._id))?.membershipStatus).toBe(
      MembershipStatus.ACTIVE
    );
    expect((await Player.findById(player._id))?.isActivePlayer).toBe(true);
    expect(await AuditLog.countDocuments({})).toBe(0);
    expect(
      await MembershipLifecycleEvent.findOne({
        idempotencyKey: 'transaction-rollback',
      })
    ).toMatchObject({ status: MembershipLifecycleEventStatus.FAILED });
  });

  it('atomically continues one member Player as external and fingerprints the outcome', async () => {
    const user = await createUser();
    const player = await createMemberPlayer(user._id);
    const { profile } = await createMemberBankingProfile(user._id);
    const team = await createTeam(user._id, 'cont1');
    await PlayerService.addPlayerToTeam(
      player._id.toString(),
      team._id.toString()
    );
    const service = new MembershipLifecycleService();
    const command = {
      ...transition(
        user._id.toString(),
        'member-external-continuation',
        MembershipStatus.ACTIVE,
        MembershipStatus.INACTIVE
      ),
      inactivePlayerOutcome:
        MembershipInactivePlayerOutcome.CONTINUE_AS_EXTERNAL,
    };

    const first = await service.execute(command);
    const replay = await service.execute({
      ...command,
      expectedMembershipStatus: MembershipStatus.INACTIVE,
    });
    expect(first).toMatchObject({
      membershipStatus: MembershipStatus.INACTIVE,
      inactivePlayerOutcome:
        MembershipInactivePlayerOutcome.CONTINUE_AS_EXTERNAL,
      player: {
        id: player._id.toString(),
        type: PlayerType.EXTERNAL,
        isActivePlayer: true,
        teamIds: [team._id.toString()],
      },
    });
    expect(replay.replayed).toBe(true);
    expect(await MemberBankingProfile.findById(profile._id)).not.toBeNull();
    await expect(
      service.execute({
        ...command,
        inactivePlayerOutcome:
          MembershipInactivePlayerOutcome.END_PARTICIPATION,
      })
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('runs bounded Player lifecycle batches with explicit per-target outcomes', async () => {
    const enabledUser = await createUser();
    enabledUser.isPlayer = false;
    await enabledUser.save();
    const deactivatedUser = await createUser();
    const deactivatedPlayer = await createMemberPlayer(deactivatedUser._id);
    const externalUser = await createUser(MembershipStatus.INACTIVE);
    const externalPlayer = await Player.create({
      userId: externalUser._id,
      type: PlayerType.EXTERNAL,
      singlesRanking: 0,
      doublesRanking: 0,
      preferredPositions: [],
      isActivePlayer: true,
      teamIds: [],
    });
    const inactiveUser = await createUser(MembershipStatus.INACTIVE);

    const enabled = await PlayerLifecycleAdministrationService.executeBatch({
      userIds: [enabledUser._id.toString(), inactiveUser._id.toString()],
      action: 'enable',
      reason: 'Season participation setup',
      idempotencyKey: 'player-lifecycle-batch-enable',
      actor,
      occurredAt: new Date('2026-07-13T12:00:00.000Z'),
    });
    expect(enabled).toMatchObject({ updatedCount: 1, failureCount: 1 });
    expect(await Player.findOne({ userId: enabledUser._id })).toMatchObject({
      type: PlayerType.MEMBER,
      isActivePlayer: true,
    });

    const deactivated = await PlayerLifecycleAdministrationService.executeBatch(
      {
        userIds: [deactivatedUser._id.toString(), externalUser._id.toString()],
        action: 'deactivate',
        reason: 'Sporting participation ended',
        idempotencyKey: 'player-lifecycle-batch-deactivate',
        actor,
        occurredAt: new Date('2026-07-13T12:05:00.000Z'),
      }
    );
    expect(deactivated).toMatchObject({ updatedCount: 2, failureCount: 0 });
    expect(await Player.findById(deactivatedPlayer._id)).toMatchObject({
      isActivePlayer: false,
      teamIds: [],
    });
    expect(await Player.findById(externalPlayer._id)).toMatchObject({
      isActivePlayer: false,
      teamIds: [],
    });
  });

  it('cleans an inactive Player with historical references and updates retained User truth', async () => {
    const user = await createUser();
    const player = await createMemberPlayer(user._id);
    player.isActivePlayer = false;
    await player.save();
    const team = await createTeam(user._id, 'hist1');
    const match = await Match.create(
      withMatchScheduleDuplicateKey({
        startAt: new Date('2026-07-01T10:00:00.000Z'),
        location: 'Historical Hall',
        direction: MatchDirection.HOME,
        teamId: team._id,
        opponentName: 'Past Visitors',
        lineup: [
          {
            position: LineupPosition.MEN_SINGLES_1,
            playerId: player._id,
            playerNameSnapshot: 'Historical Player',
          },
        ],
        availability: [
          {
            playerId: player._id,
            participation: MatchAvailabilityParticipation.UNAVAILABLE,
          },
        ],
        createdById: user._id,
      })
    );

    await PlayerCleanupService.cleanupPlayer({
      playerId: player._id.toString(),
      reason: 'Historical-only Player cleanup',
      actor,
      evaluatedAt: new Date('2026-07-13T12:00:00.000Z'),
    });

    expect(await Player.findById(player._id)).toBeNull();
    expect(await User.findById(user._id)).toMatchObject({ isPlayer: false });
    expect(await Match.findById(match._id)).toMatchObject({
      lineup: [
        expect.objectContaining({ playerNameSnapshot: 'Historical Player' }),
      ],
    });
  });

  it('blocks Player cleanup for future Match dependencies and cleans a banking-absent inactive User', async () => {
    const blockedUser = await createUser();
    const blockedPlayer = await createMemberPlayer(blockedUser._id);
    blockedPlayer.isActivePlayer = false;
    await blockedPlayer.save();
    const team = await createTeam(blockedUser._id, 'future1');
    await Match.create(
      withMatchScheduleDuplicateKey({
        startAt: new Date('2026-08-01T10:00:00.000Z'),
        location: 'Future Hall',
        direction: MatchDirection.HOME,
        teamId: team._id,
        opponentName: 'Future Visitors',
        lineup: [],
        availability: [
          {
            playerId: blockedPlayer._id,
            participation: MatchAvailabilityParticipation.UNAVAILABLE,
          },
        ],
        createdById: blockedUser._id,
      })
    );
    await expect(
      PlayerCleanupService.cleanupPlayer({
        playerId: blockedPlayer._id.toString(),
        reason: 'Blocked cleanup',
        actor,
        evaluatedAt: new Date('2026-07-13T12:00:00.000Z'),
      })
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(await Player.findById(blockedPlayer._id)).not.toBeNull();

    const inactiveUser = await createUser(MembershipStatus.INACTIVE);
    const cleanablePlayer = await createMemberPlayer(inactiveUser._id);
    cleanablePlayer.isActivePlayer = false;
    await cleanablePlayer.save();
    await AccountDeletionService.deleteAccount({
      userId: inactiveUser._id.toString(),
      reason: 'Final retained account cleanup',
      actor,
      evaluatedAt: new Date('2026-07-13T12:00:00.000Z'),
    });
    expect(await User.findById(inactiveUser._id)).toBeNull();
    expect(await Player.findById(cleanablePlayer._id)).toBeNull();
    expect(
      await AuditLog.countDocuments({
        eventType: AuditEventType.PLAYER_DELETED,
        entityId: cleanablePlayer._id,
      })
    ).toBe(1);
    expect(
      await AuditLog.countDocuments({
        eventType: AuditEventType.USER_DELETED,
        entityId: inactiveUser._id,
      })
    ).toBe(1);
  });

  it('removes Member banking during final cleanup while retaining approval provenance', async () => {
    const user = await createUser(MembershipStatus.INACTIVE);
    user.isPlayer = false;
    await user.save();
    const { approvalEvent, profile } = await createMemberBankingProfile(
      user._id
    );

    await AccountDeletionService.deleteAccount({
      userId: user._id.toString(),
      reason: 'Final banking cleanup',
      actor,
      evaluatedAt: new Date('2026-07-13T12:00:00.000Z'),
    });

    expect(await User.findById(user._id)).toBeNull();
    expect(await MemberBankingProfile.findById(profile._id)).toBeNull();
    expect(
      await RegistrationApprovalEvent.findById(approvalEvent._id)
    ).not.toBeNull();
    expect(
      await AuditLog.countDocuments({
        eventType: AuditEventType.USER_DELETED,
        entityId: user._id,
      })
    ).toBe(1);
  });

  it('rolls back final cleanup when Member banking deletion fails', async () => {
    const user = await createUser(MembershipStatus.INACTIVE);
    const player = await createMemberPlayer(user._id);
    player.isActivePlayer = false;
    await player.save();
    const { profile } = await createMemberBankingProfile(user._id);
    const bankingDeleteSpy = vi
      .spyOn(MemberBankingProfile, 'deleteOne')
      .mockImplementationOnce((() => {
        throw new Error('injected banking cleanup failure');
      }) as typeof MemberBankingProfile.deleteOne);

    try {
      await expect(
        AccountDeletionService.deleteAccount({
          userId: user._id.toString(),
          reason: 'Final banking cleanup rollback',
          actor,
          evaluatedAt: new Date('2026-07-13T12:00:00.000Z'),
        })
      ).rejects.toThrow('injected banking cleanup failure');
    } finally {
      bankingDeleteSpy.mockRestore();
    }

    expect(await User.findById(user._id)).not.toBeNull();
    expect(await Player.findById(player._id)).not.toBeNull();
    expect(await MemberBankingProfile.findById(profile._id)).not.toBeNull();
    expect(await AuditLog.countDocuments({})).toBe(0);
  });

  it('rolls back final User and Player cleanup when required audit persistence fails', async () => {
    const user = await createUser(MembershipStatus.INACTIVE);
    const player = await createMemberPlayer(user._id);
    player.isActivePlayer = false;
    await player.save();
    const { profile } = await createMemberBankingProfile(user._id);
    const auditSpy = vi
      .spyOn(AuditLog, 'create')
      .mockRejectedValueOnce(new Error('injected cleanup audit failure'));
    try {
      await expect(
        AccountDeletionService.deleteAccount({
          userId: user._id.toString(),
          reason: 'Final cleanup rollback',
          actor,
          evaluatedAt: new Date('2026-07-13T12:00:00.000Z'),
        })
      ).rejects.toThrow('Required Audit persistence failed');
    } finally {
      auditSpy.mockRestore();
    }

    expect(await User.findById(user._id)).not.toBeNull();
    expect(await Player.findById(player._id)).not.toBeNull();
    expect(await MemberBankingProfile.findById(profile._id)).not.toBeNull();
  });

  it('rolls back an entire Team batch after an intermediate write failure', async () => {
    const users = await Promise.all([createUser(), createUser()]);
    const players = await Promise.all(
      users.map((user) => createMemberPlayer(user._id))
    );
    const team = await createTeam(users[0]._id);
    const originalUpdateOne = Player.updateOne.bind(Player);
    let writeCount = 0;
    const updateSpy = vi.spyOn(Player, 'updateOne').mockImplementation((async (
      ...args: Parameters<typeof Player.updateOne>
    ) => {
      writeCount += 1;
      if (writeCount === 2) throw new Error('injected second Player failure');
      return originalUpdateOne(...args);
    }) as typeof Player.updateOne);

    try {
      await expect(
        PlayerService.batchUpdatePlayers(
          players.map((player) => player._id.toString()),
          { addToTeams: [team._id.toString()] }
        )
      ).rejects.toThrow('injected second Player failure');
    } finally {
      updateSpy.mockRestore();
    }

    const persistedPlayers = await Player.find({
      _id: { $in: players.map((player) => player._id) },
    });
    expect(
      persistedPlayers.every((player) => player.teamIds.length === 0)
    ).toBe(true);
  });

  it('applies bounded Team batches atomically with versioned removals', async () => {
    const users = await Promise.all([createUser(), createUser()]);
    const players = await Promise.all(
      users.map((user) => createMemberPlayer(user._id))
    );
    const team = await createTeam(users[0]._id);
    await PlayerService.batchUpdatePlayers(
      players.map((player) => player._id.toString()),
      { addToTeams: [team._id.toString()] }
    );
    const match = await Match.create(
      withMatchScheduleDuplicateKey({
        startAt: new Date('2026-08-01T10:00:00.000Z'),
        location: 'Test Hall',
        direction: MatchDirection.HOME,
        teamId: team._id,
        opponentName: 'Visitors',
        lineup: players.map((player, index) => ({
          position: LineupPosition.MEN_SINGLES_1,
          playerId: player._id,
          playerNameSnapshot: `Retained Player ${index + 1}`,
        })),
        availability: players.map((player) => ({
          playerId: player._id,
          participation: MatchAvailabilityParticipation.UNAVAILABLE,
        })),
        createdById: users[0]._id,
      })
    );

    await PlayerService.batchUpdatePlayers(
      players.map((player) => player._id.toString()),
      { removeFromTeams: [team._id.toString()] }
    );

    const persistedPlayers = await Player.find({
      _id: { $in: players.map((player) => player._id) },
    });
    const persistedMatch = await Match.findById(match._id);
    expect(
      persistedPlayers.every((player) => player.teamIds.length === 0)
    ).toBe(true);
    expect(persistedPlayers.every((player) => player.get('__v') === 2)).toBe(
      true
    );
    expect(
      persistedMatch?.availability.map((entry) => entry.playerId.toString())
    ).toEqual(players.map((player) => player._id.toString()));
    expect(
      persistedMatch?.lineup.map((entry) => entry.playerId.toString())
    ).toEqual(players.map((player) => player._id.toString()));

    await expect(
      PlayerService.batchUpdatePlayers(
        Array.from({ length: MAX_PLAYER_BATCH_SIZE + 1 }, () =>
          new mongoose.Types.ObjectId().toString()
        ),
        { addToTeams: [team._id.toString()] }
      )
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('does not restore a Team removed after a lifecycle stale read', async () => {
    const user = await createUser();
    const player = await createMemberPlayer(user._id);
    const team = await createTeam(user._id);
    await PlayerService.addPlayerToTeam(
      player._id.toString(),
      team._id.toString()
    );
    const repository = new DeferredLoadRepository();
    const lifecycle = new MembershipLifecycleService(repository);
    const transitionPromise = lifecycle.execute(
      transition(
        user._id.toString(),
        'team-removal-race',
        MembershipStatus.ACTIVE,
        MembershipStatus.PASSIVE
      )
    );
    await repository.loaded;

    await PlayerService.batchUpdatePlayers([player._id.toString()], {
      removeFromTeams: [team._id.toString()],
    });
    repository.release();
    await transitionPromise;

    const persistedPlayer = await Player.findById(player._id);
    expect(persistedPlayer?.teamIds).toHaveLength(0);
    expect((await User.findById(user._id))?.membershipStatus).toBe(
      MembershipStatus.PASSIVE
    );
  });
});
