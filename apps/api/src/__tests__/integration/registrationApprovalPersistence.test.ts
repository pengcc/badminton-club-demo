import { randomUUID } from 'node:crypto';
import express from 'express';
import request from 'supertest';
import { FIRST_PARTY_ORIGIN } from '../helpers/authSession';
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
  Capability,
  Gender,
  MemberApplicationStatus,
  MembershipStatus,
  MembershipType,
  PlayerType,
  AccountKind,
} from '@club/shared-types/core/enums';
import { AccountOnboardingOperation } from '../../models/AccountOnboardingOperation';
import { AuditLog } from '../../models/AuditLog';
import { AuthSession } from '../../models/AuthSession';
import { MembershipApplication } from '../../models/MembershipApplication';
import { MemberBankingProfile } from '../../models/MemberBankingProfile';
import { MembershipLifecycleEvent } from '../../models/MembershipLifecycleEvent';
import { Player } from '../../models/Player';
import { RegistrationApprovalEvent } from '../../models/RegistrationApprovalEvent';
import { User } from '../../models/User';
import EmailService from '../../services/emailService';
import { RegistrationApprovalService } from '../../services/registrationApprovalService';
import authRoutes from '../../routes/auth';
import userRoutes from '../../routes/users';
import { errorHandler } from '../../middleware/errorHandler';
import { PasswordSetupService } from '../../services/passwordSetupService';
import { PasswordSetupDeliveryService } from '../../services/passwordSetupDeliveryService';
import { bankingCryptoService } from '../../services/bankingCryptoService';
import { MembershipApplicationDecisionDeliveryService } from '../../services/membershipApplicationDecisionDeliveryService';

let mongoLease: MongoTestDatabaseLease;
const actor = {
  id: new mongoose.Types.ObjectId().toString(),
  email: 'admin@example.test',
  accountKind: AccountKind.PERSON,
  administratorDesignation: true,
  displayName: 'Administrator',
  capabilities: [Capability.ADMINISTRATION],
};
const TEST_ONLY_PASSWORD = ['Test', 'Only', 'Password', '1!'].join('-');

function api() {
  const instance = express();
  instance.use(express.json());
  instance.use('/api/auth', authRoutes);
  instance.use('/api/users', userRoutes);
  instance.use(errorHandler);
  return instance;
}

async function application(
  email = `${randomUUID()}@example.test`,
  options: {
    banking?: boolean;
    applicationReceipt?: boolean;
    sepaReceipt?: boolean;
    communicationLocale?: 'de' | 'en' | 'zh';
  } = {}
) {
  const id = new mongoose.Types.ObjectId();
  const banking = {
    accountHolderType: 'same' as const,
    bankName: 'Approval Bank',
    iban: 'DE02120300000000202051',
    bic: 'BYLADEM1001',
    debitFrequency: 'quarterly' as const,
  };
  const hasBanking = options.banking !== false;
  return MembershipApplication.create({
    _id: id,
    verifiedEmail: email,
    personalInfo: {
      firstName: 'New',
      lastName: 'Member',
      email,
      phone: '+49123456789',
      dateOfBirth: '1990-01-01',
      gender: Gender.FEMALE,
      address: {
        street: 'Main 1',
        city: 'Trossingen',
        postalCode: '78647',
        country: 'DE',
      },
    },
    membershipType: MembershipType.REGULAR,
    encryptedBanking: hasBanking
      ? bankingCryptoService.encrypt(
          banking,
          'membership-application',
          id.toString()
        )
      : undefined,
    bankingSummary: hasBanking
      ? { present: true, complete: true, ibanLastFour: '2051' }
      : { present: false, complete: false },
    signedApplicationReceipt:
      options.applicationReceipt === false
        ? undefined
        : { receivedAt: new Date(), receivedBy: new mongoose.Types.ObjectId() },
    signedSepaReceipt:
      options.sepaReceipt === false
        ? undefined
        : { receivedAt: new Date(), receivedBy: new mongoose.Types.ObjectId() },
    status: MemberApplicationStatus.PENDING,
    communicationLocale: options.communicationLocale ?? 'de',
    submittedAt: new Date(),
    applicantDataUpdatedAt: new Date(),
  });
}

