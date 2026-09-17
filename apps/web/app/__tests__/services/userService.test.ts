import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AccountOnboardingStatus,
  AccountKind,
  Gender,
  MemberListFilter,
  MembershipStatus,
} from '@club/shared-types/core/enums';
import type { Api } from '@club/shared-types/api/user';
import { UserService } from '../../services/userService';
import * as userApi from '../../lib/api/userApi';

vi.mock('@tanstack/react-query', () => ({
  useMutation: (configuration: {
    mutationFn: (input: unknown) => unknown;
  }) => ({
    mutateAsync: configuration.mutationFn,
  }),
  useQuery: vi.fn(),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock('../../lib/api/userApi', () => ({
  getMemberList: vi.fn(),
  getRichMemberExport: vi.fn(),
  requestEmailChange: vi.fn(),
}));

const apiUser: Api.UserResponse = {
  id: 'user-1',
  email: 'user@example.test',
  firstName: 'Test',
  lastName: 'User',
  fullName: 'User, Test',
  gender: Gender.MALE,
  dateOfBirth: '1990-01-01',
  accountKind: AccountKind.PERSON,
  administratorDesignation: false,
  membershipStatus: MembershipStatus.ACTIVE,
  accountOnboardingStatus: AccountOnboardingStatus.READY,
  isPlayer: false,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const response: Api.MemberListResponse = {
  success: true,
  appliedFilter: MemberListFilter.CURRENT,
  items: [
    {
      ...apiUser,
      accountSetup: {
        userId: 'user-1',
        accountOnboardingStatus: AccountOnboardingStatus.READY,
        deliveryStatus: 'none',
        reissueAvailable: false,
      },
    },
  ],
  pagination: {
    page: 1,
    pageSize: 20,
    total: 25,
    totalPages: 2,
    returned: 1,
  },
  statistics: {
    total: 25,
    gender: { male: 10, female: 12, other: 2, missing: 1 },
    birthYears: [{ year: 1990, male: 2, female: 3, other: 1, missing: 1 }],
    missingBirthDate: 3,
  },
  genderFilterCounts: { male: 10, female: 12, other: 2, missing: 1 },
};

describe('UserService.getMemberList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('preserves the shared contract while transforming returned items', async () => {
    vi.mocked(userApi.getMemberList).mockResolvedValue(response);

    await expect(
      UserService.getMemberList({
        filter: MemberListFilter.CURRENT,
        page: 1,
        pageSize: 20,
      })
    ).resolves.toEqual({
      ...response,
      items: [
        expect.objectContaining({ id: 'user-1', fullName: 'User, Test' }),
      ],
    });
  });

  it('rejects a malformed response instead of treating it as empty data', async () => {
    vi.mocked(userApi.getMemberList).mockResolvedValue({
      ...response,
      items: null,
    } as never);

    await expect(UserService.getMemberList()).rejects.toThrow(
      'Invalid member list response'
    );
  });
});

describe('UserService.getRichMemberExport', () => {
  it('delegates only the explicit export cohort to the User API adapter', async () => {
    const exportResponse: Api.RichMemberExportResponse = {
      success: true,
      items: [],
    };
    vi.mocked(userApi.getRichMemberExport).mockResolvedValue(exportResponse);

    await expect(
      UserService.getRichMemberExport({ cohort: 'all' })
    ).resolves.toEqual(exportResponse);
    expect(userApi.getRichMemberExport).toHaveBeenCalledWith({ cohort: 'all' });
  });
});

describe('UserService.useRequestEmailChange', () => {
  it('delegates the workflow-owned request to the User API adapter', async () => {
    const request = { newEmail: 'next@example.test', locale: 'zh' as const };
    vi.mocked(userApi.requestEmailChange).mockResolvedValue({
      pendingEmail: request.newEmail,
    });

    const mutation = UserService.useRequestEmailChange() as unknown as {
      mutateAsync: (input: typeof request) => Promise<{ pendingEmail: string }>;
    };

    await expect(mutation.mutateAsync(request)).resolves.toEqual({
      pendingEmail: request.newEmail,
    });
    expect(userApi.requestEmailChange).toHaveBeenCalledWith(request);
  });
});
