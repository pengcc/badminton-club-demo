import {
  AccountKind,
  AccountOnboardingStatus,
  MembershipStatus,
} from '@club/shared-types/core/enums';
import express from 'express';
import { Types } from 'mongoose';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../../middleware/errorHandler';
import { Player } from '../../models/Player';
import { User } from '../../models/User';
import playerRoutes from '../../routes/players';
import {
  canonicalAuthUserDocument,
  mockAuthSessionCookie,
} from '../helpers/authSession';

const administratorId = '507f1f77bcf86cd799439011';
const candidateId = new Types.ObjectId('507f1f77bcf86cd799439012');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/players', playerRoutes);
  app.use(errorHandler);
  return app;
}

function selectedFields<T extends Record<string, unknown>>(
  source: T,
  projection: string
): Partial<T> {
  const selected = new Set(projection.split(/\s+/));
  return Object.fromEntries(
    Object.entries(source).filter(([field]) => selected.has(field))
  ) as Partial<T>;
}

function mockAdministrator() {
  vi.spyOn(User, 'findById').mockReturnValue({
    select: vi.fn().mockResolvedValue(
      canonicalAuthUserDocument({
        _id: administratorId,
        id: administratorId,
        email: 'admin@example.test',
        firstName: 'Test',
        lastName: 'Admin',
        accountKind: AccountKind.PERSON,
        administratorDesignation: true,
        membershipStatus: MembershipStatus.ACTIVE,
        accountOnboardingStatus: AccountOnboardingStatus.READY,
      })
    ),
  } as never);

  vi.spyOn(Player, 'findOne').mockReturnValue({
    select: vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
    }),
  } as never);
}

describe('GET /api/players/lifecycle/candidates', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a current person Member through the real route and service projection', async () => {
    mockAdministrator();
    const candidate = {
      _id: candidateId,
      firstName: 'Current',
      lastName: 'Member',
      accountKind: AccountKind.PERSON,
      membershipStatus: MembershipStatus.ACTIVE,
    };
    const lean = vi.fn().mockResolvedValue([]);
    const select = vi.fn().mockImplementation((projection: string) => ({
      sort: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          lean: vi
            .fn()
            .mockResolvedValue([selectedFields(candidate, projection)]),
        }),
      }),
    }));
    vi.spyOn(User, 'find').mockReturnValue({ select } as never);
    vi.spyOn(Player, 'find').mockReturnValue({ lean } as never);

    const response = await request(createApp())
      .get('/api/players/lifecycle/candidates')
      .set('Cookie', mockAuthSessionCookie(administratorId));

    expect(response.status).toBe(200);
    expect(User.find).toHaveBeenCalledWith({
      accountKind: AccountKind.PERSON,
      membershipStatus: {
        $in: [MembershipStatus.ACTIVE, MembershipStatus.PASSIVE],
      },
    });
    expect(select).toHaveBeenCalledWith(
      '_id firstName lastName accountKind membershipStatus'
    );
    expect(response.body).toEqual({
      success: true,
      data: [
        {
          userId: candidateId.toString(),
          userName: 'Member, Current',
          membershipStatus: MembershipStatus.ACTIVE,
          isParticipationEnabled: false,
          isEffectivelyEligible: false,
        },
      ],
    });
  });
});
