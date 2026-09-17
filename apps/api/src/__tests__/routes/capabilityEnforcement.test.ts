import express from 'express';
import request from 'supertest';
import {
  canonicalAuthUserDocument,
  FIRST_PARTY_ORIGIN,
  mockAuthSessionCookie,
} from '../helpers/authSession';
import {
  afterAll,
  afterEach,
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
  MembershipStatus,
  PlayerType,
  AccountKind,
} from '@club/shared-types/core/enums';
import { authorizeCapability, protect } from '../../middleware/auth';
import { errorHandler } from '../../middleware/errorHandler';
import { Player } from '../../models/Player';
import { User } from '../../models/User';

const userId = '507f1f77bcf86cd799439011';

interface CurrentState {
  exists: boolean;
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
  player?: {
    type: PlayerType;
    isActivePlayer: boolean;
  };
}

function createApp() {
  const app = express();
  app.get(
    '/account',
    protect,
    authorizeCapability(Capability.AUTHENTICATED_ACCOUNT),
    (_req, res) => res.json({ ok: true })
  );
  app.get(
    '/member',
    protect,
    authorizeCapability(Capability.CURRENT_MEMBER),
    (_req, res) => res.json({ ok: true })
  );
  app.get(
    '/player',
    protect,
    authorizeCapability(Capability.ACTIVE_PLAYER),
    (_req, res) => res.json({ ok: true })
  );
  app.get(
    '/admin',
    protect,
    authorizeCapability(Capability.ADMINISTRATION),
    (_req, res) => res.json({ ok: true })
  );
  app.use(errorHandler);
  return app;
}

function token() {
  return mockAuthSessionCookie(userId);
}

function mockCurrentState(state: CurrentState) {
  vi.spyOn(User, 'findById').mockReturnValue({
    select: vi.fn().mockImplementation(async () =>
      state.exists
        ? canonicalAuthUserDocument({
            _id: userId,
            id: userId,
            email: 'capability@example.test',
            firstName: 'Capability',
            lastName: 'Tester',
            accountKind: state.accountKind,
            administratorDesignation: state.administratorDesignation,
            membershipStatus: state.membershipStatus,
            accountSuspension: state.accountSuspension,
            accountOnboardingStatus: AccountOnboardingStatus.READY,
          })
        : null
    ),
  } as never);

  vi.spyOn(Player, 'findOne').mockReturnValue({
    select: vi.fn().mockReturnValue({
      lean: vi
        .fn()
        .mockImplementation(async () =>
          state.player ? { _id: userId, ...state.player } : null
        ),
    }),
  } as never);
}

async function get(path: string) {
  return request(createApp())
    .get(path)
    .set('Cookie', token())
    .set('Origin', FIRST_PARTY_ORIGIN);
}

describe('WP6 backend Capability Enforcement matrix', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('invalidates an existing session when the Account becomes suspended', async () => {
    const state: CurrentState = {
      exists: true,
      accountKind: AccountKind.PERSON,
      administratorDesignation: false,
      displayName: 'Member',
      capabilities: [Capability.AUTHENTICATED_ACCOUNT],
      membershipStatus: MembershipStatus.ACTIVE,
      player: { type: PlayerType.MEMBER, isActivePlayer: true },
    };
    mockCurrentState(state);

    expect((await get('/member')).status).toBe(200);
    state.accountSuspension = {
      reason: 'Access review',
      suspendedAt: new Date('2026-01-02T00:00:00.000Z'),
      suspendedBy: userId,
    };
    expect((await get('/member')).status).toBe(401);
    expect((await get('/player')).status).toBe(401);
    expect((await get('/account')).status).toBe(401);
  });

  it('uses current database state on every request instead of JWT role claims', async () => {
    const state: CurrentState = {
      exists: true,
      accountKind: AccountKind.PERSON,
      administratorDesignation: false,
      displayName: 'Member',
      capabilities: [Capability.AUTHENTICATED_ACCOUNT],
      membershipStatus: MembershipStatus.ACTIVE,
      player: { type: PlayerType.MEMBER, isActivePlayer: true },
    };
    mockCurrentState(state);

    expect((await get('/player')).status).toBe(200);
    state.player = { type: PlayerType.MEMBER, isActivePlayer: false };
    expect((await get('/player')).status).toBe(403);
  });

  it('limits active external Players to account and Player capabilities', async () => {
    mockCurrentState({
      exists: true,
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

    expect((await get('/account')).status).toBe(200);
    expect((await get('/player')).status).toBe(200);
    expect((await get('/member')).status).toBe(403);
    expect((await get('/admin')).status).toBe(403);
  });

  it('blocks a designated administrator while the Account is suspended', async () => {
    mockCurrentState({
      exists: true,
      accountKind: AccountKind.PERSON,
      administratorDesignation: true,
      displayName: 'Administrator',
      capabilities: [Capability.ADMINISTRATION],
      membershipStatus: MembershipStatus.ACTIVE,
      accountSuspension: {
        reason: 'Access review',
        suspendedAt: new Date('2026-01-02T00:00:00.000Z'),
        suspendedBy: userId,
      },
    });

    expect((await get('/admin')).status).toBe(401);
    expect((await get('/member')).status).toBe(401);
  });

  it('fails closed for contradictory lifecycle state', async () => {
    mockCurrentState({
      exists: true,
      accountKind: AccountKind.PERSON,
      administratorDesignation: false,
      displayName: 'Member',
      capabilities: [Capability.AUTHENTICATED_ACCOUNT],
      membershipStatus: MembershipStatus.INACTIVE,
      player: { type: PlayerType.MEMBER, isActivePlayer: true },
    });

    expect((await get('/account')).status).toBe(401);
    expect((await get('/player')).status).toBe(401);
    expect(console.warn).toHaveBeenCalledWith(
      '[capability-policy-contradiction]',
      expect.objectContaining({ source: 'protected_request' })
    );
  });

  it('rejects a valid session after its User is deleted', async () => {
    mockCurrentState({
      exists: false,
      accountKind: AccountKind.PERSON,
      administratorDesignation: false,
      displayName: 'Member',
      capabilities: [Capability.AUTHENTICATED_ACCOUNT],
      membershipStatus: MembershipStatus.ACTIVE,
    });

    expect((await get('/account')).status).toBe(401);
  });
});
