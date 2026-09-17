import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MatchDirection, MatchOutcome } from '@club/shared-types/core/enums';
import type { Match, Team } from '../../lib/types';
import matchMessages from '../../../messages/en/match.json';

const mocks = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  refetch: vi.fn(),
  isPending: false,
  latestMatch: undefined as Match | undefined,
}));

vi.mock('../../services/matchService', () => ({
  MatchService: {
    useSetResult: () => ({
      mutateAsync: mocks.mutateAsync,
      isPending: mocks.isPending,
    }),
    useMatchDetails: () => ({
      data: mocks.latestMatch,
      refetch: mocks.refetch,
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

import MatchResultModal from '../../components/Dashboard/modals/MatchResultModal';
import MatchCard from '../../components/Dashboard/MatchCard';

const team = {
  id: 'team-1',
  shortName: 'Club Team',
} as Team;

const match: Match = {
  id: 'match-1',
  version: 4,
  teamId: team.id,
  opponentName: 'Visitors',
  direction: MatchDirection.AWAY,
  startAt: '2026-07-01T18:00:00.000Z',
  localStart: {
    date: '2026-07-01',
    time: '20:00',
    timeZone: 'Europe/Berlin',
  },
  location: 'Hall',
  result: {
    homeScore: 2,
    awayScore: 4,
    note: 'Original note',
    outcome: MatchOutcome.WIN,
  },
  lineup: [],
  availability: [],
  createdById: 'admin-1',
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-07-01T20:00:00.000Z',
  clubTeamName: 'Club Team',
  scoreDisplay: '2 - 4',
  dateTimeDisplay: '2026-07-01 20:00',
  isUpcoming: false,
  isToday: false,
  isTomorrow: false,
  daysRemaining: -1,
};

const newerMatch: Match = {
  ...match,
  version: 5,
  direction: MatchDirection.HOME,
  result: {
    homeScore: 6,
    awayScore: 7,
    note: 'Latest note',
    outcome: MatchOutcome.LOSS,
  },
  scoreDisplay: '6 - 7',
  updatedAt: '2026-07-01T20:05:00.000Z',
};

function resultElement(currentMatch: Match = match) {
  return (
    <NextIntlClientProvider locale="en" messages={{ match: matchMessages }}>
      <MatchResultModal
        isOpen
        onClose={vi.fn()}
        match={currentMatch}
        teams={[team]}
      />
    </NextIntlClientProvider>
  );
}

function renderResult(currentMatch: Match = match) {
  return render(resultElement(currentMatch));
}

describe('Match result task', () => {
  beforeEach(() => {
    mocks.mutateAsync.mockReset();
    mocks.refetch.mockReset();
    mocks.isPending = false;
    mocks.latestMatch = undefined;
  });

  it('uses official home/away order and submits the authorized version', async () => {
    mocks.mutateAsync.mockResolvedValue(match);
    const user = userEvent.setup();
    renderResult();

    expect(screen.getByLabelText('Visitors')).toHaveValue(2);
    expect(screen.getByLabelText('Club Team')).toHaveValue(4);
    const note = screen.getByLabelText('Note (optional)');
    await user.clear(note);
    await user.type(note, 'Corrected note');
    await user.click(screen.getByRole('button', { name: 'Save result' }));

    expect(mocks.mutateAsync).toHaveBeenCalledWith({
      id: match.id,
      result: {
        expectedVersion: 4,
        homeScore: 2,
        awayScore: 4,
        note: 'Corrected note',
      },
    });
  });

  it('retains entered values when saving fails', async () => {
    mocks.mutateAsync.mockRejectedValue(new Error('failed'));
    const user = userEvent.setup();
    renderResult();

    const homeScore = screen.getByLabelText('Visitors');
    await user.clear(homeScore);
    await user.type(homeScore, '5');
    await user.click(screen.getByRole('button', { name: 'Save result' }));

    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalled());
    expect(homeScore).toHaveValue(5);
    expect(screen.getByLabelText('Note (optional)')).toHaveValue(
      'Original note'
    );
  });

  it('initializes fields, labels, and version from one newer detail snapshot', async () => {
    mocks.latestMatch = newerMatch;
    mocks.mutateAsync.mockResolvedValue({ ...newerMatch, version: 6 });
    const user = userEvent.setup();
    renderResult();

    expect(screen.getByLabelText('Club Team')).toHaveValue(6);
    expect(screen.getByLabelText('Visitors')).toHaveValue(7);
    expect(screen.getByLabelText('Note (optional)')).toHaveValue('Latest note');
    await user.click(screen.getByRole('button', { name: 'Save result' }));

    expect(mocks.mutateAsync).toHaveBeenCalledWith({
      id: match.id,
      result: {
        expectedVersion: 5,
        homeScore: 6,
        awayScore: 7,
        note: 'Latest note',
      },
    });
  });

  it('keeps conflicting input until an explicit reload replaces the full snapshot', async () => {
    mocks.mutateAsync
      .mockRejectedValueOnce({ response: { status: 409 } })
      .mockResolvedValueOnce({ ...newerMatch, version: 6 });
    mocks.refetch.mockResolvedValue({ data: newerMatch });
    const user = userEvent.setup();
    const view = renderResult();

    const homeScore = screen.getByLabelText('Visitors');
    const note = screen.getByLabelText('Note (optional)');
    await user.clear(homeScore);
    await user.type(homeScore, '8');
    await user.clear(note);
    await user.type(note, 'My correction');
    await user.click(screen.getByRole('button', { name: 'Save result' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Your entered scores and note were kept.'
    );
    expect(homeScore).toHaveValue(8);
    expect(note).toHaveValue('My correction');
    expect(screen.getByRole('button', { name: 'Save result' })).toBeDisabled();

    mocks.latestMatch = newerMatch;
    view.rerender(resultElement());
    expect(homeScore).toHaveValue(8);
    expect(note).toHaveValue('My correction');
    await user.click(screen.getByRole('button', { name: 'Save result' }));
    expect(mocks.mutateAsync).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Load latest match' }));
    await waitFor(() => {
      expect(screen.getByLabelText('Club Team')).toHaveValue(6);
      expect(screen.getByLabelText('Visitors')).toHaveValue(7);
      expect(screen.getByLabelText('Note (optional)')).toHaveValue(
        'Latest note'
      );
    });
    expect(screen.getByRole('button', { name: 'Save result' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Save result' }));
    expect(mocks.mutateAsync).toHaveBeenLastCalledWith({
      id: match.id,
      result: {
        expectedVersion: 5,
        homeScore: 6,
        awayScore: 7,
        note: 'Latest note',
      },
    });
  });

  it('keeps the conflict and user input when reload returns stale data with an error', async () => {
    mocks.mutateAsync.mockRejectedValueOnce({ response: { status: 409 } });
    mocks.refetch.mockResolvedValue({
      data: match,
      error: new Error('offline'),
    });
    const user = userEvent.setup();
    renderResult();

    const homeScore = screen.getByLabelText('Visitors');
    await user.clear(homeScore);
    await user.type(homeScore, '8');
    await user.click(screen.getByRole('button', { name: 'Save result' }));
    await user.click(
      await screen.findByRole('button', { name: 'Load latest match' })
    );

    await waitFor(() => expect(mocks.refetch).toHaveBeenCalledTimes(1));
    expect(homeScore).toHaveValue(8);
    expect(screen.getByRole('alert')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save result' })).toBeDisabled();
  });

  it('shows score, outcome, and note on a History card', () => {
    render(
      <NextIntlClientProvider locale="en" messages={{ match: matchMessages }}>
        <MatchCard match={match} variant="history" />
      </NextIntlClientProvider>
    );

    expect(screen.getByText('Victory')).toBeVisible();
    expect(screen.getByText('Final score: 2 - 4')).toBeVisible();
    expect(screen.getByTestId('match-result-note')).toHaveTextContent(
      'Original note'
    );
  });

  it('does not render an empty History note placeholder', () => {
    render(
      <NextIntlClientProvider locale="en" messages={{ match: matchMessages }}>
        <MatchCard
          match={{
            ...match,
            result: { ...match.result!, note: undefined },
          }}
          variant="history"
        />
      </NextIntlClientProvider>
    );

    expect(screen.queryByTestId('match-result-note')).not.toBeInTheDocument();
  });

  it('keeps the History no-result state when no result exists', () => {
    render(
      <NextIntlClientProvider locale="en" messages={{ match: matchMessages }}>
        <MatchCard
          match={{ ...match, result: undefined, scoreDisplay: '—' }}
          variant="history"
        />
      </NextIntlClientProvider>
    );

    expect(screen.getByText('No result recorded')).toBeVisible();
    expect(screen.queryByTestId('match-result-note')).not.toBeInTheDocument();
  });

  it('offers the separate result task only after the Match start', () => {
    const editResult = vi.fn();
    const { rerender } = render(
      <NextIntlClientProvider locale="en" messages={{ match: matchMessages }}>
        <MatchCard
          match={match}
          variant="management"
          onEditResult={editResult}
        />
      </NextIntlClientProvider>
    );

    expect(
      screen.getByRole('button', { name: 'Correct result' })
    ).toBeInTheDocument();

    rerender(
      <NextIntlClientProvider locale="en" messages={{ match: matchMessages }}>
        <MatchCard
          match={{ ...match, result: undefined, isUpcoming: true }}
          variant="management"
          onEditResult={editResult}
        />
      </NextIntlClientProvider>
    );
    expect(
      screen.queryByRole('button', { name: 'Record result' })
    ).not.toBeInTheDocument();
  });
});
