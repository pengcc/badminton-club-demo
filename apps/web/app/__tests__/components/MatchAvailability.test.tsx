import React from 'react';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  Gender,
  MatchAvailabilityParticipation,
  MatchDirection,
  PlayerType,
} from '@club/shared-types/core/enums';
import type { Match, Player } from '../../lib/types';
import matchMessages from '../../../messages/en/match.json';
import deMessages from '../../../messages/de/match.json';
import zhMessages from '../../../messages/zh/match.json';

const mocks = vi.hoisted(() => {
  class MatchAvailabilityRefreshError extends Error {
    constructor(
      readonly mutationError: unknown,
      readonly refreshError: unknown
    ) {
      super('refresh failed');
      this.name = 'MatchAvailabilityRefreshError';
    }
  }

  return {
    match: null as Match | null,
    mutateAsync: vi.fn(),
    refetch: vi.fn(),
    isPending: false,
    success: vi.fn(),
    error: vi.fn(),
    MatchAvailabilityRefreshError,
  };
});

vi.mock('../../services/matchService', () => ({
  MatchAvailabilityRefreshError: mocks.MatchAvailabilityRefreshError,
  MatchService: {
    useMatchDetails: () => ({ data: mocks.match, refetch: mocks.refetch }),
    useSetMatchAvailability: () => ({
      mutateAsync: mocks.mutateAsync,
      isPending: mocks.isPending,
    }),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: mocks.success,
    error: mocks.error,
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
import MatchCard from '../../components/Dashboard/MatchCard';

const teamId = '507f1f77bcf86cd799439010';

function player(
  suffix: number,
  name: string,
  teamIds: string[] = [teamId]
): Player {
  return {
    id: `507f1f77bcf86cd7994390${suffix.toString().padStart(2, '0')}`,
    userId: `607f1f77bcf86cd7994390${suffix.toString().padStart(2, '0')}`,
    type: PlayerType.MEMBER,
    userName: name,
    userEmail: `${name.toLowerCase().replaceAll(' ', '.')}@example.test`,
    userGender: suffix % 2 === 0 ? Gender.FEMALE : Gender.MALE,
    singlesRanking: suffix,
    doublesRanking: suffix,
    rankingDisplay: `${suffix}/${suffix}`,
    isActivePlayer: true,
    teamIds,
    matchCount: 0,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    displayName: name,
    teams: [],
  };
}

const ownPlayer = player(1, 'Own Player');
const explicitAvailable = player(2, 'Explicit Available');
const defaultAvailable = player(3, 'Default Available');
const explicitUnavailable = player(4, 'Explicit Unavailable');
const otherUnavailable = player(5, 'Other Unavailable');
const retainedPlayer = player(6, 'Retained Player', []);
const allPlayers = [
  ownPlayer,
  explicitAvailable,
  defaultAvailable,
  explicitUnavailable,
  otherUnavailable,
  retainedPlayer,
];

function availability(
  target: Player,
  participation: MatchAvailabilityParticipation
) {
  return {
    playerId: target.id,
    participation,
  };
}

function match(
  startAt = '2099-08-01T10:00:00.000Z',
  entries: Match['availability'] = []
): Match {
  return {
    id: '507f1f77bcf86cd799439099',
    version: 7,
    teamId,
    opponentName: 'Visitors',
    direction: MatchDirection.HOME,
    startAt,
    localStart: {
      date: '2099-08-01',
      time: '12:00',
      timeZone: 'Europe/Berlin',
    },
    location: 'Test Hall',
    createdById: '507f1f77bcf86cd799439098',
    lineup: [],
    availability: entries,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    scoreDisplay: '—',
    clubTeamName: 'Home Team',
    dateTimeDisplay: 'August 1, 2099',
    isUpcoming: true,
    isToday: false,
    isTomorrow: false,
    daysRemaining: 1,
  };
}

function renderDetails({
  isAdmin = false,
  players = allPlayers,
  locale = 'en',
  messages = matchMessages,
  currentUserId = ownPlayer.userId,
}: {
  isAdmin?: boolean;
  players?: Player[];
  locale?: string;
  messages?: typeof matchMessages;
  currentUserId?: string;
} = {}) {
  return render(
    <NextIntlClientProvider locale={locale} messages={{ match: messages }}>
      <MatchDetailsModal
        isOpen
        onClose={vi.fn()}
        matchId={mocks.match?.id ?? null}
        players={players}
        teams={[]}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
      />
    </NextIntlClientProvider>
  );
}

describe('explicit Match Availability', () => {
  beforeEach(() => {
    mocks.match = match();
    mocks.mutateAsync.mockReset();
    mocks.mutateAsync.mockResolvedValue(undefined);
    mocks.refetch.mockReset();
    mocks.refetch.mockResolvedValue({ data: mocks.match });
    mocks.success.mockReset();
    mocks.error.mockReset();
    mocks.isPending = false;
    HTMLElement.prototype.hasPointerCapture = () => false;
    HTMLElement.prototype.setPointerCapture = () => {};
    HTMLElement.prototype.releasePointerCapture = () => {};
    HTMLElement.prototype.scrollIntoView = () => {};
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps self first and reveals other candidates as read-only secondary detail', async () => {
    mocks.match = match('2099-08-01T10:00:00.000Z', [
      availability(explicitAvailable, MatchAvailabilityParticipation.AVAILABLE),
      availability(defaultAvailable, MatchAvailabilityParticipation.AVAILABLE),
      availability(
        explicitUnavailable,
        MatchAvailabilityParticipation.UNAVAILABLE
      ),
      availability(
        otherUnavailable,
        MatchAvailabilityParticipation.UNAVAILABLE
      ),
      availability(retainedPlayer, MatchAvailabilityParticipation.UNAVAILABLE),
    ]);

    renderDetails();

    expect(screen.queryByText('Retained Player')).not.toBeInTheDocument();
    expect(screen.queryByText('Explicit Available')).not.toBeInTheDocument();
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Show other candidates (4)' }));
    expect(screen.getByText('Retained availability entries')).toBeVisible();
    expect(screen.getByText('Retained Player')).toBeVisible();
    expect(screen.getAllByText('Available')).toHaveLength(2);
    expect(screen.getAllByText('Unavailable').length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText('Confirmed')).not.toBeInTheDocument();
    expect(screen.queryByText('Pending')).not.toBeInTheDocument();
    expect(
      screen.getAllByRole('group', { name: /Availability for/ })
    ).toHaveLength(1);
    expect(
      screen.getByRole('button', { name: 'I’m available' })
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it.each([
    [
      MatchAvailabilityParticipation.AVAILABLE,
      MatchAvailabilityParticipation.UNAVAILABLE,
      'I can’t play',
    ],
    [
      MatchAvailabilityParticipation.UNAVAILABLE,
      MatchAvailabilityParticipation.AVAILABLE,
      'I’m available',
    ],
  ])('changes own %s to %s with one action', async (current, next, label) => {
    mocks.match = match(undefined, [availability(ownPlayer, current)]);
    const user = userEvent.setup();
    renderDetails({ players: [ownPlayer] });
    await user.click(screen.getByRole('button', { pressed: true }));
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: label }));
    expect(mocks.mutateAsync).toHaveBeenCalledExactlyOnceWith({
      kind: 'self',
      matchId: mocks.match?.id,
      expectedVersion: 7,
      participation: next,
    });
    expect(mocks.success).toHaveBeenCalledWith('Availability saved.');
  });

  it('disables the Player actions when an open detail crosses the Match start', () => {
    vi.useFakeTimers();
    const startsAt = new Date(Date.now() + 1_000).toISOString();
    mocks.match = match(startsAt);
    renderDetails({ players: [ownPlayer] });

    expect(screen.getByRole('button', { name: 'I’m available' })).toBeEnabled();

    act(() => {
      vi.advanceTimersByTime(1_050);
    });

    expect(
      screen.getByText(
        'Players can no longer change their availability after the match starts.'
      )
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'I’m available' })
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: 'I can’t play' })).toBeDisabled();
  });

  it.each([
    [
      MatchAvailabilityParticipation.AVAILABLE,
      MatchAvailabilityParticipation.UNAVAILABLE,
    ],
    [
      MatchAvailabilityParticipation.UNAVAILABLE,
      MatchAvailabilityParticipation.AVAILABLE,
    ],
  ])('lets administrators change %s to %s after start and disables in-flight actions', async (current, next) => {
    mocks.match = match('2020-08-01T10:00:00.000Z', [
      availability(ownPlayer, current),
    ]);
    const user = userEvent.setup();
    const adminPlayers = [ownPlayer, explicitAvailable];
    const { rerender } = renderDetails({
      isAdmin: true,
      players: adminPlayers,
    });
    await user.click(screen.getByRole('button', { name: 'Edit availability' }));
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /save/i })
    ).not.toBeInTheDocument();
    const row = within(
      within(
        screen.getByRole('list', { name: 'Current candidates (2)' })
      ).getByRole('group', { name: 'Availability for Own Player' })
    );
    await user.click(row.getByRole('button', { pressed: true }));
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
    await user.click(row.getByRole('button', { pressed: false }));
    expect(mocks.mutateAsync).toHaveBeenCalledExactlyOnceWith({
      kind: 'admin',
      matchId: mocks.match?.id,
      playerId: ownPlayer.id,
      expectedVersion: 7,
      participation: next,
    });
    mocks.isPending = true;
    rerender(
      <NextIntlClientProvider locale="en" messages={{ match: matchMessages }}>
        <MatchDetailsModal
          isOpen
          onClose={vi.fn()}
          matchId={mocks.match?.id ?? null}
          players={adminPlayers}
          teams={[]}
          currentUserId={ownPlayer.userId}
          isAdmin
        />
      </NextIntlClientProvider>
    );
    for (const group of screen.getAllByRole('group', {
      name: /Availability for/,
    })) {
      for (const button of within(group).getAllByRole('button'))
        expect(button).toBeDisabled();
    }
  });

  it('keeps committed state on conflict and requires a new action', async () => {
    mocks.mutateAsync.mockRejectedValue({
      isAxiosError: true,
      response: { status: 409 },
    });
    const user = userEvent.setup();
    renderDetails({ isAdmin: true, players: [ownPlayer] });
    await user.click(screen.getByRole('button', { name: 'Edit availability' }));

    await user.click(screen.getByRole('button', { name: 'Unavailable' }));

    await waitFor(() =>
      expect(mocks.error).toHaveBeenCalledWith(
        'This match changed while you were editing. Latest details were loaded; please review and try again.'
      )
    );
    expect(screen.getByRole('button', { name: 'Available' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(mocks.mutateAsync).toHaveBeenCalledTimes(1);
  });

  it('blocks stale availability controls and offers an explicit reload when conflict refresh fails', async () => {
    mocks.mutateAsync.mockRejectedValue(
      new mocks.MatchAvailabilityRefreshError(
        new Error('conflict'),
        new Error('refresh failed')
      )
    );
    const user = userEvent.setup();
    renderDetails({ isAdmin: true, players: [ownPlayer] });
    await user.click(screen.getByRole('button', { name: 'Edit availability' }));

    await user.click(screen.getByRole('button', { name: 'Unavailable' }));

    const refreshMessage =
      'Latest match details could not be loaded. Load the latest match before trying again.';
    await waitFor(() =>
      expect(mocks.error).toHaveBeenCalledWith(refreshMessage)
    );
    expect(screen.getByRole('alert')).toHaveTextContent(refreshMessage);
    expect(screen.getByRole('button', { name: 'Available' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Load latest match' }));

    expect(mocks.refetch).toHaveBeenCalledWith({ throwOnError: true });
    await waitFor(() =>
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    );
    expect(screen.getByRole('button', { name: 'Available' })).toBeEnabled();
  });

  it.each([
    ['en', matchMessages],
    ['de', deMessages],
    ['zh', zhMessages],
  ])('localizes own direct actions in %s', (locale, messages) => {
    renderDetails({ locale, messages, players: [ownPlayer] });
    expect(
      screen.getByRole('button', {
        name: messages.modals.matchDetails.ownAvailable,
      })
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('button', {
        name: messages.modals.matchDetails.ownUnavailable,
      })
    ).toHaveAttribute('aria-pressed', 'false');
  });

  it('keeps committed availability and offers retry after an ordinary failure', async () => {
    mocks.mutateAsync.mockRejectedValue(new Error('failed'));
    const user = userEvent.setup();
    renderDetails({ players: [ownPlayer] });
    await user.click(screen.getByRole('button', { name: 'I can’t play' }));
    expect(mocks.error).toHaveBeenCalledWith(
      'Availability could not be saved. Please try again.'
    );
    expect(
      screen.getByRole('button', { name: 'I’m available' })
    ).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'I can’t play' })).toBeEnabled();
    expect(mocks.success).not.toHaveBeenCalled();
  });

  it('keeps Match Card read-only for Availability', () => {
    const currentMatch = match();
    render(
      <NextIntlClientProvider locale="en" messages={{ match: matchMessages }}>
        <MatchCard
          match={currentMatch}
          variant="upcoming"
          onViewDetails={vi.fn()}
        />
      </NextIntlClientProvider>
    );

    expect(screen.getByRole('button', { name: 'View details' })).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Available' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Unavailable' })
    ).not.toBeInTheDocument();
  });
});

