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
  MemberListFilter,
  MembershipStatus,
  AccountKind,
} from '@club/shared-types/core/enums';
import userRoutes from '../../routes/users';
import { errorHandler } from '../../middleware/errorHandler';
import { User } from '../../models/User';
import { Player } from '../../models/Player';
import { Team } from '../../models/Team';
import { PasswordRecoveryService } from '../../services/passwordRecoveryService';
import { PasswordSetupDeliveryService } from '../../services/passwordSetupDeliveryService';

const userId = '507f1f77bcf86cd799439011';

const emptyStatisticsAggregation = [{ summary: [], birthYears: [] }];
const supportedMembershipStatuses = [
  MembershipStatus.ACTIVE,
  MembershipStatus.PASSIVE,
  MembershipStatus.INACTIVE,
];

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/users', userRoutes);
  app.use(errorHandler);
  return app;
}

function tokenFor(id = userId) {
  return mockAuthSessionCookie(id);
}

function mockAuthenticatedUser(administratorDesignation: boolean) {
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
    select: vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
    }),
  } as never);
  vi.spyOn(Player, 'distinct').mockResolvedValue([]);
}

function mockUserFind(result: unknown[] | Error) {
  const sort = vi.fn();
  if (result instanceof Error) {
    sort.mockRejectedValue(result);
  } else {
    sort.mockResolvedValue(result);
  }

  vi.spyOn(User, 'find').mockReturnValue({
    select: vi.fn().mockReturnValue({
      skip: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({ sort }),
      }),
    }),
  } as never);

  return sort;
}

function mockSuccessfulQueries(options?: {
  users?: unknown[];
  total?: number;
  aggregation?: unknown[];
}) {
  const users = options?.users ?? [];
  const sort = mockUserFind(users);
  vi.spyOn(User, 'countDocuments').mockResolvedValue(options?.total ?? 0);
  vi.spyOn(User, 'aggregate').mockResolvedValue(
    (options?.aggregation ?? emptyStatisticsAggregation) as never
  );
  vi.spyOn(
    PasswordSetupDeliveryService,
    'setupSummariesForUsers'
  ).mockResolvedValue(
    new Map(
      users.map((user) => {
        const userId = String((user as { _id: unknown })._id);
        return [
          userId,
          {
            userId,
            accountOnboardingStatus: AccountOnboardingStatus.READY,
            deliveryStatus: 'none' as const,
            reissueAvailable: false,
          },
        ];
      })
    )
  );
  vi.spyOn(PasswordRecoveryService, 'availabilityForUsers').mockResolvedValue(
    new Map(users.map((user) => [String((user as { _id: unknown })._id), true]))
  );
  return sort;
}

