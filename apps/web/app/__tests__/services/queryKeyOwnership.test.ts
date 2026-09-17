import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  invalidateQueries: vi.fn(),
  queryOptions: [] as Array<{ queryKey: readonly unknown[] }>,
}));

vi.mock('@tanstack/react-query', () => ({
  keepPreviousData: (data: unknown) => data,
  useQuery: (options: { queryKey: readonly unknown[] }) => {
    mocks.queryOptions.push(options);
    return options;
  },
  useMutation: (options: unknown) => options,
  useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
}));

import { AuditService } from '../../services/auditService';
import { MembershipApplicationService } from '../../services/membershipApplicationService';
import { PlayerService } from '../../services/playerService';
import { TeamService } from '../../services/teamService';
import { UserService } from '../../services/userService';

function latestQueryKey() {
  return mocks.queryOptions.at(-1)?.queryKey;
}

describe('feature-owned React Query keys', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.queryOptions.length = 0;
  });

  it('aligns Team detail reads and exact update invalidation', () => {
    TeamService.useTeamDetail('team-1');
    const detailKey = latestQueryKey();

    const update = TeamService.useUpdateTeam() as any;
    update.onSuccess({}, { id: 'team-1', formData: {} });

    expect(detailKey).toEqual(['teams', 'detail', { id: 'team-1' }]);
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: detailKey,
      exact: true,
    });
  });

  it('keeps Team statistics identifiers as structured key data', () => {
    TeamService.useTeamStats('team-1');

    expect(latestQueryKey()).toEqual(['teams', 'stats', { id: 'team-1' }]);
    expect(typeof latestQueryKey()?.[2]).toBe('object');
  });

  it('aligns User profile reads and exact update invalidation', () => {
    UserService.useUserProfile('user-1');
    const profileKey = latestQueryKey();

    const update = UserService.useUpdateUser() as any;
    update.onSuccess({}, { id: 'user-1', formData: {} });

    expect(profileKey).toEqual(['users', 'profile', { id: 'user-1' }]);
    expect(mocks.invalidateQueries.mock.calls[0][0]).toEqual({
      queryKey: ['users', 'list'],
    });
    expect(mocks.invalidateQueries.mock.calls[1][0]).toEqual({
      queryKey: profileKey,
      exact: true,
    });
  });

  it.each([
    [
      'administrator designation',
      () => UserService.useSetAdministratorDesignation(),
    ],
    [
      'membership transition',
      () => UserService.useTransitionMembershipActivity(),
    ],
    ['account suspension', () => UserService.useSuspendAccount()],
    ['account unsuspension', () => UserService.useUnsuspendAccount()],
  ])('keeps broad User invalidation without a redundant profile target for %s', (_name, createMutation) => {
    const mutation = createMutation() as any;

    mutation.onSuccess({}, { id: 'user-1' });

    expect(mocks.invalidateQueries).toHaveBeenCalledTimes(1);
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['users'],
    });
  });

  it('represents changing User and Audit inputs as structured key data', () => {
    const memberQuery = { page: 1, pageSize: 20 };
    UserService.useMemberList(memberQuery);
    expect(latestQueryKey()).toEqual(['users', 'list', memberQuery]);
    UserService.useMemberList({ ...memberQuery, page: 2 });
    expect(latestQueryKey()).toEqual([
      'users',
      'list',
      { ...memberQuery, page: 2 },
    ]);

    const auditFilters = { entityId: 'member-1', limit: 25 };
    AuditService.useAuditLogs(auditFilters);
    expect(latestQueryKey()).toEqual(['audit', 'list', auditFilters]);
    AuditService.useAuditLogs({ ...auditFilters, offset: 25 });
    expect(latestQueryKey()).toEqual([
      'audit',
      'list',
      { ...auditFilters, offset: 25 },
    ]);

    for (const options of mocks.queryOptions) {
      expect(typeof options.queryKey.at(-1)).not.toBe('string');
    }
  });

  it('preserves no-filter tuples and the Membership Application list key', () => {
    UserService.useMemberList();
    expect(latestQueryKey()).toEqual(['users', 'list']);

    PlayerService.usePlayerList();
    expect(latestQueryKey()).toEqual(['players', 'list']);

    AuditService.useAuditLogs();
    expect(latestQueryKey()).toEqual(['audit', 'list']);

    MembershipApplicationService.useApplicationList();
    expect(latestQueryKey()).toEqual(['applications', 'list']);
  });
});
