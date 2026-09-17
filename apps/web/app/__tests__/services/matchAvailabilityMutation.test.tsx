import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Api } from '@club/shared-types/api/match';
import {
  MatchAvailabilityParticipation,
  MatchDirection,
} from '@club/shared-types/core/enums';

const apiMocks = vi.hoisted(() => ({
  setOwn: vi.fn(),
  setPlayer: vi.fn(),
}));

vi.mock('../../lib/api/matchApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/api/matchApi')>()),
  setOwnMatchAvailability: apiMocks.setOwn,
  setPlayerMatchAvailability: apiMocks.setPlayer,
}));

import {
  MatchAvailabilityRefreshError,
  MatchService,
} from '../../services/matchService';

const matchId = '507f1f77bcf86cd799439011';
const playerId = '507f1f77bcf86cd799439012';

function response(version = 8): Api.MatchResponse {
  return {
    id: matchId,
    version,
    teamId: '507f1f77bcf86cd799439013',
    opponentName: 'Visitors',
    direction: MatchDirection.HOME,
    startAt: '2099-08-01T10:00:00.000Z',
    localStart: {
      date: '2099-08-01',
      time: '12:00',
      timeZone: 'Europe/Berlin',
    },
    location: 'Hall',
    lineup: [],
    availability: [
      {
        playerId,
        participation: MatchAvailabilityParticipation.UNAVAILABLE,
      },
    ],
    createdById: '507f1f77bcf86cd799439014',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-29T00:00:00.000Z',
  };
}

function wrapper(queryClient: QueryClient) {
  return function QueryWrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

describe('Match Availability mutation cache boundary', () => {
  beforeEach(() => {
    apiMocks.setOwn.mockReset();
    apiMocks.setPlayer.mockReset();
  });

  it('sends the self contract and commits the authoritative response without optimism', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const committed = response();
    apiMocks.setOwn.mockResolvedValue(committed);
    queryClient.setQueryData(['matches', 'detail', matchId], {
      ...committed,
      version: 7,
      availability: [],
    });
    const { result } = renderHook(
      () => MatchService.useSetMatchAvailability(),
      { wrapper: wrapper(queryClient) }
    );

    await act(() =>
      result.current.mutateAsync({
        kind: 'self',
        matchId,
        expectedVersion: 7,
        participation: MatchAvailabilityParticipation.UNAVAILABLE,
      })
    );

    expect(apiMocks.setOwn).toHaveBeenCalledWith(matchId, {
      expectedVersion: 7,
      participation: MatchAvailabilityParticipation.UNAVAILABLE,
    });
    expect(
      queryClient.getQueryData<{ version: number; availability: unknown[] }>([
        'matches',
        'detail',
        matchId,
      ])
    ).toMatchObject({
      version: 8,
      availability: committed.availability,
    });
  });

  it('awaits the exact-detail refresh, does not replay a conflict, and retries with the refreshed version', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const conflict = new Error('conflict');
    apiMocks.setPlayer
      .mockRejectedValueOnce(conflict)
      .mockResolvedValueOnce(response(9));
    queryClient.setQueryData(['matches', 'detail', matchId], response(7));
    const detailRefresh = deferred();
    const invalidate = vi
      .spyOn(queryClient, 'invalidateQueries')
      .mockImplementation((filters) => {
        if (filters.exact) {
          return detailRefresh.promise.then(() => {
            queryClient.setQueryData(
              ['matches', 'detail', matchId],
              response(8)
            );
          });
        }
        return Promise.resolve();
      });
    const { result } = renderHook(
      () => MatchService.useSetMatchAvailability(),
      { wrapper: wrapper(queryClient) }
    );

    let mutationPromise!: Promise<Api.MatchResponse>;
    let mutationSettled = false;
    act(() => {
      mutationPromise = result.current.mutateAsync({
        kind: 'admin',
        matchId,
        playerId,
        expectedVersion: 7,
        participation: MatchAvailabilityParticipation.AVAILABLE,
      });
      void mutationPromise
        .finally(() => {
          mutationSettled = true;
        })
        .catch(() => undefined);
    });

    await waitFor(() => expect(apiMocks.setPlayer).toHaveBeenCalledTimes(1));
    expect(result.current.isPending).toBe(true);
    expect(mutationSettled).toBe(false);
    expect(apiMocks.setPlayer).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ['matches', 'list'],
    });
    expect(invalidate).toHaveBeenCalledWith(
      {
        queryKey: ['matches', 'detail', matchId],
        exact: true,
      },
      { throwOnError: true }
    );

    let receivedError: unknown;
    await act(async () => {
      detailRefresh.resolve();
      receivedError = await mutationPromise.catch((error) => error);
    });

    expect(receivedError).toBe(conflict);
    expect(mutationSettled).toBe(true);
    expect(apiMocks.setPlayer).toHaveBeenCalledTimes(1);
    const refreshedMatch = queryClient.getQueryData<{ version: number }>([
      'matches',
      'detail',
      matchId,
    ]);
    expect(refreshedMatch?.version).toBe(8);

    await act(() =>
      result.current.mutateAsync({
        kind: 'admin',
        matchId,
        playerId,
        expectedVersion: refreshedMatch?.version ?? -1,
        participation: MatchAvailabilityParticipation.AVAILABLE,
      })
    );

    expect(apiMocks.setPlayer).toHaveBeenNthCalledWith(2, matchId, playerId, {
      expectedVersion: 8,
      participation: MatchAvailabilityParticipation.AVAILABLE,
    });
  });

  it('surfaces a distinct error when the exact-detail refresh fails', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const conflict = new Error('conflict');
    const refreshFailure = new Error('refresh failed');
    apiMocks.setOwn.mockRejectedValue(conflict);
    vi.spyOn(queryClient, 'invalidateQueries').mockImplementation((filters) =>
      filters.exact ? Promise.reject(refreshFailure) : Promise.resolve()
    );
    const { result } = renderHook(
      () => MatchService.useSetMatchAvailability(),
      { wrapper: wrapper(queryClient) }
    );

    let receivedError: unknown;
    await act(async () => {
      receivedError = await result.current
        .mutateAsync({
          kind: 'self',
          matchId,
          expectedVersion: 7,
          participation: MatchAvailabilityParticipation.UNAVAILABLE,
        })
        .catch((error) => error);
    });

    expect(receivedError).toBeInstanceOf(MatchAvailabilityRefreshError);
    expect(receivedError).toMatchObject({
      mutationError: conflict,
      refreshError: refreshFailure,
    });
    expect(apiMocks.setOwn).toHaveBeenCalledTimes(1);
  });
});
