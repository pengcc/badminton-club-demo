import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  updateUser: vi.fn(),
  deletePlayer: vi.fn(),
  batchUpdatePlayers: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useMutation: (options: unknown) => options,
  useQuery: vi.fn(),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock('@club/shared-types/view/transformers/user', () => ({
  UserViewTransformers: {
    toUpdateRequest: (value: unknown) => value,
    toUserCard: (value: unknown) => value,
  },
}));
vi.mock('../../lib/api/userApi', () => ({
  updateUser: mocks.updateUser,
}));
vi.mock('../../lib/api/playerApi', () => ({
  deletePlayer: mocks.deletePlayer,
  batchUpdatePlayers: mocks.batchUpdatePlayers,
}));

import { PlayerService } from '../../services/playerService';
import { UserService } from '../../services/userService';

interface MutationOptions<TVariables> {
  mutationFn(variables: TVariables): Promise<unknown>;
  retry?: (failureCount: number, error: unknown) => boolean;
}

describe('membership lifecycle web retry identity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateUser.mockResolvedValue({});
    mocks.deletePlayer.mockResolvedValue({});
    mocks.batchUpdatePlayers.mockResolvedValue({});
  });

  it.each([
    {
      name: 'single Player eligibility suspension',
      hook: () => PlayerService.useDeletePlayer(),
      variables: { id: 'player-1' },
      api: mocks.deletePlayer,
      keyIndex: 1,
    },
    {
      name: 'Player batch update',
      hook: () => PlayerService.useBatchUpdatePlayers(),
      variables: {
        playerIds: ['player-1'],
        updates: { isActivePlayer: false },
      },
      api: mocks.batchUpdatePlayers,
      keyIndex: 1,
    },
  ])('reuses one key for an ambiguous $name retry', async (testCase) => {
    const mutation = testCase.hook() as unknown as MutationOptions<
      typeof testCase.variables & { idempotencyKey?: string }
    >;
    const variables = { ...testCase.variables };
    const ambiguousFailure = new Error('response lost');
    testCase.api.mockRejectedValueOnce(ambiguousFailure);

    await expect(mutation.mutationFn(variables)).rejects.toBe(ambiguousFailure);
    const firstKey = testCase.api.mock.calls[0][testCase.keyIndex];

    expect(mutation.retry?.(0, ambiguousFailure)).toBe(true);
    await mutation.mutationFn(variables);
    expect(testCase.api.mock.calls[1][testCase.keyIndex]).toBe(firstKey);
    expect(variables.idempotencyKey).toBe(firstKey);
  });

  it('keeps ordinary profile correction explicitly retryable without lifecycle identity', async () => {
    const mutation = UserService.useUpdateUser() as unknown as MutationOptions<{
      id: string;
      formData: Record<string, never>;
    }>;
    await mutation.mutationFn({ id: 'user-1', formData: {} });
    expect(mutation.retry).toBeUndefined();
    expect(mocks.updateUser).toHaveBeenCalledWith('user-1', {});
  });
});