beforeAll(async () => {
  mongoLease = await acquireMongoTestDatabase('registrationApproval');
  mongoLease.assertOwnedDatabase();
  await User.syncIndexes();
  await Player.syncIndexes();
  await MembershipApplication.syncIndexes();
  await AuditLog.syncIndexes();
  await MembershipLifecycleEvent.syncIndexes();
  await RegistrationApprovalEvent.syncIndexes();
  await AccountOnboardingOperation.syncIndexes();
  await MemberBankingProfile.syncIndexes();
  await AuthSession.syncIndexes();
}, 120_000);

beforeEach(async () => {
  mongoLease.assertOwnedDatabase();
  await User.deleteMany({});
  await Player.deleteMany({});
  await MembershipApplication.deleteMany({});
  await AuditLog.deleteMany({});
  await MembershipLifecycleEvent.deleteMany({});
  await RegistrationApprovalEvent.deleteMany({});
  await AccountOnboardingOperation.deleteMany({});
  await MemberBankingProfile.deleteMany({});
  await AuthSession.deleteMany({});
  vi.restoreAllMocks();
  vi.spyOn(EmailService, 'sendFromTemplate').mockResolvedValue();
});

afterAll(async () => {
  await mongoLease.release();
});

describe('transactional registration approval persistence', () => {
  it('commits one active member identity, setup state, audits, and stable replay', async () => {
    const source = await application(undefined, { communicationLocale: 'zh' });
    const command = {
      applicationId: source._id.toString(),
      idempotencyKey: 'approval-happy-path',
      reviewNote: 'Internal',
      approvalMessage: 'Welcome',
      actor,
    };
    const first = await RegistrationApprovalService.approve(command);
    const replay = await RegistrationApprovalService.approve(command);

    expect(first).toMatchObject({
      replayed: false,
      setupGeneration: 1,
      deliveryStatus: 'sent',
      decisionDeliveryStatus: 'sent',
    });
    expect(replay).toMatchObject({ ...first, replayed: true });
    const user = await User.findById(first.userId).select(
      '+password +passwordSetupTokenDigest'
    );
    const player = await Player.findOne({ userId: first.userId });
    expect(user).toMatchObject({
      accountKind: AccountKind.PERSON,
      administratorDesignation: false,
      membershipStatus: MembershipStatus.ACTIVE,
      accountOnboardingStatus: AccountOnboardingStatus.PASSWORD_SETUP_PENDING,
      passwordSetupGeneration: 1,
      passwordSetupLocale: 'zh',
    });
    expect(user?.password).toBeUndefined();
    expect(user?.passwordSetupTokenDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(player).toBeNull();
    const approvedApplication = await MembershipApplication.findById(
      source._id
    );
    expect(approvedApplication).toMatchObject({
      status: MemberApplicationStatus.APPLICATION_APPROVED,
      approvedUserId: user?._id,
      reviewNote: 'Internal',
      approvalMessage: 'Welcome',
      decisionNotificationStatus: 'sent',
    });
    const bank = await MemberBankingProfile.findOne({ userId: user?._id });
    expect(bank).toBeTruthy();
    expect(
      bankingCryptoService.decrypt(
        bank!.encryptedBanking,
        'member-banking-profile',
        user!._id.toString()
      )
    ).toMatchObject({ iban: 'DE02120300000000202051' });
    expect(await RegistrationApprovalEvent.countDocuments({})).toBe(1);
    expect(await AccountOnboardingOperation.countDocuments({})).toBe(0);
    expect(await MembershipLifecycleEvent.countDocuments({})).toBe(1);
    expect(await AuditLog.countDocuments({})).toBe(2);
    expect(JSON.stringify(await AuditLog.find({}).lean())).not.toMatch(
      /DE02120300000000202051|Welcome|Internal/
    );
    expect(EmailService.sendFromTemplate).toHaveBeenCalledTimes(2);
    const approvalEmailVariables = vi
      .mocked(EmailService.sendFromTemplate)
      .mock.calls.find((call) => call[0] === 'application_approved')?.[3];
    expect(approvalEmailVariables).toMatchObject({
      approvalMessage: 'Welcome',
    });
    expect(approvalEmailVariables).not.toHaveProperty('reviewNote');
  });

  it.each([
    ['complete banking', { banking: false }, 'Complete banking information'],
    [
      'signed Membership Application',
      { applicationReceipt: false },
      'Signed Membership Application',
    ],
    ['signed SEPA mandate', { sepaReceipt: false }, 'Signed SEPA'],
  ])('enforces the %s approval gate inside the transaction', async (_gate, options, message) => {
    const source = await application(undefined, options);
    await expect(
      RegistrationApprovalService.approve({
        applicationId: source.id,
        idempotencyKey: `approval-gate-${_gate}`,
        actor,
      })
    ).rejects.toThrow(message);
    expect(await User.countDocuments({})).toBe(0);
    expect(await MemberBankingProfile.countDocuments({})).toBe(0);
    expect((await MembershipApplication.findById(source.id))?.status).toBe(
      MemberApplicationStatus.PENDING
    );
  });

  it.each([
    [
      'approval claim',
      () =>
        vi
          .spyOn(RegistrationApprovalEvent, 'create')
          .mockRejectedValueOnce(new Error('injected boundary failure')),
    ],
    [
      'User creation',
      () =>
        vi
          .spyOn(User, 'create')
          .mockRejectedValueOnce(new Error('injected boundary failure')),
    ],
    [
      'Member banking transfer',
      () =>
        vi
          .spyOn(MemberBankingProfile, 'create')
          .mockRejectedValueOnce(new Error('injected boundary failure')),
    ],
    [
      'setup issuance',
      () =>
        vi
          .spyOn(PasswordSetupService, 'issue')
          .mockRejectedValueOnce(new Error('injected boundary failure')),
    ],
    [
      'application approval write',
      () =>
        vi
          .spyOn(MembershipApplication.prototype, 'save')
          .mockRejectedValueOnce(new Error('injected boundary failure')),
    ],
    [
      'audit creation',
      () =>
        vi
          .spyOn(AuditLog, 'create')
          .mockRejectedValueOnce(new Error('injected boundary failure')),
    ],
    [
      'approval completion',
      () =>
        vi
          .spyOn(RegistrationApprovalEvent, 'updateOne')
          .mockRejectedValueOnce(new Error('injected boundary failure')),
    ],
  ])('rolls back the complete approval after failure at %s', async (_boundary, inject) => {
    const source = await application();
    inject();
    await expect(
      RegistrationApprovalService.approve({
        applicationId: source._id.toString(),
        idempotencyKey: `approval-rollback-${_boundary}`,
        actor,
      })
    ).rejects.toThrow(
      _boundary === 'audit creation'
        ? 'Required Audit persistence failed'
        : 'injected boundary failure'
    );
    expect(await User.countDocuments({})).toBe(0);
    expect(await Player.countDocuments({})).toBe(0);
    expect(await MemberBankingProfile.countDocuments({})).toBe(0);
    expect(await AuditLog.countDocuments({})).toBe(0);
    expect(await MembershipLifecycleEvent.countDocuments({})).toBe(0);
    expect(await RegistrationApprovalEvent.countDocuments({})).toBe(0);
    expect((await MembershipApplication.findById(source._id))?.status).toBe(
      MemberApplicationStatus.PENDING_REVIEW
    );
  });

  it('rejects replay intent/key conflicts without duplicate writes', async () => {
    const source = await application();
    await RegistrationApprovalService.approve({
      applicationId: source._id.toString(),
      idempotencyKey: 'approval-original-key',
      reviewNote: 'Original',
      actor,
    });
    await expect(
      RegistrationApprovalService.approve({
        applicationId: source._id.toString(),
        idempotencyKey: 'approval-original-key',
        reviewNote: 'Changed',
        actor,
      })
    ).rejects.toMatchObject({ statusCode: 409 });
    await expect(
      RegistrationApprovalService.approve({
        applicationId: source._id.toString(),
        idempotencyKey: 'approval-conflicting-key',
        reviewNote: 'Original',
        actor,
      })
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(await User.countDocuments({})).toBe(1);
    expect(await Player.countDocuments({})).toBe(0);
    expect(await RegistrationApprovalEvent.countDocuments({})).toBe(1);
    expect(await AuditLog.countDocuments({})).toBe(2);
  });

  it('allows only one concurrent approval to commit', async () => {
    const source = await application();
    const command = {
      applicationId: source._id.toString(),
      idempotencyKey: 'approval-concurrent',
      actor,
    };
    const settled = await Promise.allSettled([
      RegistrationApprovalService.approve(command),
      RegistrationApprovalService.approve(command),
    ]);
    expect(settled.some((entry) => entry.status === 'fulfilled')).toBe(true);
    expect(await User.countDocuments({})).toBe(1);
    expect(await Player.countDocuments({})).toBe(0);
    expect(await RegistrationApprovalEvent.countDocuments({})).toBe(1);
    expect(await MembershipLifecycleEvent.countDocuments({})).toBe(1);
    expect(await AuditLog.countDocuments({})).toBe(2);
  });

  it('keeps approval committed and marks an ambiguous SMTP outcome uncertain', async () => {
    const source = await application();
    vi.mocked(EmailService.sendFromTemplate).mockRejectedValueOnce(
      new Error('smtp unavailable')
    );
    const result = await RegistrationApprovalService.approve({
      applicationId: source._id.toString(),
      idempotencyKey: 'approval-mail-failure',
      actor,
    });
    expect(result.deliveryStatus).toBe('uncertain');
    expect((await User.findById(result.userId))?.membershipStatus).toBe(
      MembershipStatus.ACTIVE
    );
    expect((await MembershipApplication.findById(source._id))?.status).toBe(
      MemberApplicationStatus.APPLICATION_APPROVED
    );
  });

  it('keeps approval committed when the separate decision email fails and supports retry', async () => {
    const source = await application();
    vi.mocked(EmailService.sendFromTemplate)
      .mockResolvedValueOnce()
      .mockRejectedValueOnce(
        Object.assign(new Error('rejected'), { code: 'EMESSAGE' })
      );
    const result = await RegistrationApprovalService.approve({
      applicationId: source.id,
      idempotencyKey: 'approval-decision-mail-failure',
      actor,
    });
    expect(result.decisionDeliveryStatus).toBe('failed');
    expect((await MembershipApplication.findById(source.id))?.status).toBe(
      MemberApplicationStatus.APPROVED
    );
    vi.mocked(EmailService.sendFromTemplate).mockResolvedValueOnce();
    await expect(
      MembershipApplicationDecisionDeliveryService.deliver(source.id)
    ).resolves.toBe('sent');
    expect(
      (await MembershipApplication.findById(source.id))
        ?.decisionNotificationStatus
    ).toBe('sent');
    const approvalCall = vi
      .mocked(EmailService.sendFromTemplate)
      .mock.calls.slice()
      .reverse()
      .find(([template]) => template === 'application_approved');
    expect(approvalCall?.[3].setupGuidance).toBe(
      'Eine separate E-Mail zur Einrichtung deines Kontozugangs folgt.'
    );
  });

  it('reissue rotates the setup generation, invalidates the old token, and delivers only the new token', async () => {
    await User.create({
      _id: actor.id,
      email: actor.email,
      firstName: 'Admin',
      lastName: 'User',
      password: TEST_ONLY_PASSWORD,
      gender: Gender.FEMALE,
      dateOfBirth: '1980-01-01',
      accountKind: AccountKind.PERSON,
      administratorDesignation: true,
      displayName: 'Administrator',
      capabilities: [Capability.ADMINISTRATION],
      membershipStatus: MembershipStatus.ACTIVE,
    });
    const source = await application(undefined, { communicationLocale: 'en' });
    const approved = await RegistrationApprovalService.approve({
      applicationId: source._id.toString(),
      idempotencyKey: 'approval-for-reissue',
      actor,
    });
    const oldLink = vi.mocked(EmailService.sendFromTemplate).mock.calls[0][3]
      .resetLink as string;
    const oldToken = new URL(oldLink).searchParams.get('token')!;
    await MembershipApplication.findByIdAndDelete(source.id);
    const reissued = await PasswordSetupDeliveryService.reissueForApplication(
      source._id.toString()
    );
    const newLink = vi.mocked(EmailService.sendFromTemplate).mock.calls[2][3]
      .resetLink as string;
    const newToken = new URL(newLink).searchParams.get('token')!;
    expect(reissued).toEqual({
      generation: approved.setupGeneration + 1,
      deliveryStatus: 'sent',
    });
    expect((await User.findById(approved.userId))?.passwordSetupLocale).toBe(
      'en'
    );
    expect(newToken).not.toBe(oldToken);
    await expect(
      PasswordSetupService.consume(oldToken, TEST_ONLY_PASSWORD)
    ).rejects.toThrow('invalid or expired');
    await expect(
      PasswordSetupService.consume(newToken, TEST_ONLY_PASSWORD)
    ).resolves.toBeUndefined();
    expect(
      (await User.findById(approved.userId))?.accountOnboardingStatus
    ).toBe(AccountOnboardingStatus.READY);
    await expect(
      PasswordSetupDeliveryService.reissueForApplication(source._id.toString())
    ).rejects.toMatchObject({ statusCode: 409 });

    const memberLogin = await request(api())
      .post('/api/auth/login')
      .set('Origin', FIRST_PARTY_ORIGIN)
      .send({ email: source.verifiedEmail, password: TEST_ONLY_PASSWORD });
    expect(memberLogin.status).toBe(200);
    expect(memberLogin.body.user.capabilities).toEqual(
      expect.arrayContaining([
        Capability.AUTHENTICATED_ACCOUNT,
        Capability.CURRENT_MEMBER,
      ])
    );
    expect(memberLogin.body.user.capabilities).not.toContain(
      Capability.ACTIVE_PLAYER
    );
    const adminLogin = await request(api())
      .post('/api/auth/login')
      .set('Origin', FIRST_PARTY_ORIGIN)
      .send({ email: actor.email, password: TEST_ONLY_PASSWORD });
    const adminCookie = String(adminLogin.headers['set-cookie']?.[0]).split(
      ';'
    )[0];
    const memberList = await request(api())
      .get(
        `/api/users/filter?filter=current&search=${encodeURIComponent(source.verifiedEmail)}`
      )
      .set('Cookie', adminCookie);
    expect(memberList.status).toBe(200);
    expect(memberList.body.items).toEqual([
      expect.objectContaining({
        id: approved.userId,
        membershipStatus: MembershipStatus.ACTIVE,
      }),
    ]);
  });

  it('reuses a compatible existing Member without creating or discarding a Player', async () => {
    const source = await application('existing@example.test');
    const existing = await User.create({
      email: 'existing@example.test',
      firstName: 'New',
      lastName: 'Member',
      password: TEST_ONLY_PASSWORD,
      gender: Gender.FEMALE,
      dateOfBirth: '1990-01-01',
      accountKind: AccountKind.PERSON,
      administratorDesignation: false,
      displayName: 'Member',
      capabilities: [Capability.AUTHENTICATED_ACCOUNT],
      membershipStatus: MembershipStatus.ACTIVE,
      membershipType: MembershipType.REGULAR,
    });
    const approved = await RegistrationApprovalService.approve({
      applicationId: source._id.toString(),
      idempotencyKey: 'approval-existing',
      actor,
    });
    expect(approved).toMatchObject({
      userId: existing.id,
      setupRequired: false,
      deliveryStatus: 'sent',
    });
    expect(approved.playerId).toBeUndefined();
    expect(await User.countDocuments({})).toBe(1);
    expect(await Player.countDocuments({})).toBe(0);
    expect(await RegistrationApprovalEvent.countDocuments({})).toBe(1);
    expect((await MembershipApplication.findById(source._id))?.status).toBe(
      MemberApplicationStatus.APPROVED
    );
  });
});
