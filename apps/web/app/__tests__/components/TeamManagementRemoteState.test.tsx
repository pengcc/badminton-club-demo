import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import dashboardMessagesDe from '../../../messages/de/dashboard.json';
import dashboardMessages from '../../../messages/en/dashboard.json';
import dashboardMessagesZh from '../../../messages/zh/dashboard.json';

const mocks = vi.hoisted(() => ({
  teamsError: false,
  teamsHaveData: true,
  statsError: false,
  statsHaveData: true,
  statsData: { total: 0, male: 0, female: 0, nonBinary: 0 },
  isAdmin: false,
  refetchTeams: vi.fn(),
  refetchStats: vi.fn(),
}));

vi.mock('@app/hooks/useAuth', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('@app/lib/access/permissions', () => ({
  isAdmin: () => mocks.isAdmin,
}));
vi.mock('@app/services/teamService', () => ({
  TeamService: {
    useTeamList: () => ({
      data: mocks.teamsHaveData
        ? [
            {
              id: 'team-1',
              shortName: 'Team One',
              leagueTeamName: 'League Team',
            },
          ]
        : undefined,
      isLoading: false,
      isError: mocks.teamsError,
      refetch: mocks.refetchTeams,
    }),
    useTeamStats: () => ({
      data: mocks.statsHaveData ? mocks.statsData : undefined,
      isLoading: false,
      isError: mocks.statsError,
      refetch: mocks.refetchStats,
    }),
    useDeleteTeam: () => ({ mutateAsync: vi.fn() }),
  },
}));
vi.mock('@app/components/Dashboard/modals/CreateTeamModal', () => ({
  default: () => null,
}));
vi.mock('@app/components/Dashboard/modals/EditTeamModal', () => ({
  default: () => null,
}));
vi.mock('@app/components/ui/confirm-dialog', () => ({
  ConfirmDialog: () => null,
  useConfirmDialog: () => ({ confirm: vi.fn(), confirmProps: {} }),
}));

import TeamManagementTab from '@app/components/Dashboard/matchTabs/TeamManagementTab';

function renderTeamManagementTab() {
  return render(
    <NextIntlClientProvider
      locale="en"
      messages={{ dashboard: dashboardMessages }}
    >
      <TeamManagementTab />
    </NextIntlClientProvider>
  );
}

describe('TeamManagementTab remote state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.teamsError = false;
    mocks.teamsHaveData = true;
    mocks.statsError = false;
    mocks.statsHaveData = true;
    mocks.statsData = { total: 0, male: 0, female: 0, nonBinary: 0 };
    mocks.isAdmin = false;
  });

  it('does not present an initial Team failure as a genuine empty list', () => {
    mocks.teamsError = true;
    mocks.teamsHaveData = false;

    renderTeamManagementTab();

    expect(screen.getByText('Teams could not be loaded')).toBeVisible();
    expect(screen.queryByText('No teams found')).not.toBeInTheDocument();
  });

  it('keeps the Team card and distinguishes unavailable stats from successful zero', () => {
    mocks.statsError = true;
    mocks.statsHaveData = false;

    renderTeamManagementTab();

    expect(screen.getByText('Team One')).toBeVisible();
    expect(screen.getByText('Team statistics are unavailable.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeVisible();
    expect(screen.queryByText('Unavailable')).not.toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('shows every present supported category and omits zero categories', () => {
    mocks.statsData = { total: 3, male: 1, female: 0, nonBinary: 2 };

    renderTeamManagementTab();

    expect(
      screen.getByRole('heading', { name: 'Team One', level: 3 })
    ).toBeVisible();
    expect(screen.getByText('Total Players')).toBeVisible();
    expect(screen.getByText('3')).toBeVisible();
    expect(screen.getByText('Male')).toBeVisible();
    expect(screen.getByText('1')).toBeVisible();
    expect(screen.getByText('Non-binary')).toBeVisible();
    expect(screen.getByText('2')).toBeVisible();
    expect(screen.queryByText('Female')).not.toBeInTheDocument();
  });

  it('keeps a successful zero total distinct from unavailable data', () => {
    renderTeamManagementTab();

    expect(screen.getByText('0')).toBeVisible();
    expect(screen.queryByText('Male')).not.toBeInTheDocument();
    expect(screen.queryByText('Female')).not.toBeInTheDocument();
    expect(screen.queryByText('Non-binary')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Team statistics are unavailable.')
    ).not.toBeInTheDocument();
  });

  it('keeps cached summary values visible when a background refresh fails', () => {
    mocks.statsData = { total: 4, male: 1, female: 1, nonBinary: 2 };
    mocks.statsError = true;

    renderTeamManagementTab();

    expect(screen.getByText('4')).toBeVisible();
    expect(screen.getByText('Non-binary')).toBeVisible();
    expect(
      screen.getByText(
        'Team statistics could not be refreshed. Showing the last loaded values.'
      )
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeVisible();
  });

  it('names Team actions with their visible target and hides decorative icons', () => {
    mocks.isAdmin = true;

    renderTeamManagementTab();

    const editButton = screen.getByRole('button', {
      name: 'Edit team Team One',
    });
    const deleteButton = screen.getByRole('button', {
      name: 'Delete team Team One',
    });

    expect(editButton.querySelector('svg')).toHaveAttribute(
      'aria-hidden',
      'true'
    );
    expect(deleteButton.querySelector('svg')).toHaveAttribute(
      'aria-hidden',
      'true'
    );
  });

  it('keeps target-aware Team action messages in every supported locale', () => {
    expect(dashboardMessagesDe.teamManagement).toMatchObject({
      editNamed: expect.any(String),
      deleteNamed: expect.any(String),
    });
    expect(dashboardMessagesZh.teamManagement).toMatchObject({
      editNamed: expect.any(String),
      deleteNamed: expect.any(String),
    });
  });
});
