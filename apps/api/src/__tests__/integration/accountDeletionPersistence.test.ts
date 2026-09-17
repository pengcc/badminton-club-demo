import { randomUUID } from 'node:crypto';
import express from 'express';
import mongoose from 'mongoose';
import request from 'supertest';
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
  AccountKind,
  AuditEventType,
  Capability,
  Gender,
  LineupPosition,
  MatchAvailabilityParticipation,
  MatchDirection,
  MembershipStatus,
  MembershipTerminationSource,
  MembershipTerminationStatus,
  PlayerType,
  TeamLevel,
} from '@club/shared-types/core/enums';
import {
  acquireMongoTestDatabase,
  type MongoTestDatabaseLease,
} from '../infrastructure/mongoTestDatabase';
import { AuditLog } from '../../models/AuditLog';
import { AuthSession } from '../../models/AuthSession';
import { Match } from '../../models/Match';
import { MemberBankingProfile } from '../../models/MemberBankingProfile';
import { MembershipLifecycleEvent } from '../../models/MembershipLifecycleEvent';
import { MembershipTermination } from '../../models/MembershipTermination';
import { Player } from '../../models/Player';
import { Team } from '../../models/Team';
import { User } from '../../models/User';
import { AccountDeletionService } from '../../services/accountDeletionService';
import { AuthSessionService } from '../../services/authSessionService';
import { IdentityDependencyClaimService } from '../../services/identityDependencyClaimService';
import { MatchAvailabilityService } from '../../services/matchAvailabilityService';
import { MembershipTerminationService } from '../../services/membershipTerminationService';
import { withMatchScheduleDuplicateKey } from '../../services/matchScheduleDuplicateKey';
import authRoutes from '../../routes/auth';
import { errorHandler } from '../../middleware/errorHandler';
import { config } from '../../config';

const evaluatedAt = new Date('2026-09-04T12:00:00.000Z');
const actor = {
  id: new mongoose.Types.ObjectId().toString(),
  email: 'admin@example.test',
  accountKind: AccountKind.PERSON,
  displayName: 'Administrator',
  capabilities: [Capability.ADMINISTRATION],
};
let mongoLease: MongoTestDatabaseLease;

async function createPerson(
  membershipStatus: MembershipStatus,
  isPlayer = false
) {
  return User.create({
    email: `${randomUUID()}@example.test`,
    firstName: 'Delete',
    lastName: 'Target',
    password: 'ValidPassword1',
    gender: Gender.FEMALE,
    dateOfBirth: '1990-01-01',
    accountKind: AccountKind.PERSON,
    administratorDesignation: false,
    displayName: 'Delete Target',
    capabilities: [Capability.AUTHENTICATED_ACCOUNT],
    membershipStatus,
    isPlayer,
  });
}

async function createPlayer(
  userId: mongoose.Types.ObjectId,
  type: PlayerType,
  teamIds: mongoose.Types.ObjectId[] = []
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

async function createTeam(createdById: mongoose.Types.ObjectId) {
  return Team.create({
    teamId: randomUUID().slice(0, 8),
    shortName: 'Delete Test',
    leagueTeamName: 'Delete Test Team',
    matchLevel: TeamLevel.E,
    createdById,
  });
}

async function deleteAccount(userId: string) {
  return AccountDeletionService.deleteAccount({
    userId,
    reason: 'Administrator confirmed permanent deletion',
    actor,
    evaluatedAt,
  });
}

function authApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use(errorHandler);
  return app;
}

function login(email: string) {
  return request(authApp())
    .post('/api/auth/login')
    .set('Origin', config.frontendUrl)
    .send({ email, password: 'ValidPassword1' })
    .then((response) => response);
}

async function addAccountOwnedState(userId: string) {
  await AuthSessionService.create(userId, 0);
  await MemberBankingProfile.create({
    userId: new mongoose.Types.ObjectId(userId),
    encryptedBanking: {
      keyVersion: 'test',
      nonce: 'nonce',
      ciphertext: 'ciphertext',
      authTag: 'tag',
    },
    bankingSummary: { present: true, complete: true, ibanLastFour: '1234' },
    sourceApplicationId: new mongoose.Types.ObjectId(),
  });
}

