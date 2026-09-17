import express from 'express';
import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AccountOnboardingStatus,
  Gender,
  MembershipStatus,
  AccountKind,
  Capability,
} from '@club/shared-types/core/enums';
import { errorHandler } from '../../middleware/errorHandler';
import { AuthSession } from '../../models/AuthSession';
import { Player } from '../../models/Player';
import { User } from '../../models/User';
import authRoutes from '../../routes/auth';
import {
  AUTH_SESSION_COOKIE_NAME,
  AuthSessionService,
} from '../../services/authSessionService';
import { config } from '../../config';
import { PasswordChangeService } from '../../services/passwordChangeService';

interface StoredSession {
  _id: Types.ObjectId;
  tokenDigest: string;
  userId: Types.ObjectId;
  authSessionGeneration: number;
  expiresAt: Date;
}

const userId = new Types.ObjectId();
const sessions = new Map<string, StoredSession>();
let authSessionGeneration = 0;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use('/api/auth', authRoutes);
  instance.use(errorHandler);
  return instance;
}

function currentUser() {
  const document = {
    _id: userId,
    id: userId.toString(),
    email: 'member@example.test',
    firstName: 'Session',
    lastName: 'Member',
    gender: Gender.FEMALE,
    dateOfBirth: '1990-01-01',
    accountKind: AccountKind.PERSON,
    administratorDesignation: false,
    displayName: 'Member',
    capabilities: [Capability.AUTHENTICATED_ACCOUNT],
    membershipStatus: MembershipStatus.ACTIVE,
    accountOnboardingStatus: AccountOnboardingStatus.READY,
    authSessionGeneration,
    isPlayer: false,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    __v: 0,
    get: vi
      .fn()
      .mockImplementation((path: string) => (path === '__v' ? 0 : undefined)),
    comparePassword: vi.fn().mockResolvedValue(true),
    toObject: vi.fn(),
  };
  document.toObject.mockReturnValue(document);
  return document;
}

function cookieHeader(response: request.Response): string {
  const value = response.headers['set-cookie']?.[0];
  if (!value) throw new Error('Session cookie was not set');
  return value.split(';')[0];
}

function mockPersistence(): void {
  vi.spyOn(mongoose, 'startSession').mockResolvedValue({
    withTransaction: async (operation: () => Promise<void>) => operation(),
    endSession: vi.fn().mockResolvedValue(undefined),
  } as never);
  vi.spyOn(User, 'updateOne').mockResolvedValue({ matchedCount: 1 } as never);
  vi.spyOn(AuthSession, 'create').mockImplementation(
    async (documents: unknown) => {
      const input = (documents as Array<Omit<StoredSession, '_id'>>)[0];
      const stored = { ...input, _id: new Types.ObjectId() };
      sessions.set(stored.tokenDigest, stored);
      return [stored] as never;
    }
  );
  vi.spyOn(AuthSession, 'findOne').mockImplementation((filter) => {
    const tokenDigest = (filter as { tokenDigest: string }).tokenDigest;
    return {
      select: vi.fn().mockReturnValue({
        lean: vi
          .fn()
          .mockImplementation(async () => sessions.get(tokenDigest) ?? null),
      }),
    } as never;
  });
  vi.spyOn(AuthSession, 'deleteOne').mockImplementation((async (
    filter: unknown
  ) => {
    const criteria = filter as { _id?: string; tokenDigest?: string };
    const entry = [...sessions.entries()].find(([, session]) =>
      criteria._id
        ? session._id.toString() === criteria._id.toString()
        : session.tokenDigest === criteria.tokenDigest
    );
    if (entry) sessions.delete(entry[0]);
    return { acknowledged: true, deletedCount: entry ? 1 : 0 };
  }) as never);
  vi.spyOn(AuthSession, 'deleteMany').mockResolvedValue({
    acknowledged: true,
    deletedCount: 0,
  } as never);

  vi.spyOn(User, 'findOne').mockImplementation(
    () =>
      ({
        select: vi.fn().mockImplementation(async () => currentUser()),
      }) as never
  );
  vi.spyOn(User, 'findById').mockImplementation(
    () =>
      ({
        select: vi.fn().mockImplementation(async () => currentUser()),
        lean: vi.fn().mockImplementation(async () => currentUser()),
      }) as never
  );
  vi.spyOn(Player, 'findOne').mockReturnValue({
    select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(null) }),
  } as never);
}