describe('role-aware Availability composition', () => {
  beforeEach(() => {
    mocks.match = match();
    mocks.mutateAsync.mockReset();
    mocks.mutateAsync.mockResolvedValue(undefined);
    mocks.isPending = false;
  });

  it('shows a 13-candidate administrator overview before Lineup, excluding retained entries from counts', async () => {
    const candidates = Array.from({ length: 13 }, (_, i) =>
      player(i + 10, `Candidate ${i + 1}`)
    );
    mocks.match = match(undefined, [
      ...candidates
        .slice(0, 3)
        .map((p) =>
          availability(p, MatchAvailabilityParticipation.UNAVAILABLE)
        ),
      availability(retainedPlayer, MatchAvailabilityParticipation.UNAVAILABLE),
    ]);
    const user = userEvent.setup();
    renderDetails({
      isAdmin: true,
      currentUserId: 'admin-only',
      players: [...candidates, retainedPlayer],
    });
    const summary = screen.getByLabelText('Current candidate summary');
    expect(summary).toHaveTextContent('Candidates13Available10Unavailable3');
    const roster = screen.getByRole('list', {
      name: 'Current candidates (13)',
    });
    expect(within(roster).getAllByRole('listitem')).toHaveLength(13);
    expect(
      screen.queryByRole('group', { name: /Availability for/ })
    ).not.toBeInTheDocument();
    expect(
      screen
        .getByRole('heading', { name: 'Player Availability' })
        .compareDocumentPosition(
          screen.getByRole('heading', { name: 'Lineup' })
        ) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Edit availability' }));
    expect(
      screen.getAllByRole('group', { name: /Availability for/ })
    ).toHaveLength(14);
    const retained = within(
      screen.getByRole('list', { name: 'Retained availability entries' })
    );
    await user.click(retained.getByRole('button', { name: 'Available' }));
    expect(mocks.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'admin', playerId: retainedPlayer.id })
    );
    await user.click(screen.getByRole('button', { name: 'Done editing' }));
    expect(
      screen.queryByRole('group', { name: /Availability for/ })
    ).not.toBeInTheDocument();
  });
});