async function overlapFirstTwoUserClaims(
  operations: [() => Promise<unknown>, () => Promise<unknown>],
  winningClaim: 0 | 1
) {
  const originalClaim = IdentityDependencyClaimService.claimUser;
  let claimCount = 0;
  let resolveFirstReached!: () => void;
  let resolveSecondReached!: () => void;
  let resolveSecondClaimed!: () => void;
  const firstReached = new Promise<void>((resolve) => {
    resolveFirstReached = resolve;
  });
  const secondReached = new Promise<void>((resolve) => {
    resolveSecondReached = resolve;
  });
  const secondClaimed = new Promise<void>((resolve) => {
    resolveSecondClaimed = resolve;
  });

  vi.spyOn(IdentityDependencyClaimService, 'claimUser').mockImplementation(
    async (input, session) => {
      const claimIndex = claimCount++;
      if (claimIndex === 0) {
        if (winningClaim === 0) {
          await originalClaim(input, session);
          resolveFirstReached();
          await secondReached;
          return;
        }
        resolveFirstReached();
        await secondClaimed;
      } else if (claimIndex === 1) {
        if (winningClaim === 0) {
          resolveSecondReached();
        } else {
          await originalClaim(input, session);
          resolveSecondClaimed();
          return;
        }
      }
      await originalClaim(input, session);
    }
  );
  const first = operations[0]();
  await firstReached;
  const second = operations[1]();
  return Promise.allSettled([first, second]);
}

async function overlapFirstTwoPlayerClaims(
  operations: [() => Promise<unknown>, () => Promise<unknown>],
  winningClaim: 0 | 1
) {
  const originalClaim = IdentityDependencyClaimService.claimPlayer;
  let claimCount = 0;
  let resolveFirstReached!: () => void;
  let resolveSecondReached!: () => void;
  let resolveSecondClaimed!: () => void;
  const firstReached = new Promise<void>((resolve) => {
    resolveFirstReached = resolve;
  });
  const secondReached = new Promise<void>((resolve) => {
    resolveSecondReached = resolve;
  });
  const secondClaimed = new Promise<void>((resolve) => {
    resolveSecondClaimed = resolve;
  });

  vi.spyOn(IdentityDependencyClaimService, 'claimPlayer').mockImplementation(
    async (input, session) => {
      const claimIndex = claimCount++;
      if (claimIndex === 0) {
        if (winningClaim === 0) {
          await originalClaim(input, session);
          resolveFirstReached();
          await secondReached;
          return;
        }
        resolveFirstReached();
        await secondClaimed;
      } else if (claimIndex === 1) {
        if (winningClaim === 0) {
          resolveSecondReached();
        } else {
          await originalClaim(input, session);
          resolveSecondClaimed();
          return;
        }
      }
      await originalClaim(input, session);
    }
  );
  const first = operations[0]();
  await firstReached;
  const second = operations[1]();
  return Promise.allSettled([first, second]);
}

beforeAll(async () => {
  mongoLease = await acquireMongoTestDatabase('accountDeletion');
  mongoLease.assertOwnedDatabase();
  await Promise.all([
    AuditLog.syncIndexes(),
    AuthSession.syncIndexes(),
    Match.syncIndexes(),
    MemberBankingProfile.syncIndexes(),
    MembershipLifecycleEvent.syncIndexes(),
    MembershipTermination.syncIndexes(),
    Player.syncIndexes(),
    Team.syncIndexes(),
    User.syncIndexes(),
  ]);
}, 120_000);

beforeEach(async () => {
  mongoLease.assertOwnedDatabase();
  vi.restoreAllMocks();
  await Promise.all([
    AuditLog.deleteMany({}),
    AuthSession.deleteMany({}),
    Match.deleteMany({}),
    MemberBankingProfile.deleteMany({}),
    MembershipLifecycleEvent.deleteMany({}),
    MembershipTermination.deleteMany({}),
    Player.deleteMany({}),
    Team.deleteMany({}),
    User.deleteMany({}),
  ]);
});

afterAll(async () => {
  await mongoLease.release();
});

