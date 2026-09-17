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
  AccountOnboardingStatus,
  Gender,
  MemberListFilter,
  MembershipStatus,
  MembershipType,
  PlayerType,
  AccountKind,
  Capability,
} from '@club/shared-types/core/enums';
import {
  AccountOnboardingTargetKind,
  type EstablishAccountCommand,
  type EstablishMemberCommand,
} from '@club/shared-types/domain/accountOnboarding';
import { AccountOnboardingOperation } from '../../models/AccountOnboardingOperation';
import { AuditLog } from '../../models/AuditLog';
import { MembershipLifecycleEvent } from '../../models/MembershipLifecycleEvent';
import { Player } from '../../models/Player';
import { RegistrationApprovalEvent } from '../../models/RegistrationApprovalEvent';
import { User } from '../../models/User';
import { buildMemberListFilter } from '../../controllers/userController';
import {
  accountOnboardingService,
  legacyImportOnboardingService,
} from '../../services/accountOnboardingService';
import EmailService from '../../services/emailService';
import {
  PASSWORD_SETUP_DELIVERY_STALE_MS,
  PasswordSetupDeliveryService,
} from '../../services/passwordSetupDeliveryService';
import { PasswordSetupService } from '../../services/passwordSetupService';

let mongoLease: MongoTestDatabaseLease;
const actor = {
  id: new mongoose.Types.ObjectId().toString(),
  email: 'admin@example.test',
  accountKind: AccountKind.PERSON,
  displayName: 'Administrator',
  capabilities: [Capability.ADMINISTRATION],
};

function identity(email = `${randomUUID()}@example.test`) {
  return {
    email,
    firstName: 'New',
    lastName: 'Member',
    dateOfBirth: '1990-01-01',
    gender: Gender.FEMALE,
    phone: '+49123456789',
    address: {
      street: 'Main 1',
      city: 'Trossingen',
      postalCode: '78647',
      country: 'DE',
    },
  };
}

function memberCommand(
  idempotencyKey: string,
  email?: string,
  establishPlayer = false,
  initialMembershipStatus:
    | MembershipStatus.ACTIVE
    | MembershipStatus.PASSIVE = MembershipStatus.ACTIVE,
  setupLocale: 'de' | 'en' | 'zh' = 'de',
  sendPasswordSetupEmailNow = true
) {
  return {
    identity: identity(email),
    targetKind: AccountOnboardingTargetKind.MEMBER,
    establishPlayer,
    initialMembershipStatus,
    membershipType: MembershipType.REGULAR,
    setupLocale,
    sendPasswordSetupEmailNow,
    actor,
    source: { kind: 'administrator' as const },
    idempotencyKey,
  };
}

function legacyImportCommand(
  idempotencyKey: string,
  email?: string
): EstablishMemberCommand {
  return {
    identity: identity(email),
    targetKind: AccountOnboardingTargetKind.MEMBER,
    establishPlayer: false,
    initialMembershipStatus: MembershipStatus.ACTIVE,
    actor,
    source: {
      kind: 'legacy_import' as const,
      reference: 'mock-member.csv:2',
    },
    idempotencyKey,
  };
}

beforeAll(async () => {
  mongoLease = await acquireMongoTestDatabase('accountOnboarding');
  mongoLease.assertOwnedDatabase();
  await User.syncIndexes();
  await Player.syncIndexes();
  await AuditLog.syncIndexes();
  await MembershipLifecycleEvent.syncIndexes();
  await AccountOnboardingOperation.syncIndexes();
  await RegistrationApprovalEvent.syncIndexes();
}, 120_000);

beforeEach(async () => {
  mongoLease.assertOwnedDatabase();
  await User.deleteMany({});
  await Player.deleteMany({});
  await AuditLog.deleteMany({});
  await MembershipLifecycleEvent.deleteMany({});
  await AccountOnboardingOperation.deleteMany({});
  await RegistrationApprovalEvent.deleteMany({});
  process.env.FRONTEND_URL = 'https://club.example.test';
  vi.restoreAllMocks();
  vi.spyOn(EmailService, 'sendFromTemplate').mockResolvedValue();
});

afterAll(async () => {
  await mongoLease.release();
});

