import { randomUUID } from 'node:crypto';
import {
  acquireMongoTestDatabase,
  type MongoTestDatabaseLease,
} from '../infrastructure/mongoTestDatabase';
import bcrypt from 'bcryptjs';
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
  AccountOnboardingStatus,
  Capability,
  Gender,
  MembershipStatus,
  PlayerType,
  AccountKind,
} from '@club/shared-types/core/enums';
import { AuthSession } from '../../models/AuthSession';
import { AuditLog } from '../../models/AuditLog';
import { Player } from '../../models/Player';
import { User } from '../../models/User';
import { UserController } from '../../controllers/userController';
import { AuditService } from '../../services/auditService';
import { AuthSessionService } from '../../services/authSessionService';
import { AccountAccessService } from '../../services/accountAccessService';
import { PasswordChangeService } from '../../services/passwordChangeService';
import {
  digestEmailChangeToken,
  UserService,
} from '../../services/userService';
import { migrateLegacyEmailChangeTokens } from '../../services/emailChangeTokenMigration';
import authRoutes from '../../routes/auth';
import { errorHandler } from '../../middleware/errorHandler';
import { config } from '../../config';

let mongoLease: MongoTestDatabaseLease;

async function createUser(
  password = 'TestPassword1!',
  email = `${randomUUID()}@example.test`
) {
  return User.create({
    email,
    firstName: 'Session',
    lastName: 'Tester',
    gender: Gender.NON_BINARY,
    dateOfBirth: '1990-01-01',
    accountKind: AccountKind.PERSON,
    administratorDesignation: false,
    displayName: 'Member',
    capabilities: [Capability.AUTHENTICATED_ACCOUNT],
    membershipStatus: MembershipStatus.ACTIVE,
    accountOnboardingStatus: AccountOnboardingStatus.READY,
    isPlayer: false,
    password,
  });
}

function authApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use(errorHandler);
  return app;
}

function loginThroughBoundary(
  app: ReturnType<typeof authApp>,
  email: string,
  password: string
) {
  return request(app)
    .post('/api/auth/login')
    .set('Origin', config.frontendUrl)
    .send({ email, password });
}

beforeAll(async () => {
  mongoLease = await acquireMongoTestDatabase('authSessionSecurity');
  mongoLease.assertOwnedDatabase();
  await User.syncIndexes();
  await AuthSession.syncIndexes();
  await Player.syncIndexes();
  await AuditLog.syncIndexes();
}, 120_000);

beforeEach(async () => {
  mongoLease.assertOwnedDatabase();
  vi.restoreAllMocks();
  mongoLease.assertOwnedDatabase();
  await AuthSession.deleteMany({});
  await AuditLog.deleteMany({});
  await Player.deleteMany({});
  await User.deleteMany({});
  vi.spyOn(AuditService, 'writeBestEffort').mockReturnValue(undefined);
});

afterAll(async () => {
  await mongoLease.release();
});