function userDocument(overrides: Record<string, unknown> = {}) {
  return {
    _id: userId,
    email: 'member@example.test',
    firstName: 'Test',
    lastName: 'Member',
    gender: Gender.FEMALE,
    dateOfBirth: '1990-01-01',
    accountKind: AccountKind.PERSON,
    administratorDesignation: false,
    membershipStatus: MembershipStatus.ACTIVE,
    accountOnboardingStatus: AccountOnboardingStatus.READY,
    isPlayer: false,
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('GET /api/users/filter', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('defaults to active and passive current members and excludes known external Players', async () => {
    mockAuthenticatedUser(true);
    const sort = mockSuccessfulQueries({ users: [userDocument()], total: 1 });

    const response = await request(createApp())
      .get('/api/users/filter')
      .set('Cookie', tokenFor())
      .set('Origin', FIRST_PARTY_ORIGIN);

    expect(response.status).toBe(200);
    expect(User.find).toHaveBeenCalledWith({
      membershipStatus: {
        $in: [MembershipStatus.ACTIVE, MembershipStatus.PASSIVE],
      },
      accountKind: AccountKind.PERSON,
    });
    expect(sort).toHaveBeenCalledWith({ lastName: 1, firstName: 1, _id: 1 });
    expect(response.body).toEqual({
      success: true,
      appliedFilter: MemberListFilter.CURRENT,
      items: [
        expect.objectContaining({
          id: userId,
          email: 'member@example.test',
          fullName: 'Member, Test',
          accountSetup: {
            userId,
            accountOnboardingStatus: AccountOnboardingStatus.READY,
            deliveryStatus: 'none',
            reissueAvailable: false,
          },
          passwordRecoveryAvailable: true,
        }),
      ],
      pagination: {
        page: 1,
        pageSize: 20,
        total: 1,
        totalPages: 1,
        returned: 1,
      },
      statistics: {
        total: 1,
        gender: { male: 0, female: 0, other: 0, missing: 0 },
        birthYears: [],
        missingBirthDate: 0,
      },
      genderFilterCounts: {
        male: 0,
        female: 0,
        other: 0,
        missing: 0,
      },
    });
  });

  it.each([
    [
      MemberListFilter.ACTIVE,
      {
        membershipStatus: MembershipStatus.ACTIVE,
        accountKind: AccountKind.PERSON,
      },
    ],
    [
      MemberListFilter.PASSIVE,
      {
        membershipStatus: MembershipStatus.PASSIVE,
        accountKind: AccountKind.PERSON,
      },
    ],
    [
      MemberListFilter.INACTIVE,
      {
        membershipStatus: MembershipStatus.INACTIVE,
        accountKind: AccountKind.PERSON,
      },
    ],
    [
      MemberListFilter.ALL,
      {
        membershipStatus: { $in: supportedMembershipStatuses },
        accountKind: AccountKind.PERSON,
      },
    ],
  ])('applies the %s membership projection', async (filter, expectedQuery) => {
    mockAuthenticatedUser(true);
    mockSuccessfulQueries();

    const response = await request(createApp())
      .get(`/api/users/filter?filter=${filter}`)
      .set('Cookie', tokenFor())
      .set('Origin', FIRST_PARTY_ORIGIN);

    expect(response.status).toBe(200);
    expect(User.find).toHaveBeenCalledWith(expectedQuery);
    expect(User.countDocuments).toHaveBeenCalledWith(expectedQuery);
    expect(vi.mocked(User.aggregate).mock.calls[0]?.[0]?.[0]).toEqual({
      $match: expectedQuery,
    });
    if (filter === MemberListFilter.ALL) {
      expect(supportedMembershipStatuses).not.toContain('pending');
    }
    expect(response.body.appliedFilter).toBe(filter);
  });

  it('returns complete projection statistics and pagination totals beyond the current page', async () => {
    mockAuthenticatedUser(true);
    mockSuccessfulQueries({
      users: [
        userDocument(),
        userDocument({
          _id: '507f1f77bcf86cd799439012',
          email: 'second@example.test',
        }),
      ],
      total: 25,
      aggregation: [
        {
          summary: [
            { male: 10, female: 12, other: 2, missing: 1, missingBirthDate: 3 },
          ],
          birthYears: [{ _id: 1990, male: 2, female: 3, other: 1, missing: 1 }],
        },
      ],
    });

    const response = await request(createApp())
      .get('/api/users/filter?page=2&pageSize=10')
      .set('Cookie', tokenFor())
      .set('Origin', FIRST_PARTY_ORIGIN);

    expect(response.status).toBe(200);
    expect(response.body.pagination).toEqual({
      page: 2,
      pageSize: 10,
      total: 25,
      totalPages: 3,
      returned: 2,
    });
    expect(response.body.statistics).toEqual({
      total: 25,
      gender: { male: 10, female: 12, other: 2, missing: 1 },
      birthYears: [{ year: 1990, male: 2, female: 3, other: 1, missing: 1 }],
      missingBirthDate: 3,
    });
    const birthYearGroup = (
      vi.mocked(User.aggregate).mock.calls[0]?.[0]?.[1] as {
        $facet?: { birthYears?: Array<{ $group?: unknown }> };
      }
    )?.$facet?.birthYears?.[1]?.$group;
    expect(birthYearGroup).toEqual(
      expect.objectContaining({
        other: expect.any(Object),
        missing: expect.any(Object),
      })
    );
  });

  it('projects a later-page Mongoose document with an empty optional address', async () => {
    mockAuthenticatedUser(true);
    const laterPageMember = User.hydrate(
      userDocument({ _id: '507f1f77bcf86cd799439099' })
    );
    expect(laterPageMember.address).toBeDefined();
    mockSuccessfulQueries({ users: [laterPageMember], total: 21 });

    const response = await request(createApp())
      .get('/api/users/filter?page=2&pageSize=20')
      .set('Cookie', tokenFor())
      .set('Origin', FIRST_PARTY_ORIGIN);

    expect(response.status).toBe(200);
    expect(response.body.pagination).toEqual({
      page: 2,
      pageSize: 20,
      total: 21,
      totalPages: 2,
      returned: 1,
    });
    expect(response.body.items[0]).not.toHaveProperty('address');
  });

  it('returns a stable empty result contract', async () => {
    mockAuthenticatedUser(true);
    mockSuccessfulQueries();

    const response = await request(createApp())
      .get('/api/users/filter?filter=inactive')
      .set('Cookie', tokenFor())
      .set('Origin', FIRST_PARTY_ORIGIN);

    expect(response.status).toBe(200);
    expect(response.body.items).toEqual([]);
    expect(response.body.pagination).toEqual({
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 0,
      returned: 0,
    });
  });

  it('applies escaped server-side search to the selected projection', async () => {
    mockAuthenticatedUser(true);
    mockSuccessfulQueries();

    const response = await request(createApp())
      .get('/api/users/filter?search=Test%2BMember')
      .set('Cookie', tokenFor())
      .set('Origin', FIRST_PARTY_ORIGIN);

    expect(response.status).toBe(200);
    expect(User.find).toHaveBeenCalledWith(
      expect.objectContaining({
        $or: [
          { firstName: /Test\+Member/i },
          { lastName: /Test\+Member/i },
          { email: /Test\+Member/i },
        ],
      })
    );
  });

  it('composes administrator designation with membership, search, gender, counts, and pagination', async () => {
    mockAuthenticatedUser(true);
    mockSuccessfulQueries();

    const response = await request(createApp())
      .get(
        '/api/users/filter?filter=passive&administratorOnly=true&gender=female&search=Test%2BAdmin&page=2&pageSize=10'
      )
      .set('Cookie', tokenFor())
      .set('Origin', FIRST_PARTY_ORIGIN);

    const baseFilter = {
      accountKind: AccountKind.PERSON,
      administratorDesignation: true,
      membershipStatus: MembershipStatus.PASSIVE,
      $or: [
        { firstName: /Test\+Admin/i },
        { lastName: /Test\+Admin/i },
        { email: /Test\+Admin/i },
      ],
    };
    const selectedFilter = { ...baseFilter, gender: Gender.FEMALE };

    expect(response.status).toBe(200);
    expect(User.find).toHaveBeenCalledWith(selectedFilter);
    expect(User.countDocuments).toHaveBeenNthCalledWith(1, selectedFilter);
    expect(User.countDocuments).toHaveBeenNthCalledWith(2, baseFilter);
    expect(vi.mocked(User.aggregate).mock.calls[0]?.[0]?.[0]).toEqual({
      $match: selectedFilter,
    });
    expect(vi.mocked(User.aggregate).mock.calls[1]?.[0]?.[0]).toEqual({
      $match: baseFilter,
    });
  });

  it('treats administratorOnly=false as no designation restriction', async () => {
    mockAuthenticatedUser(true);
    mockSuccessfulQueries();

    const response = await request(createApp())
      .get('/api/users/filter?administratorOnly=false')
      .set('Cookie', tokenFor())
      .set('Origin', FIRST_PARTY_ORIGIN);

    expect(response.status).toBe(200);
    expect(User.find).toHaveBeenCalledWith({
      accountKind: AccountKind.PERSON,
      membershipStatus: {
        $in: [MembershipStatus.ACTIVE, MembershipStatus.PASSIVE],
      },
    });
  });

  it('rejects invalid administratorOnly values', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockAuthenticatedUser(true);
    const find = vi.spyOn(User, 'find');

    const response = await request(createApp())
      .get('/api/users/filter?administratorOnly=yes')
      .set('Cookie', tokenFor())
      .set('Origin', FIRST_PARTY_ORIGIN);

    expect(response.status).toBe(400);
    expect(find).not.toHaveBeenCalled();
  });

  it('calculates gender filter counts before applying the selected gender', async () => {
    mockAuthenticatedUser(true);
    mockUserFind([]);
    vi.spyOn(User, 'countDocuments')
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(10);
    vi.spyOn(User, 'aggregate')
      .mockResolvedValueOnce([
        {
          summary: [
            {
              male: 0,
              female: 4,
              other: 0,
              missing: 0,
              missingBirthDate: 0,
            },
          ],
          birthYears: [],
        },
      ] as never)
      .mockResolvedValueOnce([
        {
          summary: [
            {
              male: 3,
              female: 4,
              other: 2,
              missing: 1,
              missingBirthDate: 1,
            },
          ],
          birthYears: [],
        },
      ] as never);
    vi.spyOn(
      PasswordSetupDeliveryService,
      'setupSummariesForUsers'
    ).mockResolvedValue(new Map());

    const response = await request(createApp())
      .get('/api/users/filter?gender=female')
      .set('Cookie', tokenFor())
      .set('Origin', FIRST_PARTY_ORIGIN);

    expect(response.status).toBe(200);
    expect(User.find).toHaveBeenCalledWith(
      expect.objectContaining({ gender: Gender.FEMALE })
    );
    expect(response.body.statistics.total).toBe(4);
    expect(response.body.genderFilterCounts).toEqual({
      male: 3,
      female: 4,
      other: 2,
      missing: 1,
    });
  });

  it('rejects legacy pending as an explicit membership filter', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockAuthenticatedUser(true);
    const find = vi.spyOn(User, 'find');

    const response = await request(createApp())
      .get('/api/users/filter?filter=pending')
      .set('Cookie', tokenFor())
      .set('Origin', FIRST_PARTY_ORIGIN);

    expect(response.status).toBe(400);
    expect(find).not.toHaveBeenCalled();
  });

  it('returns the dedicated invalid-session envelope without a cookie', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await request(createApp()).get('/api/users/filter');

    expect(response.status).toBe(401);
    expect(response.body).toEqual(
      expect.objectContaining({
        success: false,
        error: 'Session is invalid or expired',
        code: 'SESSION_INVALID',
      })
    );
  });

  it('returns the capability-forbidden envelope for a non-admin user', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockAuthenticatedUser(false);

    const response = await request(createApp())
      .get('/api/users/filter')
      .set('Cookie', tokenFor())
      .set('Origin', FIRST_PARTY_ORIGIN);

    expect(response.status).toBe(403);
    expect(response.body).toEqual(
      expect.objectContaining({
        success: false,
        error: 'Required capability is not available',
        code: 'FORBIDDEN',
      })
    );
  });

  it('uses the safe server-error envelope when the query fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockAuthenticatedUser(true);
    mockUserFind(new Error('database connection details'));

    const response = await request(createApp())
      .get('/api/users/filter')
      .set('Cookie', tokenFor())
      .set('Origin', FIRST_PARTY_ORIGIN);

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      success: false,
      error: 'Internal Server Error',
    });
    expect(response.text).not.toContain('database connection details');
  });
});

