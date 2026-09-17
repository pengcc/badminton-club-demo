import express from 'express';
import request from 'supertest';
import {
  AccountKind,
  AccountOnboardingStatus,
  MembershipStatus,
} from '@club/shared-types/core/enums';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  canonicalAuthUserDocument,
  FIRST_PARTY_ORIGIN,
  mockAuthSessionCookie,
} from '../helpers/authSession';
import { errorHandler } from '../../middleware/errorHandler';
import { Player } from '../../models/Player';
import { User } from '../../models/User';
import membershipRoutes from '../../routes/membershipApplications';
import { RegistrationAccessService } from '../../services/registrationAccessService';

const USER_ID = '507f1f77bcf86cd799439011';
const TEST_PATH = '/apply?k=TestLink_123';
let administratorDesignation = false;

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use('/api/membership', membershipRoutes);
  instance.use(errorHandler);
  return instance;
}

function sessionCookie() {
  return mockAuthSessionCookie(USER_ID);
}

describe('registration access administrator routes', () => {
  beforeEach(() => {
    administratorDesignation = false;
    vi.spyOn(User, 'findById').mockReturnValue({
      select: vi.fn().mockImplementation(async () =>
        canonicalAuthUserDocument({
          _id: USER_ID,
          id: USER_ID,
          email: 'registration-admin@example.test',
          accountKind: AccountKind.PERSON,
          accountOnboardingStatus: AccountOnboardingStatus.READY,
          administratorDesignation,
          membershipStatus: MembershipStatus.ACTIVE,
        })
      ),
    } as never);
    vi.spyOn(Player, 'findOne').mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      }),
    } as never);
  });

  afterEach(() => vi.restoreAllMocks());

  it('keeps the bearer path behind the Administration capability and disables caching', async () => {
    const getAdminState = vi
      .spyOn(RegistrationAccessService, 'getAdminState')
      .mockResolvedValue({
        hasCurrentLink: true,
        isValid: true,
        expiryMode: '30_days',
        generation: 2,
        path: TEST_PATH,
      });

    await request(app()).get('/api/membership/registration-access').expect(401);
    await request(app())
      .get('/api/membership/registration-access')
      .set('Cookie', sessionCookie())
      .expect(403);

    administratorDesignation = true;
    const response = await request(app())
      .get('/api/membership/registration-access')
      .set('Cookie', sessionCookie())
      .expect(200);

    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body.data.path).toBe(TEST_PATH);
    expect(getAdminState).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['generate', 201, true],
    ['rotate', 200, false],
  ] as const)('keeps the %s response non-secret', async (action, status, requireNoValidLink) => {
    administratorDesignation = true;
    const issue = vi
      .spyOn(RegistrationAccessService, 'issue')
      .mockResolvedValue({
        hasCurrentLink: true,
        isValid: true,
        expiryMode: '30_days',
        generation: 3,
      });

    const response = await request(app())
      .post(`/api/membership/registration-access/${action}`)
      .set('Cookie', sessionCookie())
      .set('Origin', FIRST_PARTY_ORIGIN)
      .send({ expiryMode: '30_days' })
      .expect(status);

    expect(response.body.data).not.toHaveProperty('token');
    expect(response.body.data).not.toHaveProperty('path');
    expect(issue).toHaveBeenCalledWith('30_days', USER_ID, requireNoValidLink);
  });
});
