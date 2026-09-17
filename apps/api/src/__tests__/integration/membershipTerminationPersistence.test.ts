import { randomUUID } from 'node:crypto';
import {
  acquireMongoTestDatabase,
  type MongoTestDatabaseLease,
} from '../infrastructure/mongoTestDatabase';
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
import {
  AuditEventType,
  Gender,
  LineupPosition,
  MatchAvailabilityParticipation,
  MatchDirection,
  MembershipStatus,
  MembershipTerminationSource,
  MembershipTerminationStatus,
  AccountKind,
  Capability,
  PlayerType,
  TeamLevel,
} from '@club/shared-types/core/enums';
import { AuditLog } from '../../models/AuditLog';
import { Match } from '../../models/Match';
import { MemberBankingProfile } from '../../models/MemberBankingProfile';
import { MembershipLifecycleEvent } from '../../models/MembershipLifecycleEvent';
import { MembershipTermination } from '../../models/MembershipTermination';
import { Player } from '../../models/Player';
import { Team } from '../../models/Team';
import { User } from '../../models/User';
import { withMatchScheduleDuplicateKey } from '../../services/matchScheduleDuplicateKey';
import { AuditService } from '../../services/auditService';
import { MembershipTerminationService } from '../../services/membershipTerminationService';
import { MatchAvailabilityService } from '../../services/matchAvailabilityService';
import { MatchService } from '../../services/matchService';
import { MatchLineupService } from '../../services/matchLineupService';
import { PlayerLifecycleAdministrationService } from '../../services/playerLifecycleAdministrationService';

let mongoLease: MongoTestDatabaseLease;
const TEST_PASSWORD = ['Fixture', 'Only', '42!'].join('-');

async function createMember(
  membershipStatus: MembershipStatus = MembershipStatus.ACTIVE
) {
  return User.create({
    email: `${randomUUID()}@example.test`,
    firstName: 'Test',
    lastName: 'Member',
    password: TEST_PASSWORD,
    gender: Gender.FEMALE,
    dateOfBirth: '1990-01-01',
    accountKind: AccountKind.PERSON,
    administratorDesignation: false,
    displayName: 'Member',
    capabilities: [Capability.AUTHENTICATED_ACCOUNT],
    membershipStatus,
    isPlayer: false,
  });
}

async function createMemberBankingProfile(userId: mongoose.Types.ObjectId) {
  return MemberBankingProfile.create({
    userId,
    encryptedBanking: {
      keyVersion: 'fixture-key-version',
      nonce: 'fixture-nonce',
      ciphertext: 'fixture-ciphertext',
      authTag: 'fixture-auth-tag',
    },
    bankingSummary: { present: true, complete: true, ibanLastFour: '1234' },
    sourceApplicationId: new mongoose.Types.ObjectId(),
  });
}