describe('Account deletion persistence', () => {
  it.each([
    MembershipStatus.ACTIVE,
    MembershipStatus.PASSIVE,
  ])('atomically ends %s Membership and deletes account-owned records', async (membershipStatus) => {
    const user = await createPerson(membershipStatus);
    await AuthSessionService.create(user.id, 0);
    await AuthSessionService.create(user.id, 0);
    await MemberBankingProfile.create({
      userId: user._id,
      encryptedBanking: {
        keyVersion: 'test',
        nonce: 'nonce',
        ciphertext: 'ciphertext',
        authTag: 'tag',
      },
      bankingSummary: { present: true, complete: true, ibanLastFour: '1234' },
      sourceApplicationId: new mongoose.Types.ObjectId(),
    });

    await deleteAccount(user.id);

    expect(await User.findById(user._id)).toBeNull();
    expect(await AuthSession.countDocuments({ userId: user._id })).toBe(0);
    expect(await MemberBankingProfile.findOne({ userId: user._id })).toBeNull();
    expect(
      await MembershipLifecycleEvent.countDocuments({ userId: user._id })
    ).toBe(1);
    expect(
      await AuditLog.findOne({
        eventType: AuditEventType.USER_DELETED,
        entityId: user._id,
      }).lean()
    ).toMatchObject({
      reason: 'Administrator confirmed permanent deletion',
      changes: expect.arrayContaining([
        expect.objectContaining({
          field: 'membershipStatus',
          oldValue: membershipStatus,
        }),
      ]),
    });
  });

  it('resolves member Player participation and team links while preserving past Match history', async () => {
    const user = await createPerson(MembershipStatus.ACTIVE, true);
    const team = await createTeam(user._id);
    const player = await createPlayer(user._id, PlayerType.MEMBER, [team._id]);
    const pastMatch = await Match.create(
      withMatchScheduleDuplicateKey({
        startAt: new Date('2026-09-01T10:00:00.000Z'),
        location: 'Historical Hall',
        direction: MatchDirection.HOME,
        teamId: team._id,
        opponentName: 'Historical Opponent',
        lineup: [
          {
            position: LineupPosition.MEN_SINGLES_1,
            playerId: player._id,
            playerNameSnapshot: 'Delete Target',
          },
        ],
        availability: [],
        createdById: user._id,
      })
    );

    await deleteAccount(user.id);

    expect(await User.findById(user._id)).toBeNull();
    expect(await Player.findById(player._id)).toBeNull();
    expect(await Match.findById(pastMatch._id)).toMatchObject({
      lineup: [
        expect.objectContaining({ playerNameSnapshot: 'Delete Target' }),
      ],
    });
    expect(
      await AuditLog.countDocuments({
        eventType: AuditEventType.PLAYER_DELETED,
        entityId: player._id,
      })
    ).toBe(1);
  });

  it('deletes an inactive former Member without creating a Membership transition', async () => {
    const user = await createPerson(MembershipStatus.INACTIVE);

    await deleteAccount(user.id);

    expect(await User.findById(user._id)).toBeNull();
    expect(
      await MembershipLifecycleEvent.countDocuments({ userId: user._id })
    ).toBe(0);
    expect(
      await AuditLog.countDocuments({
        eventType: AuditEventType.USER_DELETED,
        entityId: user._id,
      })
    ).toBe(1);
  });

  it('rolls back lifecycle and every deletion when a current or future Match depends on the Player', async () => {
    const user = await createPerson(MembershipStatus.ACTIVE, true);
    const team = await createTeam(user._id);
    const player = await createPlayer(user._id, PlayerType.MEMBER, [team._id]);
    await AuthSessionService.create(user.id, 0);
    await Match.create(
      withMatchScheduleDuplicateKey({
        startAt: evaluatedAt,
        location: 'Current Hall',
        direction: MatchDirection.HOME,
        teamId: team._id,
        opponentName: 'Current Opponent',
        lineup: [
          {
            position: LineupPosition.MEN_SINGLES_1,
            playerId: player._id,
            playerNameSnapshot: 'Delete Target',
          },
        ],
        availability: [],
        createdById: user._id,
      })
    );

    await expect(deleteAccount(user.id)).rejects.toMatchObject({
      statusCode: 409,
    });

    expect(await User.findById(user._id)).toMatchObject({
      membershipStatus: MembershipStatus.ACTIVE,
    });
    expect(await Player.findById(player._id)).toMatchObject({
      isActivePlayer: true,
      teamIds: [team._id],
    });
    expect(await AuthSession.countDocuments({ userId: user._id })).toBe(1);
    expect(
      await MembershipLifecycleEvent.countDocuments({ userId: user._id })
    ).toBe(0);
    expect(await AuditLog.countDocuments({ entityId: user._id })).toBe(0);
  });

  it('blocks open termination and unresolved active External Player state without changes', async () => {
    const openUser = await createPerson(MembershipStatus.ACTIVE);
    await MembershipTermination.create({
      userId: openUser._id,
      status: MembershipTerminationStatus.PENDING_REVIEW,
      isOpen: true,
      source: MembershipTerminationSource.ONLINE,
      requestedAt: evaluatedAt,
      requestedBy: {
        id: openUser._id,
        email: openUser.email,
        accountKind: AccountKind.PERSON,
        displayName: 'Delete Target',
      },
      requestedEffectiveDate: '2026-12-31',
      requestIdempotencyKey: `request-${randomUUID()}`,
      requestIntentFingerprint: randomUUID(),
    });
    await expect(deleteAccount(openUser.id)).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(await User.findById(openUser._id)).not.toBeNull();

    const externalUser = await createPerson(MembershipStatus.INACTIVE, true);
    const externalPlayer = await createPlayer(
      externalUser._id,
      PlayerType.EXTERNAL
    );
    await expect(deleteAccount(externalUser.id)).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(await User.findById(externalUser._id)).not.toBeNull();
    expect(await Player.findById(externalPlayer._id)).not.toBeNull();
  });

  it('rolls back current-Member lifecycle when the guarded User delete loses a race', async () => {
    const user = await createPerson(MembershipStatus.ACTIVE);
    const deleteSpy = vi
      .spyOn(User, 'deleteOne')
      .mockImplementationOnce((() => ({
        session: async () => ({ acknowledged: true, deletedCount: 0 }),
      })) as unknown as typeof User.deleteOne);
    try {
      await expect(deleteAccount(user.id)).rejects.toMatchObject({
        statusCode: 409,
      });
    } finally {
      deleteSpy.mockRestore();
    }
    expect(await User.findById(user._id)).toMatchObject({
      membershipStatus: MembershipStatus.ACTIVE,
    });
    expect(
      await MembershipLifecycleEvent.countDocuments({ userId: user._id })
    ).toBe(0);
    expect(await AuditLog.countDocuments({ entityId: user._id })).toBe(0);
  });

  it.each([
    { winningClaim: 0 as const, winner: 'permanent deletion' },
    { winningClaim: 1 as const, winner: 'scheduled termination creation' },
  ])('serializes permanent deletion when $winner wins the User claim', async ({
    winningClaim,
  }) => {
    const user = await createPerson(MembershipStatus.ACTIVE, true);
    const team = await createTeam(user._id);
    const player = await createPlayer(user._id, PlayerType.MEMBER, [team._id]);
    await addAccountOwnedState(user.id);

    const outcomes = await overlapFirstTwoUserClaims(
      [
        () => deleteAccount(user.id),
        () =>
          MembershipTerminationService.recordOffline({
            userId: user.id,
            source: MembershipTerminationSource.EMAIL,
            requestReceivedAt: evaluatedAt,
            effectiveTiming: 'scheduled',
            effectiveDate: '2026-12-31',
            note: 'Concurrent scheduled termination',
            idempotencyKey: 'concurrent-scheduled-termination',
            actor,
            now: evaluatedAt,
          }),
      ],
      winningClaim
    );

    expect(outcomes[winningClaim].status).toBe('fulfilled');
    expect(outcomes[winningClaim === 0 ? 1 : 0].status).toBe('rejected');
    const userAfter = await User.findById(user._id);
    const playerAfter = await Player.findById(player._id);
    const terminationAfter = await MembershipTermination.findOne({
      userId: user._id,
    });

    if (winningClaim === 1) {
      expect(userAfter).not.toBeNull();
      expect(userAfter?.membershipStatus).toBe(MembershipStatus.ACTIVE);
      expect(playerAfter).toMatchObject({
        isActivePlayer: true,
        teamIds: [team._id],
      });
      expect(terminationAfter).toMatchObject({
        status: MembershipTerminationStatus.APPROVED,
        isOpen: true,
      });
      expect(await AuthSession.countDocuments({ userId: user._id })).toBe(1);
      expect(
        await MemberBankingProfile.countDocuments({ userId: user._id })
      ).toBe(1);
      expect(
        await MembershipLifecycleEvent.countDocuments({ userId: user._id })
      ).toBe(0);
    } else {
      expect(userAfter).toBeNull();
      expect(playerAfter).toBeNull();
      expect(terminationAfter).toBeNull();
      expect(await AuthSession.countDocuments({ userId: user._id })).toBe(0);
      expect(
        await MemberBankingProfile.countDocuments({ userId: user._id })
      ).toBe(0);
      expect(
        await MembershipLifecycleEvent.countDocuments({ userId: user._id })
      ).toBe(1);
    }
    expect(
      await AuditLog.countDocuments({
        eventType: AuditEventType.USER_DELETED,
        entityId: user._id,
      })
    ).toBe(winningClaim === 1 ? 0 : 1);
  });

  it.each([
    { winningClaim: 0 as const, winner: 'Login session issuance' },
    { winningClaim: 1 as const, winner: 'permanent deletion' },
  ])('serializes permanent deletion when $winner wins the Authentication User claim', async ({
    winningClaim,
  }) => {
    const user = await createPerson(MembershipStatus.ACTIVE);

    const outcomes = await overlapFirstTwoUserClaims(
      [() => login(user.email), () => deleteAccount(user.id)],
      winningClaim
    );

    expect(outcomes[0].status).toBe('fulfilled');
    expect(outcomes[1].status).toBe('fulfilled');
    if (outcomes[0].status !== 'fulfilled') {
      throw outcomes[0].reason;
    }
    const loginResponse = outcomes[0].value as request.Response;
    if (winningClaim === 0) {
      expect(loginResponse.status).toBe(200);
      expect(loginResponse.headers['set-cookie']).toBeDefined();
    } else {
      expect(loginResponse.status).not.toBe(200);
      expect(loginResponse.headers['set-cookie']).toBeUndefined();
    }
    expect(await User.findById(user._id)).toBeNull();
    expect(await AuthSession.countDocuments({ userId: user._id })).toBe(0);
    expect(
      await AuditLog.countDocuments({
        eventType: AuditEventType.USER_DELETED,
        entityId: user._id,
      })
    ).toBe(1);
  });

  it.each([
    { winningClaim: 0 as const, winner: 'permanent deletion' },
    { winningClaim: 1 as const, winner: 'Match Availability creation' },
  ])('serializes permanent deletion when $winner wins the Player claim', async ({
    winningClaim,
  }) => {
    const user = await createPerson(MembershipStatus.ACTIVE, true);
    const team = await createTeam(user._id);
    const player = await createPlayer(user._id, PlayerType.MEMBER, [team._id]);
    await addAccountOwnedState(user.id);
    const match = await Match.create(
      withMatchScheduleDuplicateKey({
        startAt: new Date('2099-09-04T12:00:00.000Z'),
        location: 'Concurrent Hall',
        direction: MatchDirection.HOME,
        teamId: team._id,
        opponentName: 'Concurrent Opponent',
        lineup: [],
        availability: [],
        createdById: user._id,
      })
    );

    const outcomes = await overlapFirstTwoPlayerClaims(
      [
        () => deleteAccount(user.id),
        () =>
          MatchAvailabilityService.setPlayerAvailability(
            match._id.toString(),
            player._id.toString(),
            {
              expectedVersion: 0,
              participation: MatchAvailabilityParticipation.UNAVAILABLE,
            }
          ),
      ],
      winningClaim
    );

    expect(outcomes[winningClaim].status).toBe('fulfilled');
    expect(outcomes[winningClaim === 0 ? 1 : 0].status).toBe('rejected');
    const userAfter = await User.findById(user._id);
    const playerAfter = await Player.findById(player._id);
    const matchAfter = await Match.findById(match._id);
    const availabilityRemains =
      matchAfter?.availability.some((entry) =>
        entry.playerId.equals(player._id)
      ) ?? false;

    expect(availabilityRemains).toBe(winningClaim === 1);
    if (winningClaim === 1) {
      expect(userAfter).not.toBeNull();
      expect(userAfter?.membershipStatus).toBe(MembershipStatus.ACTIVE);
      expect(playerAfter).toMatchObject({
        isActivePlayer: true,
        teamIds: [team._id],
      });
      expect(await AuthSession.countDocuments({ userId: user._id })).toBe(1);
      expect(
        await MemberBankingProfile.countDocuments({ userId: user._id })
      ).toBe(1);
      expect(
        await MembershipLifecycleEvent.countDocuments({ userId: user._id })
      ).toBe(0);
    } else {
      expect(userAfter).toBeNull();
      expect(playerAfter).toBeNull();
      expect(await AuthSession.countDocuments({ userId: user._id })).toBe(0);
      expect(
        await MemberBankingProfile.countDocuments({ userId: user._id })
      ).toBe(0);
    }
    expect(
      await AuditLog.countDocuments({
        eventType: AuditEventType.USER_DELETED,
        entityId: user._id,
      })
    ).toBe(winningClaim === 1 ? 0 : 1);
  });

  it('rejects a Super Admin and a caller without Administration capability', async () => {
    const superAdmin = await User.create({
      email: `${randomUUID()}@example.test`,
      password: 'ValidPassword1',
      accountKind: AccountKind.SUPER_ADMIN,
      administratorDesignation: false,
      displayName: 'Super Admin',
      capabilities: [Capability.ADMINISTRATION],
      isPlayer: false,
    });
    await expect(deleteAccount(superAdmin.id)).rejects.toMatchObject({
      statusCode: 409,
    });
    const person = await createPerson(MembershipStatus.INACTIVE);
    await expect(
      AccountDeletionService.deleteAccount({
        userId: person.id,
        reason: 'Unauthorized attempt',
        actor: { ...actor, capabilities: [] },
      })
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(await User.findById(person._id)).not.toBeNull();
  });
});
