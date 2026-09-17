import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import commonMessages from '../../../messages/en/common.json';
import matchMessages from '../../../messages/en/match.json';

const mocks = vi.hoisted(() => ({
  matches: [] as Array<{ id: string; teamId: string }>,
  isError: false,
  refetch: vi.fn(),
  teamError: false,
  teamHaveData: true,
  refetchTeams: vi.fn(),
  playerError: false,
  playerHaveData: true,
  refetchPlayers: vi.fn(),
  teamLoading: false,
  playerLoading: false,
}));

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: {
      id: '507f1f77bcf86cd799439011',
      playerId: '507f1f77bcf86cd799439012',
      capabilities: [],
    },
  }),
}));

vi.mock('../../services/matchService', () => ({
  MatchService: {
    useUpcomingMatches: () => ({
      data: mocks.matches,
      isLoading: false,
      isError: mocks.isError,
      refetch: mocks.refetch,
    }),
    useSetMatchAvailability: () => ({
      mutateAsync: vi.fn(),
      isPending: false,
    }),
  },
}));

vi.mock('../../services/teamService', () => ({
  TeamService: {
    useTeamList: () => ({
      data: mocks.teamHaveData
        ? [
            {
              id: '507f1f77bcf86cd799439013',
              shortName: 'Team One',
            },
            {
              id: '507f1f77bcf86cd799439014',
              shortName: 'Team Two',
            },
          ]
        : undefined,
      isError: mocks.teamError,
      isLoading: mocks.teamLoading,
      refetch: mocks.refetchTeams,
    }),
  },
}));

vi.mock('../../services/playerService', () => ({
  PlayerService: {
    usePlayerList: () => ({
      data: mocks.playerHaveData ? [] : undefined,
      isError: mocks.playerError,
      isLoading: mocks.playerLoading,
      refetch: mocks.refetchPlayers,
    }),
  },
}));

vi.mock('../../components/Dashboard/modals/MatchDetailsModal', () => ({
  default: () => null,
}));

vi.mock('../../components/Dashboard/MatchCard', () => ({
  default: ({
    match,
    onViewDetails,
  }: {
    match: { id: string };
    onViewDetails?: () => void;
  }) => (
    <div>
      <span>{match.id}</span>
      {onViewDetails && (
        <button onClick={onViewDetails}>View {match.id}</button>
      )}
    </div>
  ),
}));

import UpcomingMatchesTab from '../../components/Dashboard/matchTabs/UpcomingMatchesTab';

describe('Match current-Team scope presentation', () => {
  beforeEach(() => {
    mocks.matches.length = 0;
    mocks.isError = false;
    mocks.refetch.mockReset();
    mocks.teamError = false;
    mocks.teamHaveData = true;
    mocks.playerError = false;
    mocks.playerHaveData = true;
    mocks.teamLoading = false;
    mocks.playerLoading = false;
  });

  it('renders a genuine empty state when the backend returns no scoped Matches', () => {
    render(
      <NextIntlClientProvider
        locale="en"
        messages={{ match: matchMessages, common: commonMessages }}
      >
        <UpcomingMatchesTab />
      </NextIntlClientProvider>
    );

    expect(
      screen.getByText('No upcoming matches are available.')
    ).toBeVisible();
    expect(
      screen.queryByText('No Team One matches on this page.')
    ).not.toBeInTheDocument();
  });

  it('renders the selected-filter empty state when scoped Matches exist for another Team', async () => {
    const user = userEvent.setup();
    mocks.matches.push({
      id: '507f1f77bcf86cd799439015',
      teamId: '507f1f77bcf86cd799439013',
    });

    render(
      <NextIntlClientProvider
        locale="en"
        messages={{ match: matchMessages, common: commonMessages }}
      >
        <UpcomingMatchesTab />
      </NextIntlClientProvider>
    );

    await user.click(screen.getByRole('checkbox', { name: 'Team Two' }));

    expect(
      screen.getByText('No matches found for the selected filter.')
    ).toBeVisible();
    expect(
      screen.queryByText('No matches are available for your current Teams.')
    ).not.toBeInTheDocument();
  });

  it('distinguishes initial failure from a cached background failure', async () => {
    const user = userEvent.setup();
    mocks.isError = true;
    const { rerender } = render(
      <NextIntlClientProvider
        locale="en"
        messages={{ match: matchMessages, common: commonMessages }}
      >
        <UpcomingMatchesTab />
      </NextIntlClientProvider>
    );

    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(mocks.refetch).toHaveBeenCalledOnce();
    expect(
      screen.queryByText('No upcoming matches are available.')
    ).not.toBeInTheDocument();

    mocks.matches.push({
      id: '507f1f77bcf86cd799439015',
      teamId: '507f1f77bcf86cd799439013',
    });
    rerender(
      <NextIntlClientProvider
        locale="en"
        messages={{ match: matchMessages, common: commonMessages }}
      >
        <UpcomingMatchesTab />
      </NextIntlClientProvider>
    );

    expect(
      screen.getByText(
        'The latest matches could not be loaded. Showing the last available data.'
      )
    ).toBeVisible();
    expect(screen.getByText('507f1f77bcf86cd799439015')).toBeVisible();
  });

  it('keeps Match data visible without Team grouping when Team data fails', async () => {
    const user = userEvent.setup();
    mocks.matches.push({
      id: '507f1f77bcf86cd799439015',
      teamId: '507f1f77bcf86cd799439013',
    });
    mocks.teamError = true;
    mocks.teamHaveData = false;

    render(
      <NextIntlClientProvider
        locale="en"
        messages={{ match: matchMessages, common: commonMessages }}
      >
        <UpcomingMatchesTab />
      </NextIntlClientProvider>
    );

    expect(screen.getByText('507f1f77bcf86cd799439015')).toBeVisible();
    expect(
      screen.getByText(/Matches remain visible without Team grouping/)
    ).toBeVisible();
    expect(
      screen.queryByRole('checkbox', { name: 'Team One' })
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(mocks.refetchTeams).toHaveBeenCalledOnce();
  });

  it('keeps Match data visible while initial Team facts are loading', () => {
    mocks.matches.push({
      id: '507f1f77bcf86cd799439015',
      teamId: '507f1f77bcf86cd799439013',
    });
    mocks.teamHaveData = false;
    mocks.teamLoading = true;

    render(
      <NextIntlClientProvider
        locale="en"
        messages={{ match: matchMessages, common: commonMessages }}
      >
        <UpcomingMatchesTab />
      </NextIntlClientProvider>
    );

    expect(screen.getByText('507f1f77bcf86cd799439015')).toBeVisible();
    expect(screen.getByText(/Loading Team information/)).toBeVisible();
    expect(
      screen.queryByRole('checkbox', { name: 'Team One' })
    ).not.toBeInTheDocument();
  });

  it('keeps Match data visible but withholds Player-dependent details while loading', () => {
    mocks.matches.push({
      id: '507f1f77bcf86cd799439015',
      teamId: '507f1f77bcf86cd799439013',
    });
    mocks.playerHaveData = false;
    mocks.playerLoading = true;

    render(
      <NextIntlClientProvider
        locale="en"
        messages={{ match: matchMessages, common: commonMessages }}
      >
        <UpcomingMatchesTab />
      </NextIntlClientProvider>
    );

    expect(screen.getByText('507f1f77bcf86cd799439015')).toBeVisible();
    expect(screen.getByText(/Loading Player information/)).toBeVisible();
    expect(
      screen.queryByRole('button', { name: /View 507f/ })
    ).not.toBeInTheDocument();
  });
});