describe('auth session security persistence', () => {
  function controllerResponse() {
    const response = {
      status: vi.fn(),
      json: vi.fn(),
      clearCookie: vi.fn(),
    };
    response.status.mockReturnValue(response);
    return response;
  }

  function adminRequest(body: Record<string, unknown>, userId?: string) {
    return {
      body,
      params: userId ? { id: userId } : {},
      user: {
        id: new mongoose.Types.ObjectId().toString(),
        email: 'admin@example.test',
        accountKind: AccountKind.PERSON,
        displayName: 'Administrator',
        capabilities: [Capability.ADMINISTRATION],
        firstName: 'Admin',
        lastName: 'User',
      },
      ip: '127.0.0.1',
      get: vi.fn().mockReturnValue('test-agent'),
    };
  }

  async function userWithExistingGeneration() {
    const user = await createUser();
    await User.collection.updateOne(
      { _id: user._id },
      { $set: { authSessionGeneration: 1 } }
    );
    const session = await AuthSessionService.create(user.id, 1);
    return { user, session };
  }

  it('stores only the digest for a fresh valid session', async () => {
    const user = await createUser();
    const issued = await AuthSessionService.create(user.id, 0);
    const persisted = await AuthSession.findOne({ userId: user._id })
      .select('+tokenDigest')
      .lean();

    expect(persisted?.tokenDigest).toBe(
      AuthSessionService.digest(issued.token)
    );
    expect(persisted?.tokenDigest).not.toBe(issued.token);
    await expect(
      AuthSessionService.resolve(`club_session=${issued.token}`)
    ).resolves.toMatchObject({
      kind: 'valid',
      session: { userId: user.id, authSessionGeneration: 0 },
    });
  });

  it('recovers from reset-equivalent stale browser state without cookie cleanup', async () => {
    const user = await createUser();
    const stale = await AuthSessionService.create(user.id, 0);
    mongoLease.assertOwnedDatabase();
    await AuthSession.deleteMany({});

    const replacement = await AuthSessionService.create(user.id, 0);

    await expect(
      AuthSessionService.resolve(`club_session=${stale.token}`)
    ).resolves.toEqual({ kind: 'invalid' });
    await expect(
      AuthSessionService.resolve(`club_session=${replacement.token}`)
    ).resolves.toMatchObject({ kind: 'valid' });
  });

  it('supports logout followed by re-login while rejecting the ended credential', async () => {
    const user = await createUser();
    const ended = await AuthSessionService.create(user.id, 0);

    await AuthSessionService.invalidatePresented(`club_session=${ended.token}`);
    const replacement = await AuthSessionService.create(user.id, 0);

    await expect(
      AuthSessionService.resolve(`club_session=${ended.token}`)
    ).resolves.toEqual({ kind: 'invalid' });
    await expect(
      AuthSessionService.resolve(`club_session=${replacement.token}`)
    ).resolves.toMatchObject({ kind: 'valid' });
  });

  it('does not issue a session for noncanonical persisted User state', async () => {
    const user = await createUser();
    mongoLease.assertOwnedDatabase();
    await User.collection.updateOne(
      { _id: user._id },
      { $set: { accountKind: 'legacy' } }
    );

    const response = await loginThroughBoundary(
      authApp(),
      user.email,
      'TestPassword1!'
    );

    expect(response.status).toBe(500);
    expect(response.headers['set-cookie']).toBeUndefined();
    expect(await AuthSession.countDocuments({ userId: user._id })).toBe(0);
  });

  it('keeps independent sessions valid when only the presented session ends', async () => {
    const user = await createUser();
    const first = await AuthSessionService.create(user.id, 0);
    const second = await AuthSessionService.create(user.id, 0);

    await AuthSessionService.invalidatePresented(`club_session=${first.token}`);

    await expect(
      AuthSessionService.resolve(`club_session=${first.token}`)
    ).resolves.toEqual({ kind: 'invalid' });
    await expect(
      AuthSessionService.resolve(`club_session=${second.token}`)
    ).resolves.toMatchObject({ kind: 'valid' });
  });

  it('applies administrator designation to existing sessions through current persisted state', async () => {
    const { user, session } = await userWithExistingGeneration();
    const next = vi.fn();

    await UserController.setAdministratorDesignation(
      adminRequest({ designated: true }, user.id) as never,
      controllerResponse() as never,
      next
    );

    expect(next).not.toHaveBeenCalled();
    expect(
      (await User.findById(user.id).select('+authSessionGeneration'))
        ?.authSessionGeneration
    ).toBe(1);
    expect((await User.findById(user.id))?.administratorDesignation).toBe(true);
    await expect(
      AuthSessionService.resolve(`club_session=${session.token}`)
    ).resolves.toMatchObject({ kind: 'valid' });
  });

  it('revokes every session and accepts only the new password through Login', async () => {
    const user = await createUser();
    const app = authApp();
    const first = request.agent(app);
    const second = request.agent(app);
    expect(
      (
        await first
          .post('/api/auth/login')
          .set('Origin', config.frontendUrl)
          .send({ email: user.email, password: 'TestPassword1!' })
      ).status
    ).toBe(200);
    expect(
      (
        await second
          .post('/api/auth/login')
          .set('Origin', config.frontendUrl)
          .send({ email: user.email, password: 'TestPassword1!' })
      ).status
    ).toBe(200);

    const changeResponse = await first
      .patch('/api/auth/password')
      .set('Origin', config.frontendUrl)
      .send({
        currentPassword: 'TestPassword1!',
        newPassword: 'TestPassword2!',
      });

    const persisted = await User.findById(user.id).select(
      '+password +authSessionGeneration'
    );
    expect(changeResponse.status).toBe(200);
    expect(changeResponse.headers['set-cookie']).toBeUndefined();
    expect(persisted?.authSessionGeneration).toBe(1);
    expect(
      await bcrypt.compare('TestPassword2!', persisted?.password ?? '')
    ).toBe(true);
    expect(await AuthSession.countDocuments({ userId: user._id })).toBe(0);
    expect((await first.get('/api/auth/verify')).status).toBe(401);
    expect((await second.get('/api/auth/verify')).status).toBe(401);
    expect(
      (await loginThroughBoundary(app, user.email, 'TestPassword1!')).status
    ).toBe(401);

    const fresh = request.agent(app);
    expect(
      (
        await fresh
          .post('/api/auth/login')
          .set('Origin', config.frontendUrl)
          .send({ email: user.email, password: 'TestPassword2!' })
      ).status
    ).toBe(200);
    expect((await fresh.get('/api/auth/verify')).status).toBe(200);
    expect(await AuthSession.countDocuments({ userId: user._id })).toBe(1);
  });

  it('permits only one concurrent change using the same current password', async () => {
    const user = await createUser();
    await AuthSessionService.create(user.id, 0);

    const results = await Promise.allSettled([
      PasswordChangeService.change({
        userId: user.id,
        currentPassword: 'TestPassword1!',
        newPassword: 'TestPassword2!',
      }),
      PasswordChangeService.change({
        userId: user.id,
        currentPassword: 'TestPassword1!',
        newPassword: 'TestPassword3!',
      }),
    ]);

    expect(
      results.filter((result) => result.status === 'fulfilled')
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === 'rejected')
    ).toHaveLength(1);
    expect(
      (await User.findById(user.id).select('+authSessionGeneration'))
        ?.authSessionGeneration
    ).toBe(1);
    expect(await AuthSession.countDocuments({ userId: user._id })).toBe(0);
  });

  it('suspends Account access without changing Membership or Player state and revokes sessions', async () => {
    const user = await createUser();
    user.administratorDesignation = true;
    await user.save();
    const teamId = new mongoose.Types.ObjectId();
    const player = await Player.create({
      userId: user._id,
      type: PlayerType.MEMBER,
      singlesRanking: 321,
      doublesRanking: 654,
      isActivePlayer: true,
      teamIds: [teamId],
    });
    const session = await AuthSessionService.create(user.id, 0);
    const actor = {
      id: new mongoose.Types.ObjectId().toString(),
      email: 'admin@example.test',
      accountKind: AccountKind.PERSON,
      displayName: 'Administrator',
      capabilities: [Capability.ADMINISTRATION],
    };

    await AccountAccessService.suspend({
      userId: user.id,
      actor,
      reason: 'Temporary access review',
      occurredAt: new Date('2026-07-13T12:00:00.000Z'),
    });

    const suspended = await User.findById(user.id).select(
      '+authSessionGeneration'
    );
    const retainedPlayer = await Player.findById(player.id);
    expect(suspended).toMatchObject({
      membershipStatus: MembershipStatus.ACTIVE,
      administratorDesignation: true,
      authSessionGeneration: 1,
      accountSuspension: {
        reason: 'Temporary access review',
        suspendedAt: new Date('2026-07-13T12:00:00.000Z'),
      },
    });
    expect(retainedPlayer).toMatchObject({
      type: PlayerType.MEMBER,
      singlesRanking: 321,
      doublesRanking: 654,
      isActivePlayer: true,
    });
    expect(retainedPlayer?.teamIds.map(String)).toEqual([teamId.toString()]);
    expect(await AuthSession.countDocuments({ userId: user._id })).toBe(0);
    await expect(
      AuthSessionService.resolve(`club_session=${session.token}`)
    ).resolves.toEqual({ kind: 'invalid' });

    await AccountAccessService.unsuspend({ userId: user.id, actor });
    const unsuspended = await User.findById(user.id).select(
      '+authSessionGeneration'
    );
    expect(unsuspended?.accountSuspension).toBeUndefined();
    expect(unsuspended).toMatchObject({
      membershipStatus: MembershipStatus.ACTIVE,
      administratorDesignation: true,
      authSessionGeneration: 1,
    });
    expect(await AuthSession.countDocuments({ userId: user._id })).toBe(0);

    const replacement = await AuthSessionService.create(user.id, 1);
    await expect(
      AuthSessionService.resolve(`club_session=${session.token}`)
    ).resolves.toEqual({ kind: 'invalid' });
    await expect(
      AuthSessionService.resolve(`club_session=${replacement.token}`)
    ).resolves.toMatchObject({
      kind: 'valid',
      session: { authSessionGeneration: 1 },
    });
  });

  it('rejects Account suspension for the canonical Super Admin', async () => {
    const principal = await User.create({
      email: 'operator@example.test',
      accountKind: AccountKind.SUPER_ADMIN,
      accountOnboardingStatus: AccountOnboardingStatus.READY,
      password: 'TestPassword1!',
    });

    await expect(
      AccountAccessService.suspend({
        userId: principal.id,
        actor: {
          id: new mongoose.Types.ObjectId().toString(),
          accountKind: AccountKind.PERSON,
        },
        reason: 'Must remain reachable',
      })
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(
      (await User.findById(principal.id))?.accountSuspension
    ).toBeUndefined();
  });
});