describe('GET /api/users/member-export/rich', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('accepts only the explicit export cohort contract', async () => {
    mockAuthenticatedUser(true);
    vi.spyOn(User, 'find').mockReturnValue({
      select: vi.fn().mockReturnValue({
        sort: vi.fn().mockResolvedValue([]),
      }),
    } as never);
    vi.spyOn(Player, 'find').mockResolvedValue([] as never);
    vi.spyOn(Team, 'find').mockReturnValue({
      select: vi.fn().mockResolvedValue([]),
    } as never);

    const response = await request(createApp())
      .get('/api/users/member-export/rich?cohort=all')
      .set('Cookie', tokenFor())
      .set('Origin', FIRST_PARTY_ORIGIN);

    expect(response.status).toBe(200);
    expect(User.find).toHaveBeenCalledWith({
      accountKind: AccountKind.PERSON,
      membershipStatus: {
        $in: [
          MembershipStatus.ACTIVE,
          MembershipStatus.PASSIVE,
          MembershipStatus.INACTIVE,
        ],
      },
    });
    expect(response.body).toEqual({ success: true, items: [] });
  });

  it('rejects Member-list state at the export request boundary', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockAuthenticatedUser(true);
    const find = vi.spyOn(User, 'find');

    const response = await request(createApp())
      .get('/api/users/member-export/rich?cohort=current&search=member')
      .set('Cookie', tokenFor())
      .set('Origin', FIRST_PARTY_ORIGIN);

    expect(response.status).toBe(400);
    expect(find).not.toHaveBeenCalled();
  });
});
