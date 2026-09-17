import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Gender, MembershipStatus } from '@club/shared-types/core/enums';
import { AccountOnboardingTargetKind } from '@club/shared-types/domain/accountOnboarding';

const mocks = vi.hoisted(() => ({
  invalidate: vi.fn(),
  establishAccount: vi.fn(),
  reissueAccountSetup: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
  useMutation: (configuration: unknown) => configuration,
  useQueryClient: () => ({ invalidateQueries: mocks.invalidate }),
}));

vi.mock('../../lib/api/userApi', () => ({
  establishAccount: mocks.establishAccount,
  reissueAccountSetup: mocks.reissueAccountSetup,
}));

import { UserService } from '../../services/userService';

const identity = {
  email: 'member@example.test',
  firstName: 'Test',
  lastName: 'Member',
  dateOfBirth: '1990-01-01',
  gender: Gender.FEMALE,
};

describe('Account Establishment service projection ownership', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    [false, [['users']]],
    [true, [['users'], ['players'], ['matches', 'lineup-context']]],
  ] as const)('preserves Member establishPlayer=%s and invalidates affected projections', async (establishPlayer, expectedKeys) => {
    const hook = UserService.useEstablishAccount() as any;
    const variables = {
      request: {
        ...identity,
        targetKind: AccountOnboardingTargetKind.MEMBER,
        initialMembershipStatus: MembershipStatus.PASSIVE,
        establishPlayer,
      },
      idempotencyKey: 'member-intent-key',
    };
    const response = { userId: 'user-1' };
    mocks.establishAccount.mockResolvedValue(response);

    await expect(hook.mutationFn(variables)).resolves.toBe(response);
    hook.onSuccess(response, variables);

    expect(mocks.establishAccount).toHaveBeenCalledWith(
      variables.request,
      'member-intent-key'
    );
    expect(mocks.invalidate.mock.calls.map(([call]) => call.queryKey)).toEqual(
      expectedKeys
    );
  });

  it('retries one no-response failure with the unchanged intent and key', async () => {
    const hook = UserService.useEstablishAccount() as any;
    const variables = {
      request: {
        ...identity,
        targetKind: AccountOnboardingTargetKind.MEMBER,
        initialMembershipStatus: MembershipStatus.ACTIVE,
        establishPlayer: false,
        sendPasswordSetupEmailNow: false,
      },
      idempotencyKey: 'stable-retry-key',
    };

    expect(hook.retry(0, new Error('socket closed'))).toBe(true);
    expect(hook.retry(1, new Error('socket closed again'))).toBe(false);
    expect(hook.retry(0, { response: { status: 500 } })).toBe(false);

    mocks.establishAccount.mockResolvedValue({ userId: 'user-1' });
    await hook.mutationFn(variables);
    await hook.mutationFn(variables);
    expect(mocks.establishAccount).toHaveBeenNthCalledWith(
      1,
      variables.request,
      'stable-retry-key'
    );
    expect(mocks.establishAccount).toHaveBeenNthCalledWith(
      2,
      variables.request,
      'stable-retry-key'
    );
  });

  it('invalidates Player and Lineup candidate projections for External Player establishment', () => {
    const hook = UserService.useEstablishAccount() as any;
    const variables = {
      request: {
        ...identity,
        targetKind: AccountOnboardingTargetKind.EXTERNAL_PLAYER,
        establishPlayer: true as const,
      },
      idempotencyKey: 'external-player-key',
    };

    hook.onSuccess({}, variables);

    expect(mocks.invalidate).toHaveBeenCalledTimes(2);
    expect(mocks.invalidate).toHaveBeenCalledWith({ queryKey: ['players'] });
    expect(mocks.invalidate).toHaveBeenCalledWith({
      queryKey: ['matches', 'lineup-context'],
    });
  });

  it('refreshes both possible setup projections after canonical reissue', () => {
    const hook = UserService.useReissueAccountSetup() as any;

    hook.onSuccess();

    expect(mocks.invalidate.mock.calls.map(([call]) => call.queryKey)).toEqual([
      ['users'],
      ['players'],
    ]);
  });
});