function actor(id: string, email = 'admin@example.test') {
  return {
    id,
    email,
    accountKind: AccountKind.PERSON,
    administratorDesignation: true,
    displayName: 'Administrator',
    capabilities: [Capability.ADMINISTRATION],
  };
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

beforeAll(async () => {
  mongoLease = await acquireMongoTestDatabase('membershipTermination');
  mongoLease.assertOwnedDatabase();
  await Promise.all([
    User.syncIndexes(),
    MembershipTermination.syncIndexes(),
    AuditLog.syncIndexes(),
    Player.syncIndexes(),
    Team.syncIndexes(),
    Match.syncIndexes(),
    MembershipLifecycleEvent.syncIndexes(),
    MemberBankingProfile.syncIndexes(),
  ]);
}, 120_000);

beforeEach(async () => {
  mongoLease.assertOwnedDatabase();
  await Promise.all([
    User.deleteMany({}),
    MembershipTermination.deleteMany({}),
    AuditLog.deleteMany({}),
    Player.deleteMany({}),
    Team.deleteMany({}),
    Match.deleteMany({}),
    MembershipLifecycleEvent.deleteMany({}),
    MemberBankingProfile.deleteMany({}),
  ]);
});

afterAll(async () => {
  await mongoLease.release();
});

describe('WP8 termination request persistence', () => {
  it('creates and safely replays one online request with required audit', async () => {
    const member = await createMember();
    const memberActor = {
      id: member._id.toString(),
      email: member.email,
      accountKind: AccountKind.PERSON,
      administratorDesignation: false,
      displayName: 'Member',
      capabilities: [Capability.AUTHENTICATED_ACCOUNT],
    };
    const command = {
      userId: member._id.toString(),
      effectiveDate: '2026-09-30',
      note: 'Moving away',
      idempotencyKey: 'online-request-retry',
      actor: memberActor,
      now: new Date('2026-07-31T12:00:00.000Z'),
    };

    const first = await MembershipTerminationService.requestOnline(command);
    const replay = await MembershipTerminationService.requestOnline({
      ...command,
      now: new Date('2026-08-01T12:00:00.000Z'),
    });

    expect(replay.id).toBe(first.id);
    expect(first.status).toBe(MembershipTerminationStatus.PENDING_REVIEW);
    expect(await MembershipTermination.countDocuments({})).toBe(1);
    expect(
      await AuditLog.countDocuments({
        eventType: AuditEventType.MEMBERSHIP_TERMINATION_REQUESTED,
      })
    ).toBe(1);
    await expect(
      MembershipTerminationService.requestOnline({
        ...command,
        idempotencyKey: 'different-request-key',
      })
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('approves a pending request transactionally and replays the approval', async () => {
    const member = await createMember();
    const admin = await createMember();
    const requested = await MembershipTerminationService.requestOnline({
      userId: member._id.toString(),
      effectiveDate: '2026-09-30',
      idempotencyKey: 'online-request-approval',
      actor: {
        id: member._id.toString(),
        email: member.email,
        accountKind: AccountKind.PERSON,
        displayName: 'Member',
        capabilities: [Capability.AUTHENTICATED_ACCOUNT],
      },
      now: new Date('2026-07-31T12:00:00.000Z'),
    });
    const command = {
      terminationId: requested.id,
      effectiveTiming: 'scheduled' as const,
      note: 'Confirmed',
      idempotencyKey: 'approval-retry-key',
      actor: actor(admin._id.toString(), admin.email),
      evaluatedAt: new Date('2026-09-01T12:00:00.000Z'),
    };

    const approved = await MembershipTerminationService.approve(command);
    const replay = await MembershipTerminationService.approve(command);

    expect(replay.id).toBe(approved.id);
    expect(approved).toMatchObject({
      status: MembershipTerminationStatus.APPROVED,
      confirmedEffectiveDate: '2026-09-30',
    });
    expect(
      await AuditLog.countDocuments({
        eventType: AuditEventType.MEMBERSHIP_TERMINATION_APPROVED,
      })
    ).toBe(1);
  });

  it('rejects a stale requested date without changing Membership', async () => {
    const member = await createMember();
    const admin = await createMember();
    const requested = await MembershipTerminationService.requestOnline({
      userId: member._id.toString(),
      effectiveDate: '2026-06-30',
      idempotencyKey: 'stale-online-request',
      actor: {
        id: member._id.toString(),
        email: member.email,
        accountKind: AccountKind.PERSON,
        displayName: 'Member',
        capabilities: [Capability.AUTHENTICATED_ACCOUNT],
      },
      now: new Date('2026-05-01T12:00:00.000Z'),
    });

    await expect(
      MembershipTerminationService.approve({
        terminationId: requested.id,
        effectiveTiming: 'scheduled',
        idempotencyKey: 'stale-online-approval',
        actor: actor(admin._id.toString(), admin.email),
        evaluatedAt: new Date('2026-06-30T12:00:00.000Z'),
      })
    ).rejects.toThrow('Effective date must be in the future');
    expect(await User.findById(member._id)).toMatchObject({
      membershipStatus: MembershipStatus.ACTIVE,
    });
    expect(await MembershipTermination.findById(requested.id)).toMatchObject({
      status: MembershipTerminationStatus.PENDING_REVIEW,
      isOpen: true,
    });
  });

  it('rejects a pending online request idempotently and releases the open slot', async () => {
    const member = await createMember();
    const admin = await createMember();
    const memberActor = {
      id: member._id.toString(),
      email: member.email,
      accountKind: AccountKind.PERSON,
      displayName: 'Member',
      capabilities: [Capability.AUTHENTICATED_ACCOUNT],
    };
    const requested = await MembershipTerminationService.requestOnline({
      userId: member._id.toString(),
      effectiveDate: '2026-09-30',
      idempotencyKey: 'reject-online-request',
      actor: memberActor,
      now: new Date('2026-07-01T12:00:00.000Z'),
    });
    const command = {
      terminationId: requested.id,
      reason: 'Please submit a later date',
      idempotencyKey: 'reject-online-review',
      actor: actor(admin._id.toString(), admin.email),
      rejectedAt: new Date('2026-07-02T12:00:00.000Z'),
    };

    const rejected = await MembershipTerminationService.reject(command);
    const replay = await MembershipTerminationService.reject(command);
    expect(replay.id).toBe(rejected.id);
    expect(rejected).toMatchObject({
      status: MembershipTerminationStatus.REJECTED,
      rejectionReason: 'Please submit a later date',
    });
    expect(await User.findById(member._id)).toMatchObject({
      membershipStatus: MembershipStatus.ACTIVE,
    });
    expect(await MembershipLifecycleEvent.countDocuments({})).toBe(0);
    expect(
      await AuditLog.countDocuments({
        eventType: AuditEventType.MEMBERSHIP_TERMINATION_REJECTED,
      })
    ).toBe(1);
    expect(
      await MembershipTerminationService.getRelevantForUser(
        member._id.toString()
      )
    ).toMatchObject({ status: MembershipTerminationStatus.REJECTED });

    const replacement = await MembershipTerminationService.requestOnline({
      userId: member._id.toString(),
      effectiveDate: '2026-12-31',
      idempotencyKey: 'replacement-online-request',
      actor: memberActor,
      now: new Date('2026-09-01T12:00:00.000Z'),
    });
    expect(replacement.status).toBe(MembershipTerminationStatus.PENDING_REVIEW);
  });

  it('allows exactly one concurrent approval or rejection outcome', async () => {
    const member = await createMember();
    const admin = await createMember();
    const requested = await MembershipTerminationService.requestOnline({
      userId: member._id.toString(),
      effectiveDate: '2026-09-30',
      idempotencyKey: 'concurrent-review-request',
      actor: {
        id: member._id.toString(),
        email: member.email,
        accountKind: AccountKind.PERSON,
        displayName: 'Member',
        capabilities: [Capability.AUTHENTICATED_ACCOUNT],
      },
      now: new Date('2026-07-01T12:00:00.000Z'),
    });
    const adminActor = actor(admin._id.toString(), admin.email);
    const outcomes = await Promise.allSettled([
      MembershipTerminationService.approve({
        terminationId: requested.id,
        effectiveTiming: 'scheduled',
        idempotencyKey: 'concurrent-approval-key',
        actor: adminActor,
        evaluatedAt: new Date('2026-07-02T12:00:00.000Z'),
      }),
      MembershipTerminationService.reject({
        terminationId: requested.id,
        reason: 'Rejected concurrently',
        idempotencyKey: 'concurrent-rejection-key',
        actor: adminActor,
        rejectedAt: new Date('2026-07-02T12:00:00.000Z'),
      }),
    ]);
    expect(
      outcomes.filter((outcome) => outcome.status === 'fulfilled')
    ).toHaveLength(1);
    const stored = await MembershipTermination.findById(requested.id);
    expect([
      MembershipTerminationStatus.APPROVED,
      MembershipTerminationStatus.REJECTED,
    ]).toContain(stored?.status);
  });

  it('records offline and batch requests as approved with per-member outcomes', async () => {
    const admin = await createMember();
    const members = await Promise.all([
      createMember(),
      createMember(MembershipStatus.INACTIVE),
    ]);
    const adminActor = actor(admin._id.toString(), admin.email);

    const offline = await MembershipTerminationService.recordOffline({
      userId: members[0]._id.toString(),
      source: MembershipTerminationSource.EMAIL,
      requestReceivedAt: new Date('2026-05-31T12:00:00.000Z'),
      effectiveTiming: 'scheduled',
      effectiveDate: '2026-06-30',
      idempotencyKey: 'offline-record-key',
      actor: adminActor,
      now: new Date('2026-06-01T12:00:00.000Z'),
    });
    expect(offline.status).toBe(MembershipTerminationStatus.APPROVED);

    const thirdMember = await createMember();
    const batch = await MembershipTerminationService.recordBatch({
      userIds: [thirdMember._id.toString(), members[1]._id.toString()],
      effectiveTiming: 'scheduled',
      effectiveDate: '2026-09-30',
      note: 'Seasonal batch',
      idempotencyKey: 'batch-record-key',
      actor: adminActor,
      now: new Date('2026-07-01T12:00:00.000Z'),
    });
    expect(batch).toMatchObject({ createdCount: 1, failureCount: 1 });
    expect(batch.items[1].error?.code).toBe('VALIDATION_ERROR');
  });

  it('ends Membership today on the Berlin date in the same transaction', async () => {
    const member = await createMember();
    const admin = await createMember();

    const result = await MembershipTerminationService.recordOffline({
      userId: member._id.toString(),
      source: MembershipTerminationSource.IN_PERSON,
      requestReceivedAt: new Date('2026-08-31T18:00:00.000Z'),
      effectiveTiming: 'today',
      note: 'Exceptional immediate exit',
      idempotencyKey: 'offline-today-record-key',
      actor: actor(admin._id.toString(), admin.email),
      now: new Date('2026-08-31T22:30:00.000Z'),
    });

    expect(result).toMatchObject({
      status: MembershipTerminationStatus.EFFECTIVE,
      requestedEffectiveDate: '2026-09-01',
      confirmedEffectiveDate: '2026-09-01',
      approvalNote: 'Exceptional immediate exit',
    });
    expect(await User.findById(member._id)).toMatchObject({
      membershipStatus: MembershipStatus.INACTIVE,
    });
    expect(await MembershipTermination.findById(result.id)).toMatchObject({
      status: MembershipTerminationStatus.EFFECTIVE,
      isOpen: false,
      effectiveAt: new Date('2026-08-31T22:30:00.000Z'),
    });
    expect(await MembershipLifecycleEvent.countDocuments({})).toBe(1);
    const effectiveAudit = await AuditLog.findOne({
      eventType: AuditEventType.MEMBERSHIP_TERMINATION_EFFECTIVE,
    }).lean();
    expect(effectiveAudit).toMatchObject({
      source: 'human',
      reason: 'Exceptional immediate exit',
    });
    expect(effectiveAudit?.changes).toContainEqual(
      expect.objectContaining({ field: 'effectiveTiming', newValue: 'today' })
    );
  });

  it('rejects a future request-received time before a Today transaction starts', async () => {
    const member = await createMember();
    const admin = await createMember();

    await expect(
      MembershipTerminationService.recordOffline({
        userId: member._id.toString(),
        source: MembershipTerminationSource.EMAIL,
        requestReceivedAt: new Date('2026-08-15T12:00:00.001Z'),
        effectiveTiming: 'today',
        note: 'Immediate exit with impossible request time',
        idempotencyKey: 'offline-today-future-request-key',
        actor: actor(admin._id.toString(), admin.email),
        now: new Date('2026-08-15T12:00:00.000Z'),
      })
    ).rejects.toThrow('Request timestamp cannot be in the future');

    expect(await User.findById(member._id)).toMatchObject({
      membershipStatus: MembershipStatus.ACTIVE,
    });
    expect(await MembershipTermination.countDocuments({})).toBe(0);
    expect(await MembershipLifecycleEvent.countDocuments({})).toBe(0);
    expect(await AuditLog.countDocuments({})).toBe(0);
  });

  it('rolls back every Today side effect when the effective audit fails', async () => {
    const member = await createMember();
    const admin = await createMember();
    const originalWriteRequired = AuditService.writeRequired.bind(AuditService);
    const auditSpy = vi
      .spyOn(AuditService, 'writeRequired')
      .mockImplementation((params, session) => {
        if (
          params.eventType === AuditEventType.MEMBERSHIP_TERMINATION_EFFECTIVE
        ) {
          return Promise.reject(new Error('injected Today audit failure'));
        }
        return originalWriteRequired(params, session);
      });

    try {
      await expect(
        MembershipTerminationService.recordOffline({
          userId: member._id.toString(),
          source: MembershipTerminationSource.PHONE,
          requestReceivedAt: new Date('2026-08-15T12:00:00.000Z'),
          effectiveTiming: 'today',
          note: 'Immediate exception with rollback',
          idempotencyKey: 'offline-today-rollback-key',
          actor: actor(admin._id.toString(), admin.email),
          now: new Date('2026-08-15T12:00:00.000Z'),
        })
      ).rejects.toThrow('injected Today audit failure');
    } finally {
      auditSpy.mockRestore();
    }

    expect(await User.findById(member._id)).toMatchObject({
      membershipStatus: MembershipStatus.ACTIVE,
    });
    expect(await MembershipTermination.countDocuments({})).toBe(0);
    expect(await MembershipLifecycleEvent.countDocuments({})).toBe(0);
    expect(await AuditLog.countDocuments({})).toBe(0);
  });

  it('allows Today approval before the originally requested future date', async () => {
    const member = await createMember();
    const admin = await createMember();
    const requested = await MembershipTerminationService.requestOnline({
      userId: member._id.toString(),
      effectiveDate: '2026-09-30',
      idempotencyKey: 'online-today-approval-request',
      actor: {
        id: member._id.toString(),
        email: member.email,
        accountKind: AccountKind.PERSON,
        displayName: 'Member',
        capabilities: [Capability.AUTHENTICATED_ACCOUNT],
      },
      now: new Date('2026-07-31T12:00:00.000Z'),
    });

    const approved = await MembershipTerminationService.approve({
      terminationId: requested.id,
      effectiveTiming: 'today',
      note: 'Administrator exception',
      idempotencyKey: 'online-today-approval',
      actor: actor(admin._id.toString(), admin.email),
      evaluatedAt: new Date('2026-08-15T12:00:00.000Z'),
    });

    expect(approved).toMatchObject({
      status: MembershipTerminationStatus.EFFECTIVE,
      requestedEffectiveDate: '2026-09-30',
      confirmedEffectiveDate: '2026-08-15',
    });
    expect(await User.findById(member._id)).toMatchObject({
      membershipStatus: MembershipStatus.INACTIVE,
    });
  });

  it('keeps Today batch outcomes atomic per Member', async () => {
    const admin = await createMember();
    const active = await createMember();
    const inactive = await createMember(MembershipStatus.INACTIVE);

    const batch = await MembershipTerminationService.recordBatch({
      userIds: [active._id.toString(), inactive._id.toString()],
      effectiveTiming: 'today',
      note: 'Immediate batch exception',
      idempotencyKey: 'today-batch-key',
      actor: actor(admin._id.toString(), admin.email),
      now: new Date('2026-12-01T00:30:00.000Z'),
    });

    expect(batch).toMatchObject({ createdCount: 1, failureCount: 1 });
    expect(batch.items[0].termination).toMatchObject({
      status: MembershipTerminationStatus.EFFECTIVE,
      confirmedEffectiveDate: '2026-12-01',
    });
    expect(batch.items[1].error?.code).toBe('VALIDATION_ERROR');
    expect(await User.findById(active._id)).toMatchObject({
      membershipStatus: MembershipStatus.INACTIVE,
    });
    expect(await User.findById(inactive._id)).toMatchObject({
      membershipStatus: MembershipStatus.INACTIVE,
    });
  });

  it('completes termination after Player participation changed before the due date', async () => {
    const member = await createMember();
    const admin = await createMember();
    const player = await Player.create({
      userId: member._id,
      type: PlayerType.MEMBER,
      singlesRanking: 0,
      doublesRanking: 0,
      preferredPositions: [],
      isActivePlayer: true,
      teamIds: [],
    });
    const command = {
      userId: member._id.toString(),
      source: MembershipTerminationSource.EMAIL,
      requestReceivedAt: new Date('2026-05-31T12:00:00.000Z'),
      effectiveTiming: 'scheduled',
      effectiveDate: '2026-06-30',
      idempotencyKey: 'changed-player-state-record',
      actor: actor(admin._id.toString(), admin.email),
      now: new Date('2026-06-01T12:00:00.000Z'),
    } as const;

    const recorded = await MembershipTerminationService.recordOffline(command);
    const replay = await MembershipTerminationService.recordOffline(command);
    expect(replay.id).toBe(recorded.id);
    player.isActivePlayer = false;
    await player.save();

    const processed = await MembershipTerminationService.processDue({
      asOfDate: '2026-06-30',
      processedAt: new Date('2026-06-30T02:15:00.000Z'),
    });
    expect(processed).toMatchObject({ processedCount: 1, failureCount: 0 });
    expect(await User.findById(member._id)).toMatchObject({
      membershipStatus: MembershipStatus.INACTIVE,
    });
    expect(await Player.findById(player._id)).toMatchObject({
      type: PlayerType.MEMBER,
      isActivePlayer: false,
      teamIds: [],
    });
  });

  it('converts an eligible retained former Member through Membership Lifecycle', async () => {
    const member = await createMember(MembershipStatus.INACTIVE);
    const admin = await createMember();
    const player = await Player.create({
      userId: member._id,
      type: PlayerType.MEMBER,
      singlesRanking: 0,
      doublesRanking: 0,
      preferredPositions: [],
      isActivePlayer: false,
      teamIds: [],
    });
    const command = {
      playerId: player._id.toString(),
      reason: 'Approved for external club participation',
      idempotencyKey: 'former-member-external-conversion',
      actor: actor(admin._id.toString(), admin.email),
      occurredAt: new Date('2026-07-01T12:00:00.000Z'),
    };

    const converted =
      await PlayerLifecycleAdministrationService.convertFormerMemberToExternal(
        command
      );
    const replay =
      await PlayerLifecycleAdministrationService.convertFormerMemberToExternal(
        command
      );
    expect(converted.id).toBe(player._id.toString());
    expect(replay.id).toBe(player._id.toString());
    expect(await User.findById(member._id)).toMatchObject({
      membershipStatus: MembershipStatus.INACTIVE,
    });
    expect(await Player.findById(player._id)).toMatchObject({
      type: PlayerType.EXTERNAL,
      isActivePlayer: true,
      teamIds: [],
    });
    expect(await MembershipLifecycleEvent.countDocuments({})).toBe(1);
    expect(
      await AuditLog.findOne({
        eventType: AuditEventType.MEMBERSHIP_LIFECYCLE_CHANGED,
      }).lean()
    ).toMatchObject({ reason: command.reason });
  });

  it('rejects contradictory former-Member conversion states without lifecycle writes', async () => {
    const admin = await createMember();
    const team = await Team.create({
      teamId: 'convguard',
      shortName: 'Guard Team',
      leagueTeamName: 'Conversion Guard Team',
      matchLevel: TeamLevel.F,
      createdById: admin._id,
    });
    const scenarios = [
      {
        membershipStatus: MembershipStatus.ACTIVE,
        type: PlayerType.MEMBER,
        isActivePlayer: false,
        teamIds: [],
      },
      {
        membershipStatus: MembershipStatus.INACTIVE,
        type: PlayerType.EXTERNAL,
        isActivePlayer: true,
        teamIds: [],
      },
      {
        membershipStatus: MembershipStatus.INACTIVE,
        type: PlayerType.MEMBER,
        isActivePlayer: true,
        teamIds: [],
      },
      {
        membershipStatus: MembershipStatus.INACTIVE,
        type: PlayerType.MEMBER,
        isActivePlayer: false,
        teamIds: [team._id],
      },
    ];

    for (const [index, scenario] of scenarios.entries()) {
      const member = await createMember(scenario.membershipStatus);
      const player = await Player.create({
        userId: member._id,
        type: scenario.type,
        singlesRanking: 0,
        doublesRanking: 0,
        preferredPositions: [],
        isActivePlayer: scenario.isActivePlayer,
        teamIds: scenario.teamIds,
      });

      await expect(
        PlayerLifecycleAdministrationService.convertFormerMemberToExternal({
          playerId: player._id.toString(),
          reason: 'Contradictory-state guard',
          idempotencyKey: `conversion-guard-${index}`,
          actor: actor(admin._id.toString(), admin.email),
        })
      ).rejects.toMatchObject({ code: 'CONFLICT' });
    }

    expect(await MembershipLifecycleEvent.countDocuments({})).toBe(0);
    expect(await AuditLog.countDocuments({})).toBe(0);
  });

  it('rolls back the termination when required audit creation fails', async () => {
    const member = await createMember();
    const auditSpy = vi
      .spyOn(AuditLog, 'create')
      .mockRejectedValueOnce(new Error('injected audit failure'));
    try {
      await expect(
        MembershipTerminationService.requestOnline({
          userId: member._id.toString(),
          effectiveDate: '2026-09-30',
          idempotencyKey: 'audit-rollback-key',
          actor: {
            id: member._id.toString(),
            email: member.email,
            accountKind: AccountKind.PERSON,
            displayName: 'Member',
            capabilities: [Capability.AUTHENTICATED_ACCOUNT],
          },
          now: new Date('2026-07-01T12:00:00.000Z'),
        })
      ).rejects.toThrow('Required Audit persistence failed');
    } finally {
      auditSpy.mockRestore();
    }
    expect(await MembershipTermination.countDocuments({})).toBe(0);
    expect(await AuditLog.countDocuments({})).toBe(0);
  });

  it('processes a due termination exactly once and preserves Match references', async () => {
    const member = await createMember();
    const profile = await createMemberBankingProfile(member._id);
    const admin = await createMember();
    const team = await Team.create({
      teamId: 'wp8team',
      shortName: 'WP8 Team',
      leagueTeamName: 'WP8 League Team',
      matchLevel: TeamLevel.F,
      createdById: admin._id,
    });
    const player = await Player.create({
      userId: member._id,
      type: PlayerType.MEMBER,
      singlesRanking: 0,
      doublesRanking: 0,
      preferredPositions: [],
      isActivePlayer: true,
      teamIds: [team._id],
    });
    const match = await Match.create(
      withMatchScheduleDuplicateKey({
        startAt: new Date('2026-07-15T10:00:00.000Z'),
        location: 'Test Hall',
        direction: MatchDirection.HOME,
        teamId: team._id,
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
        createdById: admin._id,
      })
    );
    const recorded = await MembershipTerminationService.recordOffline({
      userId: member._id.toString(),
      source: MembershipTerminationSource.EMAIL,
      requestReceivedAt: new Date('2026-05-31T12:00:00.000Z'),
      effectiveTiming: 'scheduled',
      effectiveDate: '2026-06-30',
      idempotencyKey: 'effective-processing-record',
      actor: actor(admin._id.toString(), admin.email),
      now: new Date('2026-06-01T12:00:00.000Z'),
    });
    await User.updateOne(
      { _id: member._id },
      {
        $set: {
          accountSuspension: {
            reason: 'Temporary access review',
            suspendedAt: new Date('2026-06-15T12:00:00.000Z'),
            suspendedBy: admin._id,
          },
        },
      }
    );

    const early = await MembershipTerminationService.processDue({
      asOfDate: '2026-06-29',
      processedAt: new Date('2026-06-29T02:15:00.000Z'),
    });
    expect(early.items).toHaveLength(0);
    expect((await User.findById(member._id))?.membershipStatus).toBe(
      MembershipStatus.ACTIVE
    );

    const outcomes = await Promise.all([
      MembershipTerminationService.processDue({
        asOfDate: '2026-06-30',
        processedAt: new Date('2026-06-30T02:15:00.000Z'),
      }),
      MembershipTerminationService.processDue({
        asOfDate: '2026-06-30',
        processedAt: new Date('2026-06-30T02:15:00.000Z'),
      }),
    ]);

    expect(outcomes.reduce((sum, item) => sum + item.failureCount, 0)).toBe(0);
    expect(await User.findById(member._id)).toMatchObject({
      membershipStatus: MembershipStatus.INACTIVE,
      accountSuspension: { reason: 'Temporary access review' },
    });
    expect(await Player.findById(player._id)).toMatchObject({
      isActivePlayer: false,
      teamIds: [],
    });
    expect(await MemberBankingProfile.findById(profile._id)).not.toBeNull();
    const persistedMatch = await Match.findById(match._id);
    expect(persistedMatch?.lineup[0]?.playerId.toString()).toBe(
      player._id.toString()
    );
    expect(persistedMatch?.availability[0]?.playerId.toString()).toBe(
      player._id.toString()
    );

    await expect(
      MatchLineupService.setLineup(match._id.toString(), {
        expectedVersion: persistedMatch?.__v ?? 0,
        lineup: [
          {
            position: LineupPosition.MEN_SINGLES_1,
            playerId: player._id.toString(),
          },
        ],
      })
    ).resolves.toMatchObject({
      match: { id: match._id.toString() },
    });
    await expect(
      MatchAvailabilityService.setOwnAvailability(
        match._id.toString(),
        {
          expectedVersion: persistedMatch?.__v ?? 0,
          participation: MatchAvailabilityParticipation.AVAILABLE,
        },
        {
          userId: member._id.toString(),
          playerId: player._id.toString(),
        },
        new Date('2026-07-01T00:00:00.000Z')
      )
    ).rejects.toThrow('Match not found');
    await expect(
      MatchLineupService.setLineup(match._id.toString(), {
        expectedVersion: persistedMatch?.__v ?? 0,
        lineup: [
          {
            position: LineupPosition.MEN_SINGLES_2,
            playerId: player._id.toString(),
          },
        ],
      })
    ).rejects.toMatchObject({ code: 'LINEUP_VALIDATION_FAILED' });
    const cleared = await MatchLineupService.setLineup(match._id.toString(), {
      expectedVersion: persistedMatch?.__v ?? 0,
      lineup: [],
    });
    await expect(
      MatchLineupService.setLineup(match._id.toString(), {
        expectedVersion: cleared.match.version,
        lineup: [
          {
            position: LineupPosition.MEN_SINGLES_1,
            playerId: player._id.toString(),
          },
        ],
      })
    ).rejects.toMatchObject({ code: 'LINEUP_VALIDATION_FAILED' });
    expect(await MembershipLifecycleEvent.countDocuments({})).toBe(1);
    expect(
      await AuditLog.findOne({
        eventType: AuditEventType.MEMBERSHIP_TERMINATION_EFFECTIVE,
      }).lean()
    ).toMatchObject({ source: 'scheduled' });
    expect(await MembershipTermination.findById(recorded.id)).toMatchObject({
      status: MembershipTerminationStatus.EFFECTIVE,
      isOpen: false,
    });

    const retry = await MembershipTerminationService.processDue({
      asOfDate: '2026-06-30',
      processedAt: new Date('2026-06-30T03:15:00.000Z'),
    });
    expect(retry.items).toHaveLength(0);
  });

  it('does not persist a stale processing failure after concurrent completion', async () => {
    const member = await createMember();
    const admin = await createMember();
    const recorded = await MembershipTerminationService.recordOffline({
      userId: member._id.toString(),
      source: MembershipTerminationSource.PHONE,
      requestReceivedAt: new Date('2026-05-01T12:00:00.000Z'),
      effectiveTiming: 'scheduled',
      effectiveDate: '2026-06-30',
      idempotencyKey: 'processor-success-failure-race-record',
      actor: actor(admin._id.toString(), admin.email),
      now: new Date('2026-05-02T12:00:00.000Z'),
    });
    const failureWriteReached = deferred();
    const releaseFailureWrite = deferred();
    const originalUpdateOne = MembershipTermination.updateOne.bind(
      MembershipTermination
    );
    const failureWriteSpy = vi
      .spyOn(MembershipTermination, 'updateOne')
      .mockImplementationOnce((async (
        ...args: Parameters<typeof MembershipTermination.updateOne>
      ) => {
        failureWriteReached.resolve();
        await releaseFailureWrite.promise;
        return originalUpdateOne(...args);
      }) as typeof MembershipTermination.updateOne);
    const auditSpy = vi
      .spyOn(AuditLog, 'create')
      .mockRejectedValueOnce(new Error('injected competing processor failure'));

    try {
      const failedRun = MembershipTerminationService.processDue({
        asOfDate: '2026-06-30',
        processedAt: new Date('2026-06-30T02:15:00.000Z'),
      });
      await failureWriteReached.promise;

      const successfulRun = await MembershipTerminationService.processDue({
        asOfDate: '2026-06-30',
        processedAt: new Date('2026-06-30T02:16:00.000Z'),
      });
      expect(successfulRun).toMatchObject({
        processedCount: 1,
        failureCount: 0,
      });

      releaseFailureWrite.resolve();
      await expect(failedRun).resolves.toMatchObject({
        processedCount: 0,
        failureCount: 1,
      });
    } finally {
      releaseFailureWrite.resolve();
      auditSpy.mockRestore();
      failureWriteSpy.mockRestore();
    }

    expect(await MembershipTermination.findById(recorded.id)).toMatchObject({
      status: MembershipTerminationStatus.EFFECTIVE,
      isOpen: false,
      lastProcessingFailure: undefined,
    });
  });

  it('rolls back lifecycle and termination completion when due processing fails', async () => {
    const member = await createMember();
    const admin = await createMember();
    const recorded = await MembershipTerminationService.recordOffline({
      userId: member._id.toString(),
      source: MembershipTerminationSource.PHONE,
      requestReceivedAt: new Date('2026-05-01T12:00:00.000Z'),
      effectiveTiming: 'scheduled',
      effectiveDate: '2026-06-30',
      idempotencyKey: 'processor-rollback-record',
      actor: actor(admin._id.toString(), admin.email),
      now: new Date('2026-05-02T12:00:00.000Z'),
    });
    const auditSpy = vi
      .spyOn(AuditLog, 'create')
      .mockRejectedValueOnce(new Error('injected processor audit failure'));
    let result;
    try {
      result = await MembershipTerminationService.processDue({
        asOfDate: '2026-06-30',
        processedAt: new Date('2026-06-30T02:15:00.000Z'),
      });
    } finally {
      auditSpy.mockRestore();
    }

    expect(result?.failureCount).toBe(1);
    expect((await User.findById(member._id))?.membershipStatus).toBe(
      MembershipStatus.ACTIVE
    );
    expect(await MembershipLifecycleEvent.countDocuments({})).toBe(0);
    expect(await MembershipTermination.findById(recorded.id)).toMatchObject({
      status: MembershipTerminationStatus.APPROVED,
      isOpen: true,
      lastProcessingFailure: {
        code: 'TERMINATION_PROCESSING_FAILED',
        message:
          'Membership termination processing failed. Review the current Membership and Player state before the next scheduled retry.',
        failedAt: new Date('2026-06-30T02:15:00.000Z'),
      },
    });
    const adminProjection = await MembershipTerminationService.listOpen();
    expect(adminProjection[0].lastProcessingFailure).toMatchObject({
      code: 'TERMINATION_PROCESSING_FAILED',
    });
    expect(adminProjection[0].lastProcessingFailure?.message).not.toContain(
      'injected'
    );
    const memberProjection =
      await MembershipTerminationService.getRelevantForUser(
        member._id.toString()
      );
    expect(memberProjection).not.toHaveProperty('lastProcessingFailure');

    const retry = await MembershipTerminationService.processDue({
      asOfDate: '2026-06-30',
      processedAt: new Date('2026-06-30T03:15:00.000Z'),
    });
    expect(retry).toMatchObject({ processedCount: 1, failureCount: 0 });
    expect(await MembershipTermination.findById(recorded.id)).toMatchObject({
      status: MembershipTerminationStatus.EFFECTIVE,
      isOpen: false,
      lastProcessingFailure: undefined,
    });
  });
});
