import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Api } from '@club/shared-types/api/match';
import {
  Gender,
  LineupPosition,
  LineupViolationCode,
  MatchAvailabilityParticipation,
  MatchDirection,
} from '@club/shared-types/core/enums';
import type { MatchView } from '@club/shared-types/view/match';
import matchMessages from '../../../messages/en/match.json';

const mocks = vi.hoisted(() => ({
  context: null as Api.LineupContextResponse | null,
  match: null as MatchView.MatchDetails | null,
  mutate: vi.fn(),
  refetchContext: vi.fn(),
  refetchMatch: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock('../../services/matchService', () => ({
  MatchService: {
    useMatchDetails: () => ({
      data: mocks.match,
      isLoading: false,
      isError: false,
      refetch: mocks.refetchMatch,
    }),
    useLineupContext: () => ({
      data: mocks.context,
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: mocks.refetchContext,
    }),
    useUpdateLineup: () => ({
      mutateAsync: mocks.mutate,
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

vi.mock('../../components/ui/select', () => ({
  Select: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SelectItem: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SelectValue: () => null,
}));

vi.mock('sonner', () => ({
  toast: {
    error: mocks.toastError,
    success: mocks.toastSuccess,
  },
}));

import MatchLineupModal from '../../components/Dashboard/modals/MatchLineupModal';

const matchId = '507f1f77bcf86cd799439011';
const men = '507f1f77bcf86cd799439012';
const woman = '507f1f77bcf86cd799439013';

function match(): MatchView.MatchDetails {
  return {
    id: matchId,
    version: 3,
    teamId: '507f1f77bcf86cd799439014',
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
        position: LineupPosition.OPEN_DOUBLES,
        playerId: men,
        playerNameSnapshot: 'Men Player',
      },
      {
        position: LineupPosition.OPEN_DOUBLES,
        playerId: woman,
        playerNameSnapshot: 'Woman Player',
      },
    ],
    lineupWarnings: [],
    availability: [],
    createdById: '507f1f77bcf86cd799439015',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    clubTeamName: 'Home Team',
    scoreDisplay: '—',
  };
}

function context(version = 3): Api.LineupContextResponse {
  return {
    matchId,
    version,
    lineup: match().lineup,
    lineupWarnings: [],
    candidates: [
      {
        playerId: men,
        playerName: 'Men Player',
        gender: Gender.MALE,
        singlesRanking: 20,
        doublesRanking: 2,
        participation: MatchAvailabilityParticipation.AVAILABLE,
      },
      {
        playerId: woman,
        playerName: 'Woman Player',
        gender: Gender.FEMALE,
        singlesRanking: 1,
        doublesRanking: 3,
        participation: MatchAvailabilityParticipation.AVAILABLE,
      },
    ],
  };
}

function renderLineup() {
  return render(
    <NextIntlClientProvider locale="en" messages={{ match: matchMessages }}>
      <MatchLineupModal isOpen onClose={vi.fn()} matchId={matchId} teams={[]} />
    </NextIntlClientProvider>
  );
}

describe('Match Lineup editor', () => {
  beforeEach(() => {
    mocks.match = match();
    mocks.context = context();
    mocks.mutate.mockReset();
    mocks.refetchContext.mockReset();
    mocks.refetchMatch.mockReset();
    mocks.toastError.mockReset();
    mocks.toastSuccess.mockReset();
  });

  it('renders the fixed positions, contextual ranks, pair sums, and server candidate pool', () => {
    renderLineup();

    expect(screen.getByText("Men's Singles 1")).toBeVisible();
    expect(screen.getByText('Open Singles')).toBeVisible();
    expect(screen.getByText("Men's Doubles")).toBeVisible();
    expect(screen.getByText('Open Doubles')).toBeVisible();
    expect(screen.getByText('Pair ranking: 5')).toBeVisible();
    expect(screen.getAllByText(/Woman Player · 1/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Woman Player · 3/).length).toBeGreaterThan(0);
    expect(screen.queryByText('Unavailable Player')).not.toBeInTheDocument();
    expect(screen.queryByText(/continue anyway/i)).not.toBeInTheDocument();
  });

  it('preserves its draft on conflict and requires an explicit latest reset', async () => {
    const user = userEvent.setup();
    const conflict = {
      isAxiosError: true,
      response: { status: 409 },
    };
    mocks.mutate.mockRejectedValue(conflict);
    mocks.refetchContext.mockResolvedValue({ data: context(4) });
    mocks.refetchMatch.mockResolvedValue({ data: { ...match(), version: 4 } });
    renderLineup();

    await user.click(screen.getByRole('button', { name: 'Save Lineup' }));
    expect(mocks.mutate).toHaveBeenCalledWith({
      matchId,
      request: {
        expectedVersion: 3,
        lineup: context().lineup.map(({ position, playerId }) => ({
          position,
          playerId,
        })),
      },
    });
    expect(screen.getByText(/Your draft is preserved/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save Lineup' })).toBeDisabled();

    await user.click(
      screen.getByRole('button', { name: 'Load latest lineup' })
    );
    expect(mocks.refetchContext).toHaveBeenCalledTimes(1);
    expect(mocks.refetchMatch).toHaveBeenCalledTimes(1);
  });

  it('keeps conflict recovery blocked when the latest context cannot be loaded', async () => {
    const user = userEvent.setup();
    mocks.mutate.mockRejectedValue({
      isAxiosError: true,
      response: { status: 409 },
    });
    mocks.refetchContext.mockRejectedValue(new Error('context refresh failed'));
    mocks.refetchMatch.mockResolvedValue({
      data: { ...match(), version: 4 },
    });
    renderLineup();

    await user.click(screen.getByRole('button', { name: 'Save Lineup' }));
    await user.click(
      screen.getByRole('button', { name: 'Load latest lineup' })
    );

    expect(mocks.refetchContext).toHaveBeenCalledWith({
      throwOnError: true,
    });
    expect(mocks.refetchMatch).toHaveBeenCalledWith({
      throwOnError: true,
    });
    expect(screen.getByText(/Your draft is preserved/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save Lineup' })).toBeDisabled();
    expect(mocks.mutate).toHaveBeenCalledTimes(1);
    expect(mocks.toastError).toHaveBeenLastCalledWith(
      'The latest lineup could not be loaded.'
    );
  });

  it('does not accept a refreshed context when Match detail refresh fails', async () => {
    const user = userEvent.setup();
    mocks.mutate.mockRejectedValue({
      isAxiosError: true,
      response: { status: 409 },
    });
    mocks.refetchContext.mockResolvedValue({ data: context(4) });
    mocks.refetchMatch.mockRejectedValue(new Error('match refresh failed'));
    renderLineup();

    await user.click(screen.getByRole('button', { name: 'Save Lineup' }));
    await user.click(
      screen.getByRole('button', { name: 'Load latest lineup' })
    );

    expect(screen.getByText(/Your draft is preserved/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save Lineup' })).toBeDisabled();
    expect(mocks.toastError).toHaveBeenLastCalledWith(
      'The latest lineup could not be loaded.'
    );
  });

  it('keeps structured backend violations visible against the local draft', async () => {
    const user = userEvent.setup();
    mocks.mutate.mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 400,
        data: {
          code: 'LINEUP_VALIDATION_FAILED',
          details: {
            violations: [
              {
                code: LineupViolationCode.PLAYER_EVENT_LIMIT_EXCEEDED,
                playerId: men,
                positions: [
                  LineupPosition.MEN_SINGLES_1,
                  LineupPosition.MENS_DOUBLES,
                  LineupPosition.OPEN_DOUBLES,
                ],
              },
            ],
          },
        },
      },
    });
    renderLineup();

    await user.click(screen.getByRole('button', { name: 'Save Lineup' }));

    expect(
      screen.getAllByText('A player is assigned to more than two events.')
        .length
    ).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Save Lineup' })).toBeEnabled();
  });
});