async function login(agent: ReturnType<typeof request.agent>) {
  return agent
    .post('/api/auth/login')
    .set('Origin', config.frontendUrl)
    .send({ email: 'member@example.test', password: 'TestPassword1!' });
}

beforeEach(() => {
  sessions.clear();
  authSessionGeneration = 0;
  mockPersistence();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ordinary account sessions', () => {
  it('rejects unverifiable or cross-site login and accepts the configured first party', async () => {
    expect(
      (
        await request(app()).post('/api/auth/login').send({
          email: 'member@example.test',
          password: 'TestPassword1!',
        })
      ).status
    ).toBe(403);
    expect(
      (
        await request(app())
          .post('/api/auth/login')
          .set('Origin', 'https://attacker.example')
          .send({
            email: 'member@example.test',
            password: 'TestPassword1!',
          })
      ).status
    ).toBe(403);

    const response = await login(request.agent(app()));
    expect(response.status).toBe(200);
  });

  it('accepts a trusted Referer when Origin is absent', async () => {
    const response = await request(app())
      .post('/api/auth/login')
      .set('Referer', `${config.frontendUrl}/en/login`)
      .send({
        email: 'member@example.test',
        password: 'TestPassword1!',
      });

    expect(response.status).toBe(200);
  });

  it('rejects a malicious Origin even when Referer is trusted', async () => {
    const response = await request(app())
      .post('/api/auth/login')
      .set('Origin', 'https://attacker.example')
      .set('Referer', `${config.frontendUrl}/en/login`)
      .send({
        email: 'member@example.test',
        password: 'TestPassword1!',
      });

    expect(response.status).toBe(403);
  });

  it('sets an HttpOnly cookie, returns no credential, and persists only its digest', async () => {
    const response = await login(request.agent(app()));

    expect(response.status).toBe(200);
    expect(response.body).not.toHaveProperty('token');
    const setCookie = response.headers['set-cookie']?.[0] ?? '';
    expect(setCookie).toContain(`${AUTH_SESSION_COOKIE_NAME}=`);
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Lax');
    expect(setCookie).toContain('Path=/');

    const rawToken = cookieHeader(response).split('=')[1];
    expect(sessions.size).toBe(1);
    expect([...sessions.keys()][0]).toBe(AuthSessionService.digest(rawToken));
    expect([...sessions.keys()][0]).not.toBe(rawToken);
  });

  it('rejects noncanonical User persistence before issuing a session', async () => {
    const malformed = {
      ...currentUser(),
      accountKind: undefined,
      toObject: vi.fn(),
    };
    malformed.toObject.mockReturnValue(malformed);
    vi.mocked(User.findOne).mockImplementationOnce(
      () =>
        ({
          select: vi.fn().mockResolvedValue(malformed),
        }) as never
    );

    const response = await login(request.agent(app()));

    expect(response.status).toBe(500);
    expect(response.headers['set-cookie']).toBeUndefined();
    expect(sessions.size).toBe(0);
  });

  it('invalidates an existing session when current User persistence is noncanonical', async () => {
    const issued = await AuthSessionService.create(userId.toString(), 0);
    const malformed = {
      ...currentUser(),
      accountOnboardingStatus: undefined,
      toObject: vi.fn(),
    };
    malformed.toObject.mockReturnValue(malformed);
    vi.mocked(User.findById).mockImplementationOnce(
      () =>
        ({
          select: vi.fn().mockResolvedValue(malformed),
        }) as never
    );

    const response = await request(app())
      .get('/api/auth/verify')
      .set('Cookie', `${AUTH_SESSION_COOKIE_NAME}=${issued.token}`);

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('SESSION_INVALID');
    expect(sessions.size).toBe(0);
  });

  it('keeps device sessions independent and rejects replay after current-session logout', async () => {
    const first = request.agent(app());
    const second = request.agent(app());
    const firstLogin = await login(first);
    await login(second);
    const replayCookie = cookieHeader(firstLogin);

    expect((await first.get('/api/auth/verify')).status).toBe(200);
    expect((await second.get('/api/auth/verify')).status).toBe(200);

    const logoutResponse = await first
      .post('/api/auth/logout')
      .set('Origin', config.frontendUrl);
    expect(logoutResponse.status).toBe(200);
    expect(logoutResponse.headers['set-cookie']).toBeUndefined();
    expect(
      (await request(app()).get('/api/auth/verify').set('Cookie', replayCookie))
        .status
    ).toBe(401);
    expect((await second.get('/api/auth/verify')).status).toBe(200);
  });

  it('treats absent and already-ended logout as idempotent', async () => {
    const first = await request(app())
      .post('/api/auth/logout')
      .set('Origin', config.frontendUrl);
    const second = await request(app())
      .post('/api/auth/logout')
      .set('Origin', config.frontendUrl);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.headers['set-cookie']).toBeUndefined();
    expect(second.headers['set-cookie']).toBeUndefined();
  });

  it('keeps a newer login valid after a late invalid verification response', async () => {
    const oldLogin = await login(request.agent(app()));
    const oldCookie = cookieHeader(oldLogin);
    const oldDigest = AuthSessionService.digest(oldCookie.split('=')[1]);
    sessions.delete(oldDigest);
    const verificationStarted = deferred<void>();
    const verificationResult = deferred<StoredSession | null>();
    vi.mocked(AuthSession.findOne).mockImplementationOnce(
      () =>
        ({
          select: vi.fn().mockReturnValue({
            lean: vi.fn().mockImplementation(() => {
              verificationStarted.resolve();
              return verificationResult.promise;
            }),
          }),
        }) as never
    );

    const lateVerification = request(app())
      .get('/api/auth/verify')
      .set('Cookie', oldCookie)
      .then((response) => response);
    await verificationStarted.promise;
    const newLogin = await request(app())
      .post('/api/auth/login')
      .set('Origin', config.frontendUrl)
      .set('Cookie', oldCookie)
      .send({ email: 'member@example.test', password: 'TestPassword1!' });
    const newCookie = cookieHeader(newLogin);
    verificationResult.resolve(null);
    const oldResponse = await lateVerification;

    expect(oldResponse.status).toBe(401);
    expect(oldResponse.body.code).toBe('SESSION_INVALID');
    expect(oldResponse.headers['set-cookie']).toBeUndefined();
    expect(
      (await request(app()).get('/api/auth/verify').set('Cookie', newCookie))
        .status
    ).toBe(200);
    expect(
      (await request(app()).get('/api/auth/verify').set('Cookie', oldCookie))
        .status
    ).toBe(401);
  });

  it('keeps a newer login valid after a late old-session logout', async () => {
    const oldLogin = await login(request.agent(app()));
    const oldCookie = cookieHeader(oldLogin);
    const oldDigest = AuthSessionService.digest(oldCookie.split('=')[1]);
    const logoutStarted = deferred<void>();
    const finishLogout = deferred<void>();
    vi.mocked(AuthSession.deleteOne).mockImplementationOnce((async () => {
      logoutStarted.resolve();
      await finishLogout.promise;
      sessions.delete(oldDigest);
      return { acknowledged: true, deletedCount: 1 };
    }) as never);

    const lateLogout = request(app())
      .post('/api/auth/logout')
      .set('Origin', config.frontendUrl)
      .set('Cookie', oldCookie)
      .then((response) => response);
    await logoutStarted.promise;
    const newLogin = await request(app())
      .post('/api/auth/login')
      .set('Origin', config.frontendUrl)
      .set('Cookie', oldCookie)
      .send({ email: 'member@example.test', password: 'TestPassword1!' });
    const newCookie = cookieHeader(newLogin);
    finishLogout.resolve();
    const oldResponse = await lateLogout;

    expect(oldResponse.status).toBe(200);
    expect(oldResponse.headers['set-cookie']).toBeUndefined();
    expect(
      (await request(app()).get('/api/auth/verify').set('Cookie', oldCookie))
        .status
    ).toBe(401);
    expect(
      (await request(app()).get('/api/auth/verify').set('Cookie', newCookie))
        .status
    ).toBe(200);
  });

  it('revokes all sessions on password change without issuing a replacement cookie', async () => {
    const agent = request.agent(app());
    const oldLogin = await login(agent);
    const oldCookie = cookieHeader(oldLogin);
    const oldDigest = AuthSessionService.digest(oldCookie.split('=')[1]);
    const oldSession = sessions.get(oldDigest);
    if (!oldSession) throw new Error('Stored session not found');
    const verificationStarted = deferred<void>();
    const verificationResult = deferred<StoredSession | null>();
    vi.mocked(AuthSession.findOne).mockImplementationOnce(
      () =>
        ({
          select: vi.fn().mockReturnValue({
            lean: vi.fn().mockImplementation(() => {
              verificationStarted.resolve();
              return verificationResult.promise;
            }),
          }),
        }) as never
    );
    vi.spyOn(PasswordChangeService, 'change').mockImplementation(async () => {
      authSessionGeneration = 1;
      sessions.clear();
    });

    const lateVerification = request(app())
      .get('/api/auth/verify')
      .set('Cookie', oldCookie)
      .then((response) => response);
    await verificationStarted.promise;
    const passwordResponse = await agent
      .patch('/api/auth/password')
      .set('Origin', config.frontendUrl)
      .send({
        currentPassword: 'TestPassword1!',
        newPassword: 'TestPassword2!',
      });
    verificationResult.resolve(oldSession);
    const oldResponse = await lateVerification;

    expect(passwordResponse.status).toBe(200);
    expect(passwordResponse.headers['set-cookie']).toBeUndefined();
    expect(oldResponse.status).toBe(401);
    expect(oldResponse.headers['set-cookie']).toBeUndefined();
    expect(
      (await request(app()).get('/api/auth/verify').set('Cookie', oldCookie))
        .status
    ).toBe(401);

    const freshLogin = await login(request.agent(app()));
    const freshCookie = cookieHeader(freshLogin);
    expect(
      (await request(app()).get('/api/auth/verify').set('Cookie', freshCookie))
        .status
    ).toBe(200);
  });

  it('rejects expired and generation-stale rows before cleanup', async () => {
    const agent = request.agent(app());
    const response = await login(agent);
    const digest = AuthSessionService.digest(
      cookieHeader(response).split('=')[1]
    );
    const stored = sessions.get(digest);
    if (!stored) throw new Error('Stored session not found');

    stored.expiresAt = new Date(Date.now() - 1);
    expect((await agent.get('/api/auth/verify')).status).toBe(401);

    const relogin = await login(agent);
    const staleDigest = AuthSessionService.digest(
      cookieHeader(relogin).split('=')[1]
    );
    expect(sessions.has(staleDigest)).toBe(true);
    authSessionGeneration = 1;
    expect((await agent.get('/api/auth/verify')).status).toBe(401);
  });

  it('rejects a generation-stale session even when row cleanup fails', async () => {
    const agent = request.agent(app());
    await login(agent);
    authSessionGeneration = 1;
    vi.mocked(AuthSession.deleteOne).mockRejectedValueOnce(
      new Error('cleanup unavailable')
    );

    const response = await agent.get('/api/auth/verify');

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('SESSION_INVALID');
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  it('does not report secure logout success when session storage fails', async () => {
    const agent = request.agent(app());
    await login(agent);
    vi.mocked(AuthSession.deleteOne).mockRejectedValueOnce(
      new Error('store unavailable')
    );

    const response = await agent
      .post('/api/auth/logout')
      .set('Origin', config.frontendUrl);

    expect(response.status).toBe(500);
    expect(response.headers['set-cookie']).toBeUndefined();
  });
});
