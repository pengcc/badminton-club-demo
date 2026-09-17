import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import express from 'express';
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
  AccountOnboardingStatus,
  Gender,
  MembershipStatus,
} from '@club/shared-types/core/enums';
import {
  acquireMongoTestDatabase,
  type MongoTestDatabaseLease,
} from '../infrastructure/mongoTestDatabase';
import { AuthSession } from '../../models/AuthSession';
import { Player } from '../../models/Player';
import { User } from '../../models/User';
import { config } from '../../config';
import { errorHandler } from '../../middleware/errorHandler';
import usersRoutes from '../../routes/users';
import { AuthSessionService } from '../../services/authSessionService';
import EmailService from '../../services/emailService';
import {
  PasswordRecoveryService,
  PASSWORD_RECOVERY_TTL_MS,
} from '../../services/passwordRecoveryService';
import { PasswordSetupService } from '../../services/passwordSetupService';

let mongoLease: MongoTestDatabaseLease;

async function createReadyMember() {
  return User.create({
    email: `${randomUUID()}@example.test`,
    firstName: 'Recovery',
    lastName: 'Member',
    gender: Gender.NON_BINARY,
    dateOfBirth: '1990-01-01',
    accountKind: AccountKind.PERSON,
    administratorDesignation: false,
    membershipStatus: MembershipStatus.ACTIVE,
    accountOnboardingStatus: AccountOnboardingStatus.READY,
    isPlayer: false,
    password: 'TestPassword1!',
  });
}

function tokenFromLatestDelivery(): string {
  const call = vi.mocked(EmailService.sendFromTemplate).mock.calls.at(-1);
  const resetLink = (call?.[3] as { resetLink?: string } | undefined)
    ?.resetLink;
  if (!resetLink) throw new Error('Expected recovery reset link');
  return new URLSearchParams(resetLink.split('#')[1]).get('token') ?? '';
}

function usersApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/users', usersRoutes);
  app.use(errorHandler);
  return app;
}

beforeAll(async () => {
  mongoLease = await acquireMongoTestDatabase('passwordRecovery');
  mongoLease.assertOwnedDatabase();
  await User.syncIndexes();
  await Player.syncIndexes();
  await AuthSession.syncIndexes();
}, 120_000);

beforeEach(async () => {
  mongoLease.assertOwnedDatabase();
  vi.restoreAllMocks();
  await AuthSession.deleteMany({});
  await Player.deleteMany({});
  await User.deleteMany({});
  vi.spyOn(EmailService, 'sendFromTemplate').mockResolvedValue(undefined);
});

afterAll(async () => {
  await mongoLease.release();
});

