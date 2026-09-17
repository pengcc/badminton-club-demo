import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requestTermination: vi.fn(),
  approveTermination: vi.fn(),
  rejectTermination: vi.fn(),
  recordOfflineTermination: vi.fn(),
  recordTerminationBatch: vi.fn(),
  invalidateQueries: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useMutation: (options: unknown) => options,
  useQuery: vi.fn(),
  useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
}));
vi.mock('../../lib/api/membershipTerminationApi', () => mocks);

import { MembershipTerminationService } from '../../services/membershipTerminationService';

interface MutationOptions<T> {
  mutationFn(variables: T): Promise<unknown>;
  retry(failureCount: number, error: unknown): boolean;
  onSuccess(data: unknown, variables: T): void;
}

describe('membership termination web retry identity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.values(mocks).forEach((mock) => mock.mockResolvedValue({}));
  });

  it.each([
    {
      hook: () => MembershipTerminationService.useRequest(),
      variables: { request: { effectiveDate: '2026-09-30' } },
      api: mocks.requestTermination,
      keyIndex: 1,
    },
    {
      hook: () => MembershipTerminationService.useApprove(),
      variables: {
        id: 'termination-1',
        request: {
          effectiveTiming: 'scheduled' as const,
        },
      },
      api: mocks.approveTermination,
      keyIndex: 2,
    },
    {
      hook: () => MembershipTerminationService.useReject(),
      variables: {
        id: 'termination-1',
        request: { reason: 'Not approved' },
      },
      api: mocks.rejectTermination,
      keyIndex: 2,
    },
    {
      hook: () => MembershipTerminationService.useRecordOffline(),
      variables: {
        request: {
          userId: 'user-1',
          source: 'email' as const,
          requestReceivedAt: '2026-08-01T10:00:00.000Z',
          effectiveTiming: 'scheduled' as const,
          effectiveDate: '2026-09-30',
        },
      },
      api: mocks.recordOfflineTermination,
      keyIndex: 1,
    },
    {
      hook: () => MembershipTerminationService.useRecordBatch(),
      variables: {
        request: {
          userIds: ['user-1'],
          effectiveTiming: 'scheduled' as const,
          effectiveDate: '2026-09-30',
        },
      },
      api: mocks.recordTerminationBatch,
      keyIndex: 1,
    },
  ])('retains one key across an ambiguous retry', async (testCase) => {
    const mutation = testCase.hook() as unknown as MutationOptions<
      typeof testCase.variables & { idempotencyKey?: string }
    >;
    const variables = { ...testCase.variables };
    const failure = new Error('response lost');
    testCase.api.mockRejectedValueOnce(failure);

    await expect(mutation.mutationFn(variables)).rejects.toBe(failure);
    const key = testCase.api.mock.calls[0][testCase.keyIndex];
    expect(mutation.retry(0, failure)).toBe(true);
    await mutation.mutationFn(variables);
    expect(testCase.api.mock.calls[1][testCase.keyIndex]).toBe(key);
    expect(variables.idempotencyKey).toBe(key);
  });

  it.each([
    {
      hook: () => MembershipTerminationService.useApprove(),
      variables: {
        id: 'termination-1',
        request: { effectiveTiming: 'today' as const, note: 'Reason' },
      },
    },
    {
      hook: () => MembershipTerminationService.useRecordOffline(),
      variables: {
        request: {
          userId: 'user-1',
          source: 'email' as const,
          requestReceivedAt: '2026-08-01T10:00:00.000Z',
          effectiveTiming: 'today' as const,
          note: 'Reason',
        },
      },
    },
    {
      hook: () => MembershipTerminationService.useRecordBatch(),
      variables: {
        request: {
          userIds: ['user-1'],
          effectiveTiming: 'today' as const,
          note: 'Reason',
        },
      },
    },
  ])('invalidates lifecycle projections after a Today outcome', (testCase) => {
    const mutation = testCase.hook() as unknown as MutationOptions<
      typeof testCase.variables
    >;

    mutation.onSuccess({}, testCase.variables);

    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['membership-terminations'],
    });
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['users'],
    });
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['players'],
    });
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['matches'],
    });
  });

  it('invalidates only the termination family after rejection', () => {
    const mutation =
      MembershipTerminationService.useReject() as unknown as MutationOptions<{
        id: string;
        request: { reason: string };
      }>;
    mutation.onSuccess(
      {},
      {
        id: 'termination-1',
        request: { reason: 'Not approved' },
      }
    );
    expect(mocks.invalidateQueries).toHaveBeenCalledTimes(1);
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['membership-terminations'],
    });
  });
});
