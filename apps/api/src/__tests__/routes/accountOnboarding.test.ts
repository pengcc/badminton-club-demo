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
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  AccountOnboardingStatus,
  Gender,
  MembershipStatus,
  AccountKind,
} from '@club/shared-types/core/enums';
import { AccountOnboardingTargetKind } from '@club/shared-types/domain/accountOnboarding';
import { errorHandler } from '../../middleware/errorHandler';
import { Player } from '../../models/Player';
import { User } from '../../models/User';
import userRoutes from '../../routes/users';
import { accountOnboardingService } from '../../services/accountOnboardingService';

const userId = '507f1f77bcf86cd799439011';

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use('/api/users', userRoutes);
  instance.use(errorHandler);
  return instance;
}

function token() {
  return mockAuthSessionCookie(userId);
}

function authenticateAs(administratorDesignation: boolean) {
  vi.spyOn(User, 'findById').mockReturnValue({
    select: vi.fn().mockResolvedValue(
      canonicalAuthUserDocument({
        _id: userId,
        id: userId,
        email: 'admin@example.test',
        firstName: 'Test',
        lastName: 'Admin',
        accountKind: AccountKind.PERSON,
        administratorDesignation,
        membershipStatus: MembershipStatus.ACTIVE,
        accountOnboardingStatus: AccountOnboardingStatus.READY,
      })
    ),
  } as never);
  vi.spyOn(Player, 'findOne').mockReturnValue({
    select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(null) }),
  } as never);
}

function validRequest() {
  return {
    email: 'new.member@example.test',
    firstName: 'New',
    lastName: 'Member',
    dateOfBirth: '1990-01-01',
    gender: Gender.FEMALE,
    targetKind: AccountOnboardingTargetKind.MEMBER,
    establishPlayer: false,
    initialMembershipStatus: MembershipStatus.PASSIVE,
  };
}

afterEach(() => vi.restoreAllMocks());

describe('POST /api/users Account Onboarding', () => {
  it.each([
    [MembershipStatus.ACTIVE, false],
    [MembershipStatus.ACTIVE, true],
    [MembershipStatus.PASSIVE, false],
    [MembershipStatus.PASSIVE, true],
  ] as const)('forwards %s Member establishment with establishPlayer=%s', async (initialMembershipStatus, establishPlayer) => {
    authenticateAs(true);
    const result = {
      userId: '507f1f77bcf86cd799439012',
      targetKind: AccountOnboardingTargetKind.MEMBER,
      setupRequired: true,
      setupGeneration: 1,
      deliveryStatus: 'uncertain' as const,
      replayed: false,
    };
    const establish = vi
      .spyOn(accountOnboardingService, 'establish')
      .mockResolvedValue(result);

    const response = await request(app())
      .post('/api/users')
      .set('Cookie', token())
      .set('Origin', FIRST_PARTY_ORIGIN)
      .set('Idempotency-Key', 'add-member-route-key')
      .send({
        ...validRequest(),
        initialMembershipStatus,
        establishPlayer,
      });

    expect(response.status).toBe(201);
    expect(response.body.data).toEqual(result);
    expect(establish).toHaveBeenCalledWith(
      expect.objectContaining({
        targetKind: AccountOnboardingTargetKind.MEMBER,
        establishPlayer,
        initialMembershipStatus,
        idempotencyKey: 'add-member-route-key',
        source: { kind: 'administrator' },
        sendPasswordSetupEmailNow: false,
      })
    );
    expect(JSON.stringify(response.body)).not.toMatch(/password|token/i);
  });

  it('forwards explicit immediate setup delivery for Member intent', async () => {
    authenticateAs(true);
    const establish = vi
      .spyOn(accountOnboardingService, 'establish')
      .mockResolvedValue({
        userId: '507f1f77bcf86cd799439012',
        targetKind: AccountOnboardingTargetKind.MEMBER,
        setupRequired: true,
        setupGeneration: 1,
        deliveryStatus: 'sent',
        replayed: false,
      });

    const response = await request(app())
      .post('/api/users')
      .set('Cookie', token())
      .set('Origin', FIRST_PARTY_ORIGIN)
      .set('Idempotency-Key', 'add-member-send-now-key')
      .send({ ...validRequest(), sendPasswordSetupEmailNow: true });

    expect(response.status).toBe(201);
    expect(establish).toHaveBeenCalledWith(
      expect.objectContaining({ sendPasswordSetupEmailNow: true })
    );
  });

  it('forwards the fixed External Player intent without Membership fields', async () => {
    authenticateAs(true);
    const establish = vi
      .spyOn(accountOnboardingService, 'establish')
      .mockResolvedValue({
        userId: '507f1f77bcf86cd799439012',
        playerId: '507f1f77bcf86cd799439013',
        targetKind: AccountOnboardingTargetKind.EXTERNAL_PLAYER,
        setupRequired: true,
        setupGeneration: 1,
        deliveryStatus: 'sent',
        replayed: false,
      });

    const { initialMembershipStatus: _status, ...identity } = validRequest();
    const response = await request(app())
      .post('/api/users')
      .set('Cookie', token())
      .set('Origin', FIRST_PARTY_ORIGIN)
      .set('Idempotency-Key', 'add-external-player-key')
      .send({
        ...identity,
        targetKind: AccountOnboardingTargetKind.EXTERNAL_PLAYER,
        establishPlayer: true,
      });

    expect(response.status).toBe(201);
    expect(establish).toHaveBeenCalledWith(
      expect.objectContaining({
        targetKind: AccountOnboardingTargetKind.EXTERNAL_PLAYER,
        establishPlayer: true,
        idempotencyKey: 'add-external-player-key',
      })
    );
    expect(establish.mock.calls[0]?.[0]).not.toHaveProperty(
      'initialMembershipStatus'
    );
    expect(establish.mock.calls[0]?.[0]).not.toHaveProperty(
      'sendPasswordSetupEmailNow'
    );
  });

  it.each([
    { administratorDesignation: true },
    { membershipStatus: 'suspended' },
    { initialMembershipStatus: MembershipStatus.INACTIVE },
    { playerType: 'external' },
    { teamIds: ['507f1f77bcf86cd799439014'] },
    { singlesRanking: 100 },
  ])('rejects unsupported client control fields: %j', async (override) => {
    authenticateAs(true);
    const establish = vi.spyOn(accountOnboardingService, 'establish');
    const response = await request(app())
      .post('/api/users')
      .set('Cookie', token())
      .set('Origin', FIRST_PARTY_ORIGIN)
      .set('Idempotency-Key', 'add-member-invalid-key')
      .send({ ...validRequest(), ...override });

    expect(response.status).toBe(400);
    expect(establish).not.toHaveBeenCalled();
  });

  it('requires administrator capability', async () => {
    authenticateAs(false);
    const establish = vi.spyOn(accountOnboardingService, 'establish');
    const response = await request(app())
      .post('/api/users')
      .set('Cookie', token())
      .set('Origin', FIRST_PARTY_ORIGIN)
      .set('Idempotency-Key', 'add-member-forbidden-key')
      .send(validRequest());

    expect(response.status).toBe(403);
    expect(establish).not.toHaveBeenCalled();
  });

  it('requires a retained Idempotency-Key', async () => {
    authenticateAs(true);
    const establish = vi.spyOn(accountOnboardingService, 'establish');
    const response = await request(app())
      .post('/api/users')
      .set('Cookie', token())
      .set('Origin', FIRST_PARTY_ORIGIN)
      .send(validRequest());

    expect(response.status).toBe(400);
    expect(establish).not.toHaveBeenCalled();
  });
});
