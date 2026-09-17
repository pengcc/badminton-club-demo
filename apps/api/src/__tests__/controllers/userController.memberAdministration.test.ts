import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AccountKind,
  AccountOnboardingStatus,
  Gender,
  MembershipStatus,
  PlayerType,
} from '@club/shared-types/core/enums';
import { UserController } from '../../controllers/userController';
import { Player } from '../../models/Player';
import { Team } from '../../models/Team';
import { User } from '../../models/User';

function userDocument(overrides: Record<string, unknown> = {}) {
  return {
    _id: '507f1f77bcf86cd799439011',
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

function response(cohort: 'current' | 'all') {
  const json = vi.fn();
  return {
    locals: { validatedQuery: { cohort } },
    status: vi.fn(() => ({ json })),
    json,
  };
}

describe('UserController member-administration projections', () => {
  afterEach(() => vi.restoreAllMocks());

  it('exports active and passive Memberships for the current cohort', async () => {
    vi.spyOn(User, 'find').mockReturnValue({
      select: vi.fn().mockReturnValue({
        sort: vi.fn().mockResolvedValue([]),
      }),
    } as never);
    vi.spyOn(Player, 'find').mockResolvedValue([] as never);
    vi.spyOn(Team, 'find').mockReturnValue({
      select: vi.fn().mockResolvedValue([]),
    } as never);
    const res = response('current');

    await UserController.getRichMemberExport({} as never, res as never);

    expect(User.find).toHaveBeenCalledWith({
      accountKind: AccountKind.PERSON,
      membershipStatus: {
        $in: [MembershipStatus.ACTIVE, MembershipStatus.PASSIVE],
      },
    });
  });

  it('keeps a Member without a Player in the export', async () => {
    const member = userDocument();
    vi.spyOn(User, 'find').mockReturnValue({
      select: vi.fn().mockReturnValue({
        sort: vi.fn().mockResolvedValue([member]),
      }),
    } as never);
    vi.spyOn(Player, 'find').mockResolvedValue([] as never);
    vi.spyOn(Team, 'find').mockReturnValue({
      select: vi.fn().mockResolvedValue([]),
    } as never);
    const res = response('current');

    await UserController.getRichMemberExport({} as never, res as never);

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      items: [
        expect.objectContaining({
          userId: String(member._id),
          email: 'member@example.test',
          firstName: 'Test',
          lastName: 'Member',
          player: undefined,
        }),
      ],
    });
  });

  it('includes retained inactive Members and bounded Player context in the all cohort', async () => {
    const member = userDocument({
      phone: '+49 30 1234',
      address: {
        street: 'Example 1',
        postalCode: '10115',
        city: 'Berlin',
        country: 'DE',
      },
      membershipStatus: MembershipStatus.INACTIVE,
    });
    vi.spyOn(User, 'find').mockReturnValue({
      select: vi.fn().mockReturnValue({
        sort: vi.fn().mockResolvedValue([member]),
      }),
    } as never);
    vi.spyOn(Player, 'find').mockResolvedValue([
      {
        _id: '607f1f77bcf86cd799439011',
        userId: member._id,
        type: PlayerType.EXTERNAL,
        isActivePlayer: true,
        singlesRanking: 3,
        doublesRanking: 5,
        teamIds: ['707f1f77bcf86cd799439011'],
      },
    ] as never);
    vi.spyOn(Team, 'find').mockReturnValue({
      select: vi
        .fn()
        .mockResolvedValue([
          { _id: '707f1f77bcf86cd799439011', shortName: 'A1' },
        ]),
    } as never);
    const res = response('all');

    await UserController.getRichMemberExport({} as never, res as never);

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
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      items: [
        expect.objectContaining({
          userId: String(member._id),
          email: 'member@example.test',
          phone: '+49 30 1234',
          membershipStatus: MembershipStatus.INACTIVE,
          player: expect.objectContaining({
            type: PlayerType.EXTERNAL,
            teamNames: ['A1'],
          }),
        }),
      ],
    });
    expect(res.json.mock.calls[0]?.[0].items[0]).not.toHaveProperty('password');
  });
});