it('keeps hybrid self-service distinct from explicit administrator correction', async () => {
  mocks.match = match();
  mocks.mutateAsync.mockReset();
  mocks.mutateAsync.mockResolvedValue(undefined);
  mocks.isPending = false;
  const user = userEvent.setup();
  renderDetails({ isAdmin: true });
  expect(
    screen.getAllByRole('group', { name: /Availability for/ })
  ).toHaveLength(1);
  expect(
    screen.getByRole('heading', { name: 'Your availability' })
  ).toBeVisible();
  expect(
    screen.getByRole('heading', { name: 'Team availability (admin view)' })
  ).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'I can’t play' }));
  expect(mocks.mutateAsync).toHaveBeenCalledWith(
    expect.objectContaining({ kind: 'self' })
  );
  await user.click(screen.getByRole('button', { name: 'Edit availability' }));
  const roster = within(
    screen.getByRole('list', { name: 'Current candidates (5)' })
  );
  const own = within(
    roster.getByRole('group', { name: 'Availability for Own Player' })
  );
  await user.click(own.getByRole('button', { name: 'Unavailable' }));
  expect(mocks.mutateAsync).toHaveBeenLastCalledWith(
    expect.objectContaining({ kind: 'admin', playerId: ownPlayer.id })
  );
});

it('resets disclosure and edit mode when the Match target changes', async () => {
  mocks.match = match();
  mocks.isPending = false;
  const user = userEvent.setup();
  const view = renderDetails({ isAdmin: true });
  await user.click(screen.getByRole('button', { name: 'Edit availability' }));
  mocks.match = { ...match(), id: '507f1f77bcf86cd799439097' };
  view.rerender(
    <NextIntlClientProvider locale="en" messages={{ match: matchMessages }}>
      <MatchDetailsModal
        isOpen
        onClose={vi.fn()}
        matchId={mocks.match.id}
        players={allPlayers}
        teams={[]}
        currentUserId={ownPlayer.userId}
        isAdmin
      />
    </NextIntlClientProvider>
  );
  expect(
    screen.getByRole('button', { name: 'Edit availability' })
  ).toHaveAttribute('aria-pressed', 'false');
  expect(
    screen.getAllByRole('group', { name: /Availability for/ })
  ).toHaveLength(1);
});
