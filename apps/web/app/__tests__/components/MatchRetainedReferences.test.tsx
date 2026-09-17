import React from 'react';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import {
  Gender,
  LineupPosition,
  LineupViolationCode,
  MatchAvailabilityParticipation,
  MatchDirection,
  PlayerType,
} from '@club/shared-types/core/enums';
import type { MatchView } from '@club/shared-types/view/match';
import type { Player } from '../../lib/types';
import matchMessages from '../../../messages/en/match.json';

const mocks = vi.hoisted(() => ({
  match: null as MatchView.MatchDetails | null,
  updateLineup: vi.fn(),
}));

vi.mock('../../services/matchService', () => ({
  MatchService: {
    useMatchDetails: () => ({
      data: mocks.match,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }),
    useLineupContext: () => ({
      data: {
        matchId: 'match-1',
        version: 0,
        lineup: mocks.match?.lineup ?? [],
        lineupWarnings: mocks.match?.lineupWarnings ?? [],
        candidates: [],
      },
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    }),
    useUpdateLineup: () => ({
      mutateAsync: mocks.updateLineup,
      isPending: false,
    }),
    useSetMatchAvailability: () => ({
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

import MatchDetailsModal from '../../components/Dashboard/modals/MatchDetailsModal';
import MatchLineupModal from '../../components/Dashboard/modals/MatchLineupModal';

const retainedPlayer: Player = {
  id: 'player-1',
  userId: 'user-1',
  type: PlayerType.MEMBER,
  userName: 'Retained Player',
  userEmail: 'retained@example.test',
  userGender: Gender.FEMALE,
  singlesRanking: 1,
  doublesRanking: 2,
  rankingDisplay: '1/2',
  isActivePlayer: true,
  teamIds: [],
  matchCount: 1,
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
  displayName: 'Retained Player',
  teams: [],
};

const retainedMatch: MatchView.MatchDetails = {
  id: 'match-1',
  version: 0,
  teamId: 'team-1',
  opponentName: 'Visitors',
  direction: MatchDirection.HOME,
  startAt: '2026-08-01T10:00:00.000Z',
  localStart: {
    date: '2026-08-01',
    time: '12:00',
    timeZone: 'Europe/Berlin',
  },
  location: 'Test Hall',
  createdById: 'admin-1',
  lineup: [
    {
      position: LineupPosition.MEN_SINGLES_1,
      playerId: retainedPlayer.id,
      playerNameSnapshot: 'Retained Player',
    },
  ],
  lineupWarnings: [
    {
      code: LineupViolationCode.PLAYER_NOT_ON_MATCH_TEAM,
      position: LineupPosition.MEN_SINGLES_1,
      playerId: retainedPlayer.id,
    },
  ],
  availability: [
    {
      playerId: retainedPlayer.id,
      participation: MatchAvailabilityParticipation.UNAVAILABLE,
    },
  ],
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
  scoreDisplay: '—',
  clubTeamName: 'Home Team',
  dateTimeDisplay: 'August 1, 2026',
  isUpcoming: true,
  isToday: false,
  isTomorrow: false,
  daysRemaining: 4,
};

function provider(children: React.ReactNode) {
  return (
    <NextIntlClientProvider locale="en" messages={{ match: matchMessages }}>
      {children}
    </NextIntlClientProvider>
  );
}

describe('retained Match references', () => {
  it('keeps an out-of-Team lineup assignment readable in the lineup editor', () => {
    mocks.match = retainedMatch;
    render(
      provider(
        <MatchLineupModal
          isOpen
          onClose={vi.fn()}
          matchId={retainedMatch.id}
          teams={[]}
        />
      )
    );

    expect(screen.getAllByText(/Retained Player/).length).toBeGreaterThan(0);
    expect(
      screen.getByText('A saved player is no longer associated with this team.')
    ).toBeVisible();
  });

  it('shows retained lineup and availability entries in Match details', () => {
    mocks.match = retainedMatch;
    render(
      provider(
        <MatchDetailsModal
          isOpen
          onClose={vi.fn()}
          matchId={retainedMatch.id}
          players={[retainedPlayer]}
          teams={[]}
          isAdmin
        />
      )
    );

    expect(screen.getByText('Retained availability entries')).toBeVisible();
    expect(screen.getAllByText('Retained Player')).toHaveLength(2);
    expect(
      screen.getAllByText(
        'A saved player is no longer associated with this team.'
      )
    ).toHaveLength(1);
  });

  it('shows multiline arrival guidance only when the Match provides it', () => {
    mocks.match = {
      ...retainedMatch,
      arrivalGuidance: 'Use the rear entrance.\nParking is behind the hall.',
    };
    const { rerender } = render(
      provider(
        <MatchDetailsModal
          isOpen
          onClose={vi.fn()}
          matchId={retainedMatch.id}
          players={[]}
          teams={[]}
        />
      )
    );

    expect(screen.getByText('Arrival guidance')).toBeVisible();
    expect(
      screen.getByText('Use the rear entrance. Parking is behind the hall.')
    ).toHaveClass('whitespace-pre-line');

    mocks.match = retainedMatch;
    rerender(
      provider(
        <MatchDetailsModal
          isOpen
          onClose={vi.fn()}
          matchId={retainedMatch.id}
          players={[]}
          teams={[]}
        />
      )
    );
    expect(screen.queryByText('Arrival guidance')).not.toBeInTheDocument();
  });

  it('identifies the affected retained Player beside an assignment warning', () => {
    mocks.match = {
      ...retainedMatch,
      lineup: [
        {
          position: LineupPosition.OPEN_DOUBLES,
          playerId: 'player-1',
          playerNameSnapshot: 'Available Partner',
        },
        {
          position: LineupPosition.OPEN_DOUBLES,
          playerId: 'player-2',
          playerNameSnapshot: 'Unavailable Partner',
        },
      ],
      lineupWarnings: [
        {
          code: LineupViolationCode.PLAYER_UNAVAILABLE,
          position: LineupPosition.OPEN_DOUBLES,
          playerId: 'player-2',
        },
      ],
      availability: [],
    };
    render(
      provider(
        <MatchDetailsModal
          isOpen
          onClose={vi.fn()}
          matchId={retainedMatch.id}
          players={[]}
          teams={[]}
        />
      )
    );

    expect(screen.getByText('Available Partner')).toBeVisible();
    expect(screen.getByText('Unavailable Partner')).toBeVisible();
    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName === 'P' &&
          element.textContent ===
            'Unavailable Partner: A saved player is marked unavailable for this match.'
      )
    ).toBeVisible();
    expect(
      screen.queryByText(
        (_, element) =>
          element?.tagName === 'P' &&
          element.textContent?.startsWith('Available Partner:') === true
      )
    ).not.toBeInTheDocument();
  });
});