describe('password recovery persistence', () => {
  it('protects the administrator recovery route and returns a bounded delivery result', async () => {
    const target = await createReadyMember();
    const administrator = await User.create({
      email: `${randomUUID()}@example.test`,
      firstName: 'Recovery',
      lastName: 'Administrator',
      gender: Gender.NON_BINARY,
      dateOfBirth: '1990-01-01',
      accountKind: AccountKind.PERSON,
      administratorDesignation: true,
      membershipStatus: MembershipStatus.ACTIVE,
      accountOnboardingStatus: AccountOnboardingStatus.READY,
      isPlayer: false,
      password: 'TestPassword1!',
    });
    const session = await AuthSessionService.create(administrator.id, 0);
    const issue = vi
      .spyOn(PasswordRecoveryService, 'requestForUser')
      .mockResolvedValue('sent');

    const unauthenticated = await request(usersApp())
      .post(`/api/users/${target.id}/password-recovery`)
      .set('Origin', config.frontendUrl)
      .send({ locale: 'zh' });
    const authenticated = await request(usersApp())
      .post(`/api/users/${target.id}/password-recovery`)
      .set('Origin', config.frontendUrl)
      .set('Cookie', `club_session=${session.token}`)
      .send({ locale: 'zh' });

    expect(unauthenticated.status).toBe(401);
    expect(authenticated.status).toBe(200);
    expect(authenticated.body).toEqual({
      success: true,
      data: { deliveryStatus: 'sent' },
    });
    expect(issue).toHaveBeenCalledWith(target.id, 'zh');
  });

  it('stores only a one-hour digest, targets canonical email, and makes the newest link current', async () => {
    const user = await createReadyMember();
    await User.updateOne(
      { _id: user._id },
      { $set: { pendingEmail: 'pending@example.test' } }
    );

    await PasswordRecoveryService.requestByEmail(
      user.email.toUpperCase(),
      'en'
    );
    const firstToken = tokenFromLatestDelivery();
    const firstRecord = await User.findById(user._id)
      .select('+passwordRecoveryTokenDigest')
      .lean();
    expect(firstRecord?.passwordRecoveryTokenDigest).toBe(
      PasswordRecoveryService.digest(firstToken)
    );
    expect(JSON.stringify(firstRecord)).not.toContain(firstToken);
    expect(firstRecord?.passwordRecoveryExpiresAt?.getTime()).toBeGreaterThan(
      Date.now() + PASSWORD_RECOVERY_TTL_MS - 10_000
    );
    expect(
      vi.mocked(EmailService.sendFromTemplate).mock.calls.at(-1)?.[1]
    ).toBe(user.email);

    await PasswordRecoveryService.requestForUser(user.id, 'zh');
    const secondToken = tokenFromLatestDelivery();
    expect(secondToken).not.toBe(firstToken);
    await expect(PasswordRecoveryService.status(firstToken)).resolves.toBe(
      false
    );
    await expect(PasswordRecoveryService.status(secondToken)).resolves.toBe(
      true
    );
  });

  it('permits at most one concurrent reset, revokes old sessions, and returns to normal password login', async () => {
    const user = await createReadyMember();
    const oldSession = await AuthSessionService.create(user.id, 0);
    await PasswordRecoveryService.requestForUser(user.id, 'de');
    const credential = tokenFromLatestDelivery();

    const results = await Promise.allSettled([
      PasswordRecoveryService.consume(credential, 'NewPassword1!'),
      PasswordRecoveryService.consume(credential, 'OtherPassword1!'),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled')
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === 'rejected')
    ).toHaveLength(1);

    const updated = await User.findById(user._id)
      .select('+password +authSessionGeneration +passwordRecoveryTokenDigest')
      .lean();
    expect(updated?.authSessionGeneration).toBe(1);
    expect(updated?.passwordRecoveryTokenDigest).toBeUndefined();
    expect(updated?.passwordRecoveryExpiresAt).toBeUndefined();
    expect(await AuthSession.countDocuments({ userId: user._id })).toBe(0);
    await expect(
      AuthSessionService.resolve(`club_session=${oldSession.token}`)
    ).resolves.toEqual({ kind: 'invalid' });
    const accepted =
      (await bcrypt.compare('NewPassword1!', updated?.password ?? '')) ||
      (await bcrypt.compare('OtherPassword1!', updated?.password ?? ''));
    expect(accepted).toBe(true);
    await expect(PasswordRecoveryService.status(credential)).resolves.toBe(
      false
    );
  });

  it('rejects status and consume after eligibility is lost', async () => {
    const user = await createReadyMember();
    await PasswordRecoveryService.requestForUser(user.id, 'de');
    const credential = tokenFromLatestDelivery();
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          accountSuspension: {
            reason: 'Test',
            suspendedAt: new Date(),
            suspendedBy: user._id,
          },
        },
      }
    );
    await expect(PasswordRecoveryService.status(credential)).resolves.toBe(
      false
    );
    await expect(
      PasswordRecoveryService.consume(credential, 'NewPassword1!')
    ).rejects.toThrow('invalid or expired');
    expect(
      await bcrypt.compare(
        'TestPassword1!',
        (await User.findById(user._id).select('+password').lean())?.password ??
          ''
      )
    ).toBe(true);
  });

  it('keeps the real setup credential single-use through persistence', async () => {
    const pending = await User.create({
      email: `${randomUUID()}@example.test`,
      firstName: 'Setup',
      lastName: 'Member',
      gender: Gender.NON_BINARY,
      dateOfBirth: '1990-01-01',
      accountKind: AccountKind.PERSON,
      administratorDesignation: false,
      membershipStatus: MembershipStatus.ACTIVE,
      accountOnboardingStatus: AccountOnboardingStatus.PASSWORD_SETUP_PENDING,
      isPlayer: false,
    });
    const issued = await PasswordSetupService.issue(pending.id);
    await PasswordSetupService.consume(issued.token, 'FirstPassword1!');
    await expect(
      PasswordSetupService.consume(issued.token, 'SecondPassword1!')
    ).rejects.toThrow('invalid or expired');
    const stored = await User.findById(pending._id).select('+password').lean();
    await expect(
      bcrypt.compare('FirstPassword1!', stored?.password ?? '')
    ).resolves.toBe(true);
    await expect(
      bcrypt.compare('SecondPassword1!', stored?.password ?? '')
    ).resolves.toBe(false);
  });
});
