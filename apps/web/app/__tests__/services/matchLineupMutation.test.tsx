import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Api } from '@club/shared-types/api/match';
import { LineupPosition, MatchDirection } from '@club/shared-types/core/enums';

const apiMocks = vi.hoisted(() => ({
  updateLineup: vi.fn(),
}));

vi.mock('../../lib/api/matchApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/api/matchApi')>()),
  updateMatchLineup: apiMocks.updateLineup,
}));

import { MatchService } from '../../services/matchService';

const matchId = '507f1f77bcf86cd799439011';
const playerId = '507f1f77bcf86cd799439012';

function response(): Api.MatchDetailResponse {
  return {
    id: matchId,
    version: 4,
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
    lineup: [
      {
        position: LineupPosition.OPEN_SINGLES,
        playerId,
        playerNameSnapshot: 'Lineup Player',
      },
    ],
    lineupWarnings: [],
    availability: [],
    createdById: '507f1f77bcf86cd799439014',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-30T00:00:00.000Z',
  };
}

function wrapper(queryClient: QueryClient) {
  return function QueryWrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe('Match Lineup mutation cache boundary', () => {
  beforeEach(() => {
    apiMocks.updateLineup.mockReset();
  });

  it('sends the versioned intent, commits detail, and invalidates exact context plus lists', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    apiMocks.updateLineup.mockResolvedValue(response());
    const { result } = renderHook(() => MatchService.useUpdateLineup(), {
      wrapper: wrapper(queryClient),
    });
    const request: Api.SetMatchLineupRequest = {
      expectedVersion: 3,
      lineup: [
        {
          position: LineupPosition.OPEN_SINGLES,
          playerId,
        },
      ],
    };

    await act(() =>
      result.current.mutateAsync({
        matchId,
        request,
      })
    );

    expect(apiMocks.updateLineup).toHaveBeenCalledWith(matchId, request);
    expect(
      queryClient.getQueryData<{ version: number }>([
        'matches',
        'detail',
        matchId,
      ])
    ).toMatchObject({ version: 4 });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ['matches', 'lineup-context', matchId],
      exact: true,
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ['matches', 'list'],
    });
  });
});
