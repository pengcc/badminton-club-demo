import { randomUUID } from 'node:crypto';
import express from 'express';
import request from 'supertest';
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
  AccountKind,
  AccountOnboardingStatus,
  Capability,
} from '@club/shared-types/core/enums';
import { AuthSession } from '../../models/AuthSession';
import { User } from '../../models/User';
import authRoutes from '../../routes/auth';
import { AuthSessionService } from '../../services/authSessionService';
import EmailService from '../../services/emailService';
import { PasswordSetupService } from '../../services/passwordSetupService';
import { SuperAdminService } from '../../services/superAdminService';
import { FIRST_PARTY_ORIGIN } from '../helpers/authSession';

let mongoLease: MongoTestDatabaseLease;
const operationalEmail = 'canonical-operator@example.test';
const testInitialCredential = `${randomUUID()}-Aa1!`;
const testReplacementCredential = `${randomUUID()}-Bb2!`;

function api() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  return app;
}

function deliveredSetupToken(): string {
  const resetLink = vi
    .mocked(EmailService.sendFromTemplate)
    .mock.calls.at(-1)?.[3].resetLink as string | undefined;
  if (!resetLink) throw new Error('Expected password setup delivery');
  const token = new URL(resetLink).searchParams.get('token');
  if (!token) throw new Error('Expected password setup token in delivery');
  return token;
}

beforeAll(async () => {
  mongoLease = await acquireMongoTestDatabase('superAdmin');
  mongoLease.assertOwnedDatabase();
  await User.syncIndexes();
  await AuthSession.syncIndexes();
}, 120_000);

beforeEach(async () => {
  mongoLease.assertOwnedDatabase();
  await AuthSession.deleteMany({});
  await User.deleteMany({});
  vi.restoreAllMocks();
  vi.spyOn(EmailService, 'sendFromTemplate').mockResolvedValue();
});

afterAll(async () => {
  await mongoLease.release();
});

describe('Super Admin persisted bootstrap and recovery', () => {
  it('keeps one principal while rotating setup and session generations across recovery', async () => {
    const bootstrap = await SuperAdminService.bootstrap(operationalEmail);
    const initialToken = deliveredSetupToken();
    expect(JSON.stringify(bootstrap)).not.toContain(initialToken);

    const created = await User.findById(bootstrap.userId).lean();
    expect(created).toMatchObject({
      email: operationalEmail,
      accountKind: AccountKind.SUPER_ADMIN,
      administratorDesignation: false,
      isPlayer: false,
      accountOnboardingStatus: AccountOnboardingStatus.PASSWORD_SETUP_PENDING,
    });
    expect(created).not.toHaveProperty('firstName');
    expect(created).not.toHaveProperty('membershipStatus');

    await PasswordSetupService.consume(initialToken, testInitialCredential);
    const firstLogin = await request(api())
      .post('/api/auth/login')
      .set('Origin', FIRST_PARTY_ORIGIN)
      .send({ email: operationalEmail, password: testInitialCredential });
    expect(firstLogin.status).toBe(200);
    expect(firstLogin.body.user).toMatchObject({
      id: bootstrap.userId,
      accountKind: AccountKind.SUPER_ADMIN,
      fullName: 'Super Admin',
      capabilities: expect.arrayContaining([
        Capability.AUTHENTICATED_ACCOUNT,
        Capability.ADMINISTRATION,
      ]),
    });
    const firstCookie = String(firstLogin.headers['set-cookie']?.[0]).split(
      ';'
    )[0];
    await expect(
      AuthSessionService.resolve(firstCookie)
    ).resolves.toMatchObject({
      kind: 'valid',
    });
    expect(
      (await request(api()).get('/api/auth/verify').set('Cookie', firstCookie))
        .status
    ).toBe(200);

    const recovery = await SuperAdminService.recover(operationalEmail);
    const replacementToken = deliveredSetupToken();
    expect(recovery.userId).toBe(bootstrap.userId);
    expect(replacementToken).not.toBe(initialToken);
    expect(
      await User.countDocuments({ accountKind: AccountKind.SUPER_ADMIN })
    ).toBe(1);
    expect(
      (await request(api()).get('/api/auth/verify').set('Cookie', firstCookie))
        .status
    ).toBe(401);
    await expect(
      PasswordSetupService.consume(initialToken, testReplacementCredential)
    ).rejects.toThrow('invalid or expired');

    await PasswordSetupService.consume(
      replacementToken,
      testReplacementCredential
    );
    const replacementLogin = await request(api())
      .post('/api/auth/login')
      .set('Origin', FIRST_PARTY_ORIGIN)
      .send({ email: operationalEmail, password: testReplacementCredential });
    expect(replacementLogin.status).toBe(200);
    expect(replacementLogin.body.user.id).toBe(bootstrap.userId);
    expect(
      (await User.findById(bootstrap.userId))?.accountOnboardingStatus
    ).toBe(AccountOnboardingStatus.READY);
  });
});