describe('email-change credential persistence', () => {
  it('stores only a digest and atomically permits one successful consume', async () => {
    const user = await createUser();
    const token = await UserService.requestEmailChange(
      user.id,
      'new-address@example.test',
      'en'
    );
    const raw = await User.collection.findOne({ _id: user._id });
    expect(raw?.emailChangeToken).toBeUndefined();
    expect(raw?.emailChangeTokenDigest).toBe(digestEmailChangeToken(token));
    expect(raw?.emailChangeTokenDigest).not.toBe(token);
    expect(raw?.pendingEmailLocale).toBe('en');

    const results = await Promise.allSettled([
      UserService.verifyEmailChange(token),
      UserService.verifyEmailChange(token),
    ]);

    expect(
      results.filter((result) => result.status === 'fulfilled')
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === 'rejected')
    ).toHaveLength(1);
    const persisted = await User.collection.findOne({ _id: user._id });
    expect(persisted?.email).toBe('new-address@example.test');
    expect(persisted?.pendingEmail).toBeUndefined();
    expect(persisted?.emailChangeTokenDigest).toBeUndefined();
    expect(persisted?.pendingEmailLocale).toBeUndefined();
  });

  it('rejects expiry, clears cancellation, and consumes a newly conflicting address', async () => {
    const expired = await createUser();
    const expiredToken = 'test-expired-email-change-token';
    await User.collection.updateOne(
      { _id: expired._id },
      {
        $set: {
          pendingEmail: 'expired-target@example.test',
          emailChangeTokenDigest: digestEmailChangeToken(expiredToken),
          emailChangeExpire: new Date(Date.now() - 1_000),
        },
      }
    );
    await expect(UserService.verifyEmailChange(expiredToken)).rejects.toThrow(
      'Invalid or expired verification token'
    );

    const cancelled = await createUser();
    const cancelledToken = await UserService.requestEmailChange(
      cancelled.id,
      'cancelled-target@example.test',
      'zh'
    );
    await UserService.cancelEmailChange(cancelled.id);
    await expect(UserService.verifyEmailChange(cancelledToken)).rejects.toThrow(
      'Invalid or expired verification token'
    );

    const conflicted = await createUser();
    const conflictToken = await UserService.requestEmailChange(
      conflicted.id,
      'claimed@example.test',
      'de'
    );
    await createUser('TestPassword4!', 'claimed@example.test');
    await expect(UserService.verifyEmailChange(conflictToken)).rejects.toThrow(
      'Email is no longer available'
    );
    const conflictState = await User.collection.findOne({
      _id: conflicted._id,
    });
    expect(conflictState?.pendingEmail).toBeUndefined();
    expect(conflictState?.emailChangeTokenDigest).toBeUndefined();
  });

  it('migrates legacy raw credentials once without exposing or changing digests again', async () => {
    const user = await createUser();
    const legacyToken = 'test-legacy-email-change-token';
    await User.collection.updateOne(
      { _id: user._id },
      {
        $set: {
          pendingEmail: 'legacy-target@example.test',
          emailChangeToken: legacyToken,
          emailChangeExpire: new Date(Date.now() + 60_000),
        },
      }
    );

    await expect(
      migrateLegacyEmailChangeTokens(mongoose.connection)
    ).resolves.toEqual({ scanned: 1, migrated: 1 });
    await expect(
      migrateLegacyEmailChangeTokens(mongoose.connection)
    ).resolves.toEqual({ scanned: 0, migrated: 0 });

    const migrated = await User.collection.findOne({ _id: user._id });
    expect(migrated?.emailChangeToken).toBeUndefined();
    expect(migrated?.emailChangeTokenDigest).toBe(
      digestEmailChangeToken(legacyToken)
    );
    await expect(
      UserService.verifyEmailChange(legacyToken)
    ).resolves.toMatchObject({
      success: true,
      newEmail: 'legacy-target@example.test',
      locale: 'de',
    });
  });
});