describe('legacy import Account Onboarding persistence', () => {
  it('establishes a pending active Member without issuing or delivering setup', async () => {
    const result = await legacyImportOnboardingService.establish(
      legacyImportCommand('legacy-new-member')
    );

    expect(result).toEqual({
      userId: expect.any(String),
      targetKind: AccountOnboardingTargetKind.MEMBER,
      setupRequired: true,
      setupGeneration: 0,
      replayed: false,
    });
    const user = await User.findById(result.userId).select(
      '+password +passwordSetupTokenDigest'
    );
    expect(user).toMatchObject({
      accountKind: AccountKind.PERSON,
      administratorDesignation: false,
      membershipStatus: MembershipStatus.ACTIVE,
      accountOnboardingStatus: AccountOnboardingStatus.PASSWORD_SETUP_PENDING,
      passwordSetupGeneration: 0,
      isPlayer: false,
    });
    expect(user?.password).toBeUndefined();
    expect(user?.passwordSetupTokenDigest).toBeUndefined();
    expect(user?.passwordSetupExpiresAt).toBeUndefined();
    expect(user?.passwordSetupDeliveryGeneration).toBeUndefined();
    expect(user?.passwordSetupDeliveryStatus).toBeUndefined();
    expect(user?.passwordSetupDeliveryClaimedAt).toBeUndefined();
    expect(user?.passwordSetupDeliveryAttemptedAt).toBeUndefined();
    expect(await Player.countDocuments({ userId: result.userId })).toBe(0);
    expect(await AccountOnboardingOperation.findOne()).toMatchObject({
      sourceKind: 'legacy_import',
      status: 'completed',
      result: {
        userId: result.userId,
        setupRequired: true,
        setupGeneration: 0,
      },
    });
    expect(EmailService.sendFromTemplate).not.toHaveBeenCalled();

    await expect(
      PasswordSetupDeliveryService.reissueForUser(result.userId)
    ).resolves.toEqual({ generation: 1, deliveryStatus: 'sent' });
    expect(EmailService.sendFromTemplate).toHaveBeenCalledOnce();
    expect((await User.findById(result.userId))?.passwordSetupGeneration).toBe(
      1
    );
  });

  it('replays safely without duplicate identity, lifecycle, operation, or delivery', async () => {
    const command = legacyImportCommand(
      'legacy-stable-replay',
      'legacy-replay@example.test'
    );
    const first = await legacyImportOnboardingService.establish(command);
    const replay = await legacyImportOnboardingService.establish(command);

    expect(replay).toEqual({ ...first, replayed: true });
    expect(await User.countDocuments({})).toBe(1);
    expect(await Player.countDocuments({})).toBe(0);
    expect(await AccountOnboardingOperation.countDocuments({})).toBe(1);
    expect(await MembershipLifecycleEvent.countDocuments({})).toBe(1);
    expect(await AuditLog.countDocuments({})).toBe(1);
    expect(EmailService.sendFromTemplate).not.toHaveBeenCalled();
  });

  it('reuses a compatible Member without changing credential or setup state', async () => {
    const existing = await User.create({
      ...identity('legacy-existing@example.test'),
      accountKind: AccountKind.PERSON,
      administratorDesignation: false,
      membershipStatus: MembershipStatus.ACTIVE,
      accountOnboardingStatus: AccountOnboardingStatus.READY,
      password: 'Test-Only-Password-1!',
      isPlayer: false,
    });
    const before = await User.findById(existing._id).select(
      '+password +passwordSetupTokenDigest'
    );

    const result = await legacyImportOnboardingService.establish(
      legacyImportCommand(
        'legacy-compatible-existing',
        ' LEGACY-EXISTING@example.test '
      )
    );
    const after = await User.findById(existing._id).select(
      '+password +passwordSetupTokenDigest'
    );

    expect(result).toEqual({
      userId: existing._id.toString(),
      targetKind: AccountOnboardingTargetKind.MEMBER,
      setupRequired: false,
      setupGeneration: 0,
      replayed: false,
    });
    expect(after?.password).toBe(before?.password);
    expect(after?.accountOnboardingStatus).toBe(AccountOnboardingStatus.READY);
    expect(after?.passwordSetupGeneration).toBe(0);
    expect(after?.passwordSetupTokenDigest).toBeUndefined();
    expect(await User.countDocuments({})).toBe(1);
    expect(await Player.countDocuments({})).toBe(0);
    expect(await AccountOnboardingOperation.countDocuments({})).toBe(1);
    expect(await MembershipLifecycleEvent.countDocuments({})).toBe(0);
    expect(EmailService.sendFromTemplate).not.toHaveBeenCalled();
  });

  it('rejects conflicting replay intent without partial mutation', async () => {
    const command = legacyImportCommand(
      'legacy-conflicting-intent',
      'legacy-conflict@example.test'
    );
    await legacyImportOnboardingService.establish(command);

    await expect(
      legacyImportOnboardingService.establish({
        ...command,
        identity: { ...command.identity, firstName: 'Changed' },
      })
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(await User.countDocuments({})).toBe(1);
    expect(await AccountOnboardingOperation.countDocuments({})).toBe(1);
    expect(await MembershipLifecycleEvent.countDocuments({})).toBe(1);
    expect(await AuditLog.countDocuments({})).toBe(1);
  });

  it.each([
    ['administrator source', { source: { kind: 'administrator' as const } }],
    [
      'passive Membership',
      { initialMembershipStatus: MembershipStatus.PASSIVE },
    ],
    [
      'External Player target',
      {
        targetKind: AccountOnboardingTargetKind.EXTERNAL_PLAYER,
        establishPlayer: true,
        initialMembershipStatus: undefined,
      },
    ],
    ['Player establishment', { establishPlayer: true }],
    [
      'non-Administrator actor',
      {
        actor: {
          ...actor,
          accountKind: AccountKind.PERSON,
          displayName: 'Member',
          capabilities: [Capability.AUTHENTICATED_ACCOUNT],
        },
      },
    ],
  ])('rejects %s before mutation', async (_label, override) => {
    await expect(
      legacyImportOnboardingService.establish({
        ...legacyImportCommand(`legacy-invalid-${_label}`),
        ...override,
      } as EstablishAccountCommand)
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(await User.countDocuments({})).toBe(0);
    expect(await Player.countDocuments({})).toBe(0);
    expect(await AccountOnboardingOperation.countDocuments({})).toBe(0);
    expect(await MembershipLifecycleEvent.countDocuments({})).toBe(0);
    expect(await AuditLog.countDocuments({})).toBe(0);
    expect(EmailService.sendFromTemplate).not.toHaveBeenCalled();
  });
});

describe('direct Account Onboarding persistence', () => {
  it('defers a new Member setup without creating an expiring credential or delivery state', async () => {
    const command = memberCommand(
      'direct-deferred-member',
      'direct-deferred@example.test',
      false,
      MembershipStatus.ACTIVE,
      'zh',
      false
    );
    const result = await accountOnboardingService.establish(command);
    const replay = await accountOnboardingService.establish(command);
    const user = await User.findById(result.userId).select(
      '+passwordSetupTokenDigest'
    );

    expect(result).toEqual({
      userId: expect.any(String),
      targetKind: AccountOnboardingTargetKind.MEMBER,
      setupRequired: true,
      setupGeneration: 0,
      replayed: false,
    });
    expect(replay).toEqual({ ...result, replayed: true });
    expect(user).toMatchObject({
      passwordSetupGeneration: 0,
      passwordSetupLocale: 'zh',
      accountOnboardingStatus: AccountOnboardingStatus.PASSWORD_SETUP_PENDING,
    });
    expect(user?.passwordSetupTokenDigest).toBeUndefined();
    expect(user?.passwordSetupExpiresAt).toBeUndefined();
    expect(user?.passwordSetupDeliveryStatus).toBeUndefined();
    expect(user?.passwordSetupDeliveryGeneration).toBeUndefined();
    expect(EmailService.sendFromTemplate).not.toHaveBeenCalled();

    const summaries = await PasswordSetupDeliveryService.setupSummariesForUsers(
      [user!]
    );
    expect(summaries.get(result.userId)).toMatchObject({
      deliveryStatus: 'not_attempted',
      reissueAvailable: true,
    });
    await expect(
      PasswordSetupDeliveryService.reissueForUser(result.userId)
    ).resolves.toEqual({ generation: 1, deliveryStatus: 'sent' });
    expect(await User.countDocuments({})).toBe(1);
  });

  it('preserves an existing setup generation and its locale when delivery is deferred', async () => {
    const existing = await User.create({
      ...identity('existing-deferred@example.test'),
      accountKind: AccountKind.PERSON,
      administratorDesignation: false,
      membershipType: MembershipType.REGULAR,
      membershipStatus: MembershipStatus.ACTIVE,
      accountOnboardingStatus: AccountOnboardingStatus.PASSWORD_SETUP_PENDING,
      isPlayer: false,
    });
    await PasswordSetupService.issue(existing._id.toString(), undefined, {
      locale: 'en',
    });

    const result = await accountOnboardingService.establish(
      memberCommand(
        'direct-defer-existing',
        existing.email,
        false,
        MembershipStatus.ACTIVE,
        'zh',
        false
      )
    );
    const after = await User.findById(existing._id).select(
      '+passwordSetupTokenDigest'
    );

    expect(result).toMatchObject({ setupGeneration: 1 });
    expect(result).not.toHaveProperty('deliveryStatus');
    expect(after?.passwordSetupGeneration).toBe(1);
    expect(after?.passwordSetupLocale).toBe('en');
    expect(after?.passwordSetupTokenDigest).toBeDefined();
    expect(EmailService.sendFromTemplate).not.toHaveBeenCalled();
  });

  it('issues one fresh generation for a reused Member after terminal delivery failure', async () => {
    const existing = await User.create({
      ...identity('existing-send-now@example.test'),
      accountKind: AccountKind.PERSON,
      administratorDesignation: false,
      membershipType: MembershipType.REGULAR,
      membershipStatus: MembershipStatus.ACTIVE,
      accountOnboardingStatus: AccountOnboardingStatus.PASSWORD_SETUP_PENDING,
      isPlayer: false,
    });
    await PasswordSetupService.issue(existing._id.toString(), undefined, {
      locale: 'en',
    });
    await User.updateOne(
      { _id: existing._id },
      {
        $set: {
          passwordSetupDeliveryStatus: 'failed',
          passwordSetupDeliveryGeneration: 1,
          passwordSetupDeliveryAttemptedAt: new Date(),
        },
      }
    );

    const command = memberCommand(
      'direct-send-existing',
      existing.email,
      false,
      MembershipStatus.ACTIVE,
      'zh',
      true
    );
    const first = await accountOnboardingService.establish(command);
    const replay = await accountOnboardingService.establish(command);

    expect(first).toMatchObject({
      setupGeneration: 2,
      deliveryStatus: 'sent',
      replayed: false,
    });
    expect(replay).toEqual({ ...first, replayed: true });
    expect((await User.findById(existing._id))?.passwordSetupLocale).toBe('zh');
    expect(EmailService.sendFromTemplate).toHaveBeenCalledOnce();
  });

  it.each([
    'pending',
    'claimed',
  ] as const)('rejects reused send-now while the current delivery is freshly %s', async (deliveryState) => {
    const existing = await User.create({
      ...identity(`existing-${deliveryState}@example.test`),
      accountKind: AccountKind.PERSON,
      administratorDesignation: false,
      membershipType: MembershipType.REGULAR,
      membershipStatus: MembershipStatus.ACTIVE,
      accountOnboardingStatus: AccountOnboardingStatus.PASSWORD_SETUP_PENDING,
      isPlayer: false,
    });
    await PasswordSetupService.issue(existing._id.toString(), undefined, {
      locale: 'en',
    });
    if (deliveryState === 'claimed') {
      await User.updateOne(
        { _id: existing._id },
        {
          $set: {
            passwordSetupDeliveryStatus: 'claimed',
            passwordSetupDeliveryGeneration: 1,
            passwordSetupDeliveryClaimedAt: new Date(),
          },
        }
      );
    }

    await expect(
      accountOnboardingService.establish(
        memberCommand(
          `direct-send-${deliveryState}`,
          existing.email,
          false,
          MembershipStatus.ACTIVE,
          'zh',
          true
        )
      )
    ).rejects.toMatchObject({ statusCode: 409 });

    const after = await User.findById(existing._id);
    expect(after?.passwordSetupGeneration).toBe(1);
    expect(after?.passwordSetupLocale).toBe('en');
    expect(after?.passwordSetupDeliveryStatus).toBe(deliveryState);
    expect(await AccountOnboardingOperation.countDocuments({})).toBe(0);
    expect(EmailService.sendFromTemplate).not.toHaveBeenCalled();
  });

  it.each([
    [MembershipStatus.ACTIVE, false],
    [MembershipStatus.PASSIVE, false],
    [MembershipStatus.ACTIVE, true],
  ] as const)('establishes a %s Member with establishPlayer=%s', async (initialMembershipStatus, establishPlayer) => {
    const result = await accountOnboardingService.establish(
      memberCommand(
        `direct-${initialMembershipStatus}-${establishPlayer}`,
        undefined,
        establishPlayer,
        initialMembershipStatus,
        'zh'
      )
    );

    expect(result).toMatchObject({
      targetKind: AccountOnboardingTargetKind.MEMBER,
      setupRequired: true,
      setupGeneration: 1,
      deliveryStatus: 'sent',
      replayed: false,
    });
    const user = await User.findById(result.userId).select(
      '+password +passwordSetupTokenDigest'
    );
    expect(user).toMatchObject({
      accountKind: AccountKind.PERSON,
      administratorDesignation: false,
      membershipStatus: initialMembershipStatus,
      membershipType: MembershipType.REGULAR,
      accountOnboardingStatus: AccountOnboardingStatus.PASSWORD_SETUP_PENDING,
      passwordSetupGeneration: 1,
      passwordSetupLocale: 'zh',
      isPlayer: establishPlayer,
    });
    expect(user?.password).toBeUndefined();
    expect(user?.passwordSetupTokenDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(await Player.countDocuments({ userId: result.userId })).toBe(
      establishPlayer ? 1 : 0
    );
    expect(await AccountOnboardingOperation.countDocuments({})).toBe(1);
    expect(await RegistrationApprovalEvent.countDocuments({})).toBe(0);
    expect(await MembershipLifecycleEvent.countDocuments({})).toBe(
      establishPlayer ? 2 : 1
    );
    expect(await AuditLog.countDocuments({})).toBe(establishPlayer ? 2 : 1);
    expect(EmailService.sendFromTemplate).toHaveBeenCalledWith(
      'member_password_setup',
      user!.email,
      'zh',
      expect.anything()
    );
  });

  it('establishes a User-linked External Player without Membership', async () => {
    const result = await accountOnboardingService.establish({
      identity: identity(),
      targetKind: AccountOnboardingTargetKind.EXTERNAL_PLAYER,
      establishPlayer: true,
      actor,
      source: { kind: 'administrator' },
      idempotencyKey: 'direct-external-player',
      setupLocale: 'en',
    });

    expect(result).toMatchObject({
      targetKind: AccountOnboardingTargetKind.EXTERNAL_PLAYER,
      setupGeneration: 1,
      deliveryStatus: 'sent',
    });
    expect(await User.findById(result.userId)).toMatchObject({
      accountKind: AccountKind.PERSON,
      administratorDesignation: false,
      membershipStatus: MembershipStatus.INACTIVE,
      isPlayer: true,
      passwordSetupLocale: 'en',
    });
    expect(await Player.findById(result.playerId)).toMatchObject({
      type: PlayerType.EXTERNAL,
      isActivePlayer: true,
    });
    expect(await MembershipLifecycleEvent.countDocuments({})).toBe(1);
    expect(await AuditLog.countDocuments({})).toBe(1);
  });

  it('keeps External Players in Player persistence and out of every Member projection', async () => {
    const established = await accountOnboardingService.establish({
      identity: identity('external-projection@example.test'),
      targetKind: AccountOnboardingTargetKind.EXTERNAL_PLAYER,
      establishPlayer: true,
      actor,
      source: { kind: 'administrator' },
      idempotencyKey: 'direct-external-player-projection',
    });
    const inactiveMember = await User.create({
      ...identity('inactive-member@example.test'),
      accountKind: AccountKind.PERSON,
      administratorDesignation: false,
      membershipType: MembershipType.REGULAR,
      membershipStatus: MembershipStatus.INACTIVE,
      accountOnboardingStatus: AccountOnboardingStatus.READY,
      password: 'Test-Only-Password-1!',
      isPlayer: false,
    });

    expect(await Player.exists({ userId: established.userId })).not.toBeNull();

    for (const filter of [
      MemberListFilter.CURRENT,
      MemberListFilter.INACTIVE,
      MemberListFilter.ALL,
    ]) {
      const projectedUserIds = (
        await User.find(
          buildMemberListFilter(filter, undefined, [established.userId])
        ).select('_id')
      ).map((user) => user._id.toString());

      expect(projectedUserIds).not.toContain(established.userId);
      if (
        filter === MemberListFilter.INACTIVE ||
        filter === MemberListFilter.ALL
      ) {
        expect(projectedUserIds).toContain(inactiveMember._id.toString());
      }
    }
  });

  it.each([
    ['Member', false],
    ['External Player', true],
  ] as const)('allows setup reissue for a directly established %s', async (_label, external) => {
    const established = external
      ? await accountOnboardingService.establish({
          identity: identity(),
          targetKind: AccountOnboardingTargetKind.EXTERNAL_PLAYER,
          establishPlayer: true,
          actor,
          source: { kind: 'administrator' },
          idempotencyKey: `reissue-${_label}`,
          setupLocale: 'en',
        })
      : await accountOnboardingService.establish(
          memberCommand(
            `reissue-${_label}`,
            undefined,
            false,
            MembershipStatus.ACTIVE,
            'en'
          )
        );

    await expect(
      PasswordSetupDeliveryService.reissueForUser(established.userId)
    ).resolves.toEqual({ generation: 2, deliveryStatus: 'sent' });
    expect(
      (await User.findById(established.userId))?.passwordSetupGeneration
    ).toBe(2);
    expect((await User.findById(established.userId))?.passwordSetupLocale).toBe(
      'en'
    );
  });

  it('rejects concurrent reissue while the current delivery claim is active', async () => {
    const established = await accountOnboardingService.establish(
      memberCommand('active-delivery-claim')
    );
    await User.updateOne(
      { _id: established.userId },
      {
        $set: {
          passwordSetupDeliveryStatus: 'claimed',
          passwordSetupDeliveryGeneration: 1,
          passwordSetupDeliveryClaimedAt: new Date(),
        },
      }
    );

    const results = await Promise.allSettled([
      PasswordSetupDeliveryService.reissueForUser(established.userId),
      PasswordSetupDeliveryService.reissueForUser(established.userId),
    ]);

    expect(results).toHaveLength(2);
    for (const result of results) {
      expect(result.status).toBe('rejected');
      if (result.status === 'rejected') {
        expect(result.reason).toMatchObject({ statusCode: 409 });
      }
    }
    expect(
      (await User.findById(established.userId))?.passwordSetupGeneration
    ).toBe(1);
    expect(EmailService.sendFromTemplate).toHaveBeenCalledOnce();
  });

  it('rejects reissue while the current setup is pending its delivery claim', async () => {
    const established = await accountOnboardingService.establish(
      memberCommand('active-pending-delivery')
    );
    await User.updateOne(
      { _id: established.userId },
      {
        $set: { passwordSetupDeliveryStatus: 'pending' },
        $unset: {
          passwordSetupDeliveryGeneration: 1,
          passwordSetupDeliveryClaimedAt: 1,
          passwordSetupDeliveryAttemptedAt: 1,
        },
      }
    );

    await expect(
      PasswordSetupDeliveryService.reissueForUser(established.userId)
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(
      (await User.findById(established.userId))?.passwordSetupGeneration
    ).toBe(1);
    expect(EmailService.sendFromTemplate).toHaveBeenCalledOnce();
  });

  it('allows recovery only after the current delivery claim becomes stale', async () => {
    const established = await accountOnboardingService.establish(
      memberCommand('stale-delivery-claim')
    );
    await User.updateOne(
      { _id: established.userId },
      {
        $set: {
          passwordSetupDeliveryStatus: 'claimed',
          passwordSetupDeliveryGeneration: 1,
          passwordSetupDeliveryClaimedAt: new Date(
            Date.now() - PASSWORD_SETUP_DELIVERY_STALE_MS - 1
          ),
        },
      }
    );

    await expect(
      PasswordSetupDeliveryService.reissueForUser(established.userId)
    ).resolves.toEqual({ generation: 2, deliveryStatus: 'sent' });
    expect(
      (await User.findById(established.userId))?.passwordSetupGeneration
    ).toBe(2);
    expect(EmailService.sendFromTemplate).toHaveBeenCalledTimes(2);
  });

  it('rejects reissue for an orphan pending Member without a supported onboarding source', async () => {
    const user = await User.create({
      ...identity('orphan-reissue@example.test'),
      accountKind: AccountKind.PERSON,
      administratorDesignation: false,
      membershipType: MembershipType.REGULAR,
      membershipStatus: MembershipStatus.ACTIVE,
      accountOnboardingStatus: AccountOnboardingStatus.PASSWORD_SETUP_PENDING,
      isPlayer: false,
    });

    await expect(
      PasswordSetupDeliveryService.reissueForUser(user._id.toString())
    ).rejects.toMatchObject({ statusCode: 404 });
    expect((await User.findById(user._id))?.passwordSetupGeneration).toBe(0);
  });

  it('allows password setup reissue while Account access is suspended', async () => {
    const established = await accountOnboardingService.establish(
      memberCommand('suspended-member-reissue', undefined, true)
    );
    await User.updateOne(
      { _id: established.userId },
      {
        $set: {
          accountSuspension: {
            reason: 'Access review',
            suspendedAt: new Date('2026-07-13T12:00:00.000Z'),
            suspendedBy: actor.id,
          },
        },
      }
    );
    expect(
      (await Player.findOne({ userId: established.userId }))?.isActivePlayer
    ).toBe(true);

    await expect(
      PasswordSetupDeliveryService.reissueForUser(established.userId)
    ).resolves.toEqual({ generation: 2, deliveryStatus: 'sent' });
  });

  it('allows reissue for a current Member with an inactive member Player', async () => {
    const established = await accountOnboardingService.establish(
      memberCommand('inactive-member-player-reissue', undefined, true)
    );
    await Player.updateOne(
      { userId: established.userId },
      { $set: { isActivePlayer: false } }
    );

    await expect(
      PasswordSetupDeliveryService.reissueForUser(established.userId)
    ).resolves.toEqual({ generation: 2, deliveryStatus: 'sent' });
  });

  it('rejects reissue after a supported source becomes an inactive unaffiliated person', async () => {
    const established = await accountOnboardingService.establish(
      memberCommand('unsupported-reissue-inactive')
    );
    await User.updateOne(
      { _id: established.userId },
      { $set: { membershipStatus: MembershipStatus.INACTIVE } }
    );

    await expect(
      PasswordSetupDeliveryService.reissueForUser(established.userId)
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(
      (await User.findById(established.userId))?.passwordSetupGeneration
    ).toBe(1);
  });

  it('rejects reissue for contradictory Member and External Player state', async () => {
    const established = await accountOnboardingService.establish(
      memberCommand('contradictory-reissue', undefined, true)
    );
    await Player.updateOne(
      { userId: established.userId },
      { $set: { type: PlayerType.EXTERNAL } }
    );

    await expect(
      PasswordSetupDeliveryService.reissueForUser(established.userId)
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(
      (await User.findById(established.userId))?.passwordSetupGeneration
    ).toBe(1);
  });

  it('returns a stable replay without another setup, lifecycle write, audit, or delivery', async () => {
    const command = memberCommand('direct-stable-replay');
    const first = await accountOnboardingService.establish(command);
    const replay = await accountOnboardingService.establish(command);

    expect(replay).toMatchObject({ ...first, replayed: true });
    expect(await AccountOnboardingOperation.countDocuments({})).toBe(1);
    expect(await MembershipLifecycleEvent.countDocuments({})).toBe(1);
    expect(await AuditLog.countDocuments({})).toBe(1);
    expect(EmailService.sendFromTemplate).toHaveBeenCalledOnce();
    expect((await User.findById(first.userId))?.passwordSetupGeneration).toBe(
      1
    );
  });

  it('rolls back the operation and identity when compatibility requires review', async () => {
    await User.create({
      ...identity('collision@example.test'),
      firstName: 'Existing',
      accountKind: AccountKind.PERSON,
      administratorDesignation: false,
      membershipStatus: MembershipStatus.ACTIVE,
      accountOnboardingStatus: AccountOnboardingStatus.READY,
      password: 'Test-Only-Password-1!',
    });

    await expect(
      accountOnboardingService.establish(
        memberCommand('direct-review-required', ' COLLISION@example.test ')
      )
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(await User.countDocuments({})).toBe(1);
    expect(await AccountOnboardingOperation.countDocuments({})).toBe(0);
    expect(await MembershipLifecycleEvent.countDocuments({})).toBe(0);
    expect(await AuditLog.countDocuments({})).toBe(0);
  });

  it('rejects the same key with different intent without duplicate writes', async () => {
    const first = memberCommand('direct-conflicting-intent');
    await accountOnboardingService.establish(first);
    await expect(
      accountOnboardingService.establish({
        ...first,
        initialMembershipStatus: MembershipStatus.PASSIVE,
      })
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(await User.countDocuments({})).toBe(1);
    expect(await AccountOnboardingOperation.countDocuments({})).toBe(1);
    expect(await MembershipLifecycleEvent.countDocuments({})).toBe(1);
    expect(await AuditLog.countDocuments({})).toBe(1);
  });

  it('binds the retained key to the immediate-delivery choice', async () => {
    const first = memberCommand(
      'direct-delivery-choice-conflict',
      undefined,
      false,
      MembershipStatus.ACTIVE,
      'de',
      false
    );
    await accountOnboardingService.establish(first);

    await expect(
      accountOnboardingService.establish({
        ...first,
        sendPasswordSetupEmailNow: true,
      })
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(await User.countDocuments({})).toBe(1);
    expect((await User.findOne())?.passwordSetupGeneration).toBe(0);
    expect(EmailService.sendFromTemplate).not.toHaveBeenCalled();
  });

  it('converges concurrent normalized-email commands without duplicate setup or lifecycle facts', async () => {
    const email = 'concurrent.member@example.test';
    const commands = [
      memberCommand(
        'direct-concurrent-first',
        `  ${email.toUpperCase()}  `,
        true,
        MembershipStatus.ACTIVE,
        'de',
        false
      ),
      memberCommand(
        'direct-concurrent-second',
        email,
        true,
        MembershipStatus.ACTIVE,
        'de',
        false
      ),
    ];

    const settled = await Promise.allSettled(
      commands.map((command) => accountOnboardingService.establish(command))
    );

    expect(settled.some((entry) => entry.status === 'fulfilled')).toBe(true);
    for (const entry of settled) {
      if (entry.status === 'rejected') {
        expect(entry.reason).toMatchObject({ statusCode: 409 });
      }
    }
    expect(await User.countDocuments({ email })).toBe(1);
    expect(await Player.countDocuments({})).toBe(1);
    expect((await User.findOne({ email }))?.passwordSetupGeneration).toBe(0);
    expect(await MembershipLifecycleEvent.countDocuments({})).toBe(2);
    expect(await AuditLog.countDocuments({})).toBe(2);
    expect(EmailService.sendFromTemplate).not.toHaveBeenCalled();
  });

  it('returns one stable result to concurrent same-key retries', async () => {
    const command = memberCommand(
      'direct-concurrent-same-key',
      'same-key@example.test',
      true
    );

    const results = await Promise.all([
      accountOnboardingService.establish(command),
      accountOnboardingService.establish(command),
    ]);

    expect(results[0]).toMatchObject({
      userId: results[1].userId,
      playerId: results[1].playerId,
      setupGeneration: 1,
    });
    expect(results[1]).toMatchObject({ setupGeneration: 1 });
    expect(await User.countDocuments({})).toBe(1);
    expect(await Player.countDocuments({})).toBe(1);
    expect(await AccountOnboardingOperation.countDocuments({})).toBe(1);
    expect(await MembershipLifecycleEvent.countDocuments({})).toBe(2);
    expect(await AuditLog.countDocuments({})).toBe(2);
    expect(EmailService.sendFromTemplate).toHaveBeenCalledOnce();
  });
});
