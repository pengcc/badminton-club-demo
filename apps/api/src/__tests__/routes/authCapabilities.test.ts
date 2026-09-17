import express from 'express';
import request from 'supertest';
import { FIRST_PARTY_ORIGIN } from '../helpers/authSession';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  Capability,
  AccountOnboardingStatus,
  Gender,
  MembershipStatus,
  PlayerType,
  AccountKind,
} from '@club/shared-types/core/enums';
import authRoutes from '../../routes/auth';
import { Player } from '../../models/Player';
import { User } from '../../models/User';
import { AuthSessionService } from '../../services/authSessionService';

const userId = '507f1f77bcf86cd799439011';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  return app;
}

function mockLoginUser(options: {
  accountKind: AccountKind;
  administratorDesignation: boolean;
  displayName?: string;
  capabilities?: Capability[];
  membershipStatus: MembershipStatus;
  accountSuspension?: {
    reason: string;
    suspendedAt: Date;
    suspendedBy: string;
  };
  player?: { type: PlayerType; isActivePlayer: boolean };
}) {
  const document = {
    _id: userId,
    id: userId,
    email: 'login@example.test',
    firstName: 'Login',
    lastName: 'Tester',
    gender: Gender.FEMALE,
    dateOfBirth: '1990-01-01',
    accountKind: options.accountKind,
    administratorDesignation: options.administratorDesignation,
    membershipStatus: options.membershipStatus,
    accountSuspension: options.accountSuspension,
    accountOnboardingStatus: AccountOnboardingStatus.READY,
    isPlayer: Boolean(options.player),
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

  vi.spyOn(User, 'findOne').mockReturnValue({
    select: vi.fn().mockResolvedValue(document),
  } as never);
  vi.spyOn(Player, 'findOne').mockReturnValue({
    select: vi.fn().mockReturnValue({
      lean: vi
        .fn()
        .mockResolvedValue(
          options.player ? { _id: userId, ...options.player } : null
        ),
    }),
  } as never);
  vi.spyOn(AuthSessionService, 'replacePresented').mockResolvedValue({
    token: 'test-session-token',
    expiresAt: new Date(Date.now() + 60_000),
  });
}

describe('WP6 login capability projection', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('denies an inactive former member with no authorized capability', async () => {
    mockLoginUser({
      accountKind: AccountKind.PERSON,
      administratorDesignation: false,
      displayName: 'Member',
      capabilities: [Capability.AUTHENTICATED_ACCOUNT],
      membershipStatus: MembershipStatus.INACTIVE,
    });

    const response = await request(createApp())
      .post('/api/auth/login')
      .set('Origin', FIRST_PARTY_ORIGIN)
      .send({ email: 'login@example.test', password: 'TestPassword1!' });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: 'Account is not authorized' });
    expect(AuthSessionService.replacePresented).not.toHaveBeenCalled();
  });

  it('denies login for an Account-suspended member before capability evaluation', async () => {
    mockLoginUser({
      accountKind: AccountKind.PERSON,
      administratorDesignation: false,
      displayName: 'Member',
      capabilities: [Capability.AUTHENTICATED_ACCOUNT],
      membershipStatus: MembershipStatus.ACTIVE,
      accountSuspension: {
        reason: 'Access review',
        suspendedAt: new Date('2026-01-02T00:00:00.000Z'),
        suspendedBy: userId,
      },
      player: { type: PlayerType.MEMBER, isActivePlayer: true },
    });

    const response = await request(createApp())
      .post('/api/auth/login')
      .set('Origin', FIRST_PARTY_ORIGIN)
      .send({ email: 'login@example.test', password: 'TestPassword1!' });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: 'Account is not authorized' });
    expect(AuthSessionService.replacePresented).not.toHaveBeenCalled();
  });

  it('allows an inactive active external Player without member access', async () => {
    mockLoginUser({
      accountKind: AccountKind.PERSON,
      administratorDesignation: false,
      displayName: 'External Player',
      capabilities: [
        Capability.AUTHENTICATED_ACCOUNT,
        Capability.ACTIVE_PLAYER,
        Capability.EXTERNAL_PLAYER,
      ],
      membershipStatus: MembershipStatus.INACTIVE,
      player: { type: PlayerType.EXTERNAL, isActivePlayer: true },
    });

    const response = await request(createApp())
      .post('/api/auth/login')
      .set('Origin', FIRST_PARTY_ORIGIN)
      .send({ email: 'login@example.test', password: 'TestPassword1!' });

    expect(response.status).toBe(200);
    expect(response.body.user.capabilities).toEqual(
      expect.arrayContaining([
        Capability.AUTHENTICATED_ACCOUNT,
        Capability.ACTIVE_PLAYER,
        Capability.EXTERNAL_PLAYER,
      ])
    );
    expect(response.body.user.capabilities).not.toContain(
      Capability.CURRENT_MEMBER
    );
    expect(response.body.user.playerId).toBe(userId);
  });
});
