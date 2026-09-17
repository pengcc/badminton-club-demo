import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ approve: vi.fn(), invalidate: vi.fn() }));
vi.mock('@tanstack/react-query', () => ({
  useMutation: (options: unknown) => options,
  useQuery: vi.fn(),
  useQueryClient: () => ({ invalidateQueries: mocks.invalidate }),
}));
vi.mock('@app/lib/api/membershipApplicationApi', () => ({
  approveMembershipApplication: mocks.approve,
}));

import { MembershipApplicationService } from '@app/services/membershipApplicationService';

describe('application approval mutation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.approve.mockResolvedValue({ data: {} });
  });

  it('retains one key for ambiguous retries and invalidates application and member reads', async () => {
    const mutation =
      MembershipApplicationService.useApproveApplication() as unknown as {
        mutationFn(value: {
          id: string;
          reviewNote?: string;
          approvalMessage?: string;
          idempotencyKey?: string;
        }): Promise<unknown>;
        retry(count: number, error: unknown): boolean;
        onSuccess(): void;
      };
    const variables = {
      id: 'application-1',
      reviewNote: 'Internal',
      approvalMessage: 'Welcome',
    };
    mocks.approve.mockRejectedValueOnce(new Error('response lost'));
    await expect(mutation.mutationFn(variables)).rejects.toThrow(
      'response lost'
    );
    const key = mocks.approve.mock.calls[0][3];
    expect(mutation.retry(0, new Error('response lost'))).toBe(true);
    await mutation.mutationFn(variables);
    expect(mocks.approve.mock.calls[1][3]).toBe(key);
    mutation.onSuccess();
    expect(mocks.invalidate).toHaveBeenCalledWith({
      queryKey: ['applications'],
    });
    expect(mocks.invalidate).toHaveBeenCalledWith({ queryKey: ['users'] });
    expect(mocks.invalidate).toHaveBeenCalledWith({ queryKey: ['members'] });
  });
});
