import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MatchListView } from '@club/shared-types/core/enums';
import type { MatchView } from '@club/shared-types/view/match';
import {
  getNextMatchBoundary,
  useMatchBoundaryRefresh,
} from '../../services/matchService';

const now = Date.parse('2026-07-28T12:00:00.000Z');

function card(startAt: string): MatchView.MatchCard {
  return { startAt } as MatchView.MatchCard;
}

function wrapper(queryClient: QueryClient) {
  return function QueryWrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Match list start-boundary refresh', () => {
  it('selects only the earliest future start from all/upcoming data', () => {
    const matches = [
      card('2026-07-28T12:02:00.000Z'),
      card('2026-07-28T11:59:59.999Z'),
      card('2026-07-28T12:01:00.000Z'),
    ];

    expect(getNextMatchBoundary(matches, MatchListView.ALL, now)).toBe(
      Date.parse('2026-07-28T12:01:00.000Z')
    );
    expect(getNextMatchBoundary(matches, MatchListView.UPCOMING, now)).toBe(
      Date.parse('2026-07-28T12:01:00.000Z')
    );
    expect(
      getNextMatchBoundary(matches, MatchListView.HISTORY, now)
    ).toBeUndefined();
    expect(
      getNextMatchBoundary(
        [card('2026-07-28T11:59:59.999Z')],
        MatchListView.ALL,
        now
      )
    ).toBeUndefined();
  });

  it('invalidates at the earliest boundary and replaces and clears its timer', () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const queryClient = new QueryClient();
    const invalidate = vi
      .spyOn(queryClient, 'invalidateQueries')
      .mockResolvedValue(undefined);
    const firstMatches = [
      card('2026-07-28T12:02:00.000Z'),
      card('2026-07-28T12:01:00.000Z'),
    ];
    const { rerender, unmount } = renderHook(
      ({ matches, view }) => useMatchBoundaryRefresh(matches, view),
      {
        initialProps: {
          matches: firstMatches,
          view: MatchListView.UPCOMING,
        },
        wrapper: wrapper(queryClient),
      }
    );

    expect(vi.getTimerCount()).toBe(1);
    act(() => vi.advanceTimersByTime(60_025));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['matches', 'list'] });

    invalidate.mockClear();
    rerender({
      matches: [card('2026-07-28T12:03:00.000Z')],
      view: MatchListView.ALL,
    });
    expect(vi.getTimerCount()).toBe(1);

    rerender({
      matches: [card('2026-07-28T12:03:00.000Z')],
      view: MatchListView.HISTORY,
    });
    expect(vi.getTimerCount()).toBe(0);
    expect(invalidate).not.toHaveBeenCalled();

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
