import React from 'react';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import type { MatchDirection } from '@club/shared-types/core/enums';
import type { MatchView } from '@club/shared-types/view/match';
import matchMessages from '../../../messages/en/match.json';

const matchId = '507f1f77bcf86cd799439011';

const mocks = vi.hoisted(() => ({
  match: {
    id: '507f1f77bcf86cd799439011',
    version: 0,
    teamId: '507f1f77bcf86cd799439012',
    opponentName: 'Visitors',
    direction: 'home' as MatchDirection,
    startAt: '2099-08-01T10:00:00.000Z',
    localStart: {
      date: '2099-08-01',
      time: '12:00',
      timeZone: 'Europe/Berlin' as const,
    },
    location: 'Hall',
    lineup: [],
    lineupWarnings: [],
    availability: [],
    createdById: '507f1f77bcf86cd799439013',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    clubTeamName: 'Home Team',
    scoreDisplay: '—',
  } satisfies MatchView.MatchDetails,
}));

vi.mock('../../services/matchService', () => ({
  MatchService: {
    useMatchDetails: () => ({
      data: mocks.match,
      isLoading: false,
      isError: false,
      isRefetchError: false,
      isFetching: false,
      refetch: vi.fn(),
    }),
    useLineupContext: () => ({
      data: {
        matchId,
        version: 0,
        lineup: [],
        lineupWarnings: [],
        candidates: [],
      },
      isLoading: false,
      isError: false,
      isRefetchError: false,
      isFetching: false,
      refetch: vi.fn(),
    }),
    useUpdateLineup: () => ({
      mutateAsync: vi.fn(),
      isPending: false,
    }),
  },
}));

vi.mock('../../components/ui/modal', () => ({
  Modal: ({
    isOpen,
    children,
  }: {
    isOpen: boolean;
    children: React.ReactNode;
  }) => (isOpen ? <div>{children}</div> : null),
}));

import MatchLineupModal from '../../components/Dashboard/modals/MatchLineupModal';

describe('Match Lineup accessibility', () => {
  it('gives every position slot a distinct accessible combobox name', () => {
    render(
      <NextIntlClientProvider locale="en" messages={{ match: matchMessages }}>
        <MatchLineupModal
          isOpen
          onClose={vi.fn()}
          matchId={matchId}
          teams={[]}
        />
      </NextIntlClientProvider>
    );

    const expectedNames = [
      "Select player for Men's Singles 1, slot 1",
      "Select player for Men's Singles 2, slot 1",
      'Select player for Open Singles, slot 1',
      "Select player for Women's Singles, slot 1",
      "Select player for Men's Doubles, slot 1",
      "Select player for Men's Doubles, slot 2",
      'Select player for Open Doubles, slot 1',
      'Select player for Open Doubles, slot 2',
      "Select player for Women's Doubles, slot 1",
      "Select player for Women's Doubles, slot 2",
      'Select player for Mixed Doubles, slot 1',
      'Select player for Mixed Doubles, slot 2',
    ];

    const comboboxes = screen.getAllByRole('combobox');
    expect(comboboxes).toHaveLength(expectedNames.length);
    expect(new Set(expectedNames).size).toBe(expectedNames.length);
    for (const name of expectedNames) {
      expect(screen.getByRole('combobox', { name })).toBeVisible();
    }
  });
});
