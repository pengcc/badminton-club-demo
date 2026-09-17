import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fixtures = vi.hoisted(() => {
  const teams = [
    { id: 'team-1', shortName: 'Team One' },
    { id: 'team-2', shortName: 'Team Two' },
  ];
  const matches = Array.from({ length: 12 }, (_, index) => ({
    id: `match-${index + 1}`,
    teamId: index % 2 === 0 ? 'team-1' : 'team-2',
    clubTeamName: index % 2 === 0 ? 'Team One' : 'Team Two',
    opponentName: `Opponent ${index + 1}`,
    location: 'Club hall',
    startAt: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
    localStart: {
      date: `2026-01-${String(index + 1).padStart(2, '0')}`,
      time: '19:00',
    },
    version: 0,
  }));

  return {
    teams,
    matches,
    managementMatches: matches,
    teamLoading: false,
    teamHaveData: true,
    playerLoading: false,
    playerHaveData: true,
  };
});

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const messages: Record<string, string> = {
      title: 'Match Management',
      'views.historyTitle': 'Match History',
      'views.allMatches': 'All Matches',
      'views.allYears': 'All years',
      'views.selectYear': 'Select year',
      'views.searchPlaceholder': 'Search matches',
      'views.importCsv': 'Import CSV',
      'modals.scheduleMatch.title': 'Schedule match',
      'common.teamLoading': 'Loading Team information.',
    };
    return messages[key] ?? key;
  },
}));

vi.mock('@app/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'admin-1', accountKind: 'person' } }),
}));
vi.mock('@app/lib/access/permissions', () => ({ isAdmin: () => true }));
vi.mock('@app/services/matchService', () => ({
  MatchService: {
    useHistoryMatches: () => ({
      data: fixtures.matches,
      availableYears: ['2026'],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }),
    useMatchList: () => ({
      data: fixtures.managementMatches,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }),
    useDeleteMatch: () => ({ mutateAsync: vi.fn() }),
  },
}));
vi.mock('@app/services/teamService', () => ({
  TeamService: {
    useTeamList: () => ({
      data: fixtures.teamHaveData ? fixtures.teams : undefined,
      isLoading: fixtures.teamLoading,
      isError: false,
    }),
  },
}));
vi.mock('@app/services/playerService', () => ({
  PlayerService: {
    usePlayerList: () => ({
      data: fixtures.playerHaveData ? [] : undefined,
      isLoading: fixtures.playerLoading,
      isError: false,
    }),
  },
}));
vi.mock('@app/components/ui/Pagination', () => ({
  Pagination: ({
    currentPage,
    onPageChange,
  }: {
    currentPage: number;
    onPageChange: (page: number) => void;
  }) => (
    <div>
      <span data-testid="current-page">{currentPage}</span>
      <button type="button" onClick={() => onPageChange(2)}>
        Go to page 2
      </button>
    </div>
  ),
}));
vi.mock('@app/components/Dashboard/MatchCard', () => ({
  default: ({ match }: { match: { id: string } }) => <div>{match.id}</div>,
}));
vi.mock('@app/components/ui/confirm-dialog', () => ({
  ConfirmDialog: () => null,
  useConfirmDialog: () => ({ confirm: vi.fn(), confirmProps: {} }),
}));
vi.mock('@app/components/Dashboard/modals/MatchDetailsModal', () => ({
  default: () => null,
}));
vi.mock('@app/components/Dashboard/modals/MatchLineupModal', () => ({
  default: () => null,
}));
vi.mock('@app/components/Dashboard/modals/ScheduleMatchModal', () => ({
  default: () => null,
}));
vi.mock('@app/components/Dashboard/modals/EditMatchModal', () => ({
  default: () => null,
}));
vi.mock('@app/components/Dashboard/modals/MatchResultModal', () => ({
  default: () => null,
}));
vi.mock('@app/components/Dashboard/modals/CSVUploadModal', () => ({
  CSVUploadModal: () => null,
}));

import MatchHistoryTab from '@app/components/Dashboard/matchTabs/MatchHistoryTab';
import MatchManagementTab from '@app/components/Dashboard/matchTabs/MatchManagementTab';

afterEach(() => {
  fixtures.managementMatches = fixtures.matches;
});

it('renders same-Team management Matches in ascending startAt order', () => {
  fixtures.managementMatches = [
    '2027-03-21',
    '2027-02-11',
    '2027-03-07',
    '2027-02-24',
  ].map((date) => ({
    ...fixtures.matches[0],
    id: `match-${date}`,
    startAt: `${date}T18:00:00.000Z`,
    localStart: { date, time: '19:00' },
  }));

  render(<MatchManagementTab />);

  expect(
    screen.getAllByText(/^match-/).map((card) => card.textContent)
  ).toEqual([
    'match-2027-02-11',
    'match-2027-02-24',
    'match-2027-03-07',
    'match-2027-03-21',
  ]);
});

describe.each([
  ['Match History', MatchHistoryTab],
  ['Match Management', MatchManagementTab],
] as const)('%s Team filters', (_name, Component) => {
  beforeEach(() => {
    vi.clearAllMocks();
    fixtures.teamLoading = false;
    fixtures.teamHaveData = true;
    fixtures.playerLoading = false;
    fixtures.playerHaveData = true;
  });

  it('supports select, multi-select, deselect, All Matches, and page reset', async () => {
    const user = userEvent.setup();
    render(<Component />);

    const allMatches = screen.getByRole('checkbox', { name: 'All Matches' });
    const teamOne = screen.getByRole('checkbox', { name: 'Team One' });
    const teamTwo = screen.getByRole('checkbox', { name: 'Team Two' });
    const page = () => screen.getByTestId('current-page');

    expect(allMatches).toHaveAttribute('aria-checked', 'true');
    await user.click(screen.getByRole('button', { name: 'Go to page 2' }));
    expect(page()).toHaveTextContent('2');

    await user.click(teamOne);
    expect(teamOne).toHaveAttribute('aria-checked', 'true');
    expect(allMatches).toHaveAttribute('aria-checked', 'false');
    expect(page()).toHaveTextContent('1');

    await user.click(teamTwo);
    expect(teamOne).toHaveAttribute('aria-checked', 'true');
    expect(teamTwo).toHaveAttribute('aria-checked', 'true');

    await user.click(teamOne);
    expect(teamOne).toHaveAttribute('aria-checked', 'false');
    expect(teamTwo).toHaveAttribute('aria-checked', 'true');

    await user.click(screen.getByRole('button', { name: 'Go to page 2' }));
    expect(page()).toHaveTextContent('2');
    await user.click(allMatches);

    expect(allMatches).toHaveAttribute('aria-checked', 'true');
    expect(teamOne).toHaveAttribute('aria-checked', 'false');
    expect(teamTwo).toHaveAttribute('aria-checked', 'false');
    expect(page()).toHaveTextContent('1');
  });
});

describe('Match History supporting-query loading', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fixtures.teamLoading = true;
    fixtures.teamHaveData = false;
    fixtures.playerLoading = false;
    fixtures.playerHaveData = true;
  });

  it('renders Matches flat while initial Team facts are loading', () => {
    render(<MatchHistoryTab />);

    expect(screen.getByText('match-1')).toBeVisible();
    expect(screen.getByText('Loading Team information.')).toBeVisible();
    expect(
      screen.queryByRole('checkbox', { name: 'Team One' })
    ).not.toBeInTheDocument();
  });
});
