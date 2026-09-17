import React from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AccountOnboardingStatus,
  Capability,
  Gender,
  MembershipStatus,
  PlayerType,
  TeamLevel,
} from '@club/shared-types/core/enums';
import type { PlayerView } from '@club/shared-types/view/player';
import type { TeamView } from '@club/shared-types/view/team';
import dashboard from '../../../messages/en/dashboard.json';
import dashboardDe from '../../../messages/de/dashboard.json';
import common from '../../../messages/en/common.json';

const mocks = vi.hoisted(() => ({
  capabilities: [] as string[],
  establish: vi.fn(),
  reissue: vi.fn(),
  recover: vi.fn(),
  batchUpdate: vi.fn(),
  lifecycleBatch: vi.fn(),
  cleanupPlayer: vi.fn(),
  convertFormerMember: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  downloadCsv: vi.fn(),
  refetchPlayers: vi.fn(),
  refetchTeams: vi.fn(),
  refetchCandidates: vi.fn(),
  refetchProfile: vi.fn(),
  profileUserId: vi.fn(),
  playersError: false,
  teamsError: false,
  candidatesError: false,
  playersHaveData: true,
  teamsHaveData: true,
  candidatesHaveData: true,
  teamsLoading: false,
  candidatesLoading: false,
  players: [] as PlayerView.PlayerCard[],
  teams: [] as TeamView.TeamCard[],
  lifecycleCandidates: [] as Array<{
    userId: string;
    userName: string;
    membershipStatus: 'active' | 'passive';
    playerId?: string;
    isParticipationEnabled: boolean;
    isEffectivelyEligible: boolean;
  }>,
  profile: undefined as unknown,
}));

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'viewer', capabilities: mocks.capabilities },
  }),
}));

const player: PlayerView.PlayerCard = {
  id: 'player-record-id',
  userId: 'canonical-user-id',
  type: PlayerType.EXTERNAL,
  userName: 'External Player',
  userEmail: 'external@example.test',
  userGender: Gender.FEMALE,
  singlesRanking: 0,
  doublesRanking: 0,
  rankingDisplay: '0/0',
  isActivePlayer: true,
  membershipStatus: MembershipStatus.INACTIVE,
  isEffectivelyEligible: true,
  teamIds: [],
  matchCount: 0,
  createdAt: '2026-07-19T00:00:00.000Z',
  updatedAt: '2026-07-19T00:00:00.000Z',
  displayName: 'External Player',
  teams: [],
  accountSetup: {
    userId: 'setup-owner-user-id',
    accountOnboardingStatus: AccountOnboardingStatus.PASSWORD_SETUP_PENDING,
    deliveryStatus: 'failed',
    reissueAvailable: true,
  },
};

function teamCard(id: string, shortName: string): TeamView.TeamCard {
  return {
    id,
    teamId: id,
    shortName,
    leagueTeamName: `${shortName} League Team`,
    matchLevel: TeamLevel.C,
    createdById: '507f1f77bcf86cd799439014',
    playerIds: [],
    createdAt: '2026-07-19T00:00:00.000Z',
    updatedAt: '2026-07-19T00:00:00.000Z',
    playerCount: 0,
    players: [],
  };
}

vi.mock('../../services/playerService', () => ({
  PlayerService: {
    usePlayerList: () => ({
      data: mocks.playersHaveData ? mocks.players : undefined,
      isLoading: false,
      isError: mocks.playersError,
      refetch: mocks.refetchPlayers,
    }),
    useBatchUpdatePlayers: () => ({
      mutateAsync: mocks.batchUpdate,
      isPending: false,
    }),
    useLifecycleCandidates: () => ({
      data: mocks.candidatesHaveData ? mocks.lifecycleCandidates : undefined,
      isLoading: mocks.candidatesLoading,
      isError: mocks.candidatesError,
      refetch: mocks.refetchCandidates,
    }),
    useBatchPlayerLifecycle: () => ({
      mutateAsync: mocks.lifecycleBatch,
      isPending: false,
    }),
    useCleanupPlayer: () => ({
      mutateAsync: mocks.cleanupPlayer,
      isPending: false,
    }),
    useConvertFormerMemberToExternal: () => ({
      mutateAsync: mocks.convertFormerMember,
      isPending: false,
    }),
  },
}));

vi.mock('../../services/teamService', () => ({
  TeamService: {
    useTeamList: () => ({
      data: mocks.teamsHaveData ? mocks.teams : undefined,
      isLoading: mocks.teamsLoading,
      isError: mocks.teamsError,
      refetch: mocks.refetchTeams,
    }),
  },
}));

vi.mock('../../services/userService', () => ({
  UserService: {
    useEstablishAccount: () => ({ mutateAsync: mocks.establish }),
    useReissueAccountSetup: () => ({ mutateAsync: mocks.reissue }),
    useRequestPasswordRecovery: () => ({
      mutateAsync: mocks.recover,
      isPending: false,
    }),
    useUserProfile: (id: string) => {
      mocks.profileUserId(id);
      return {
        data: id ? mocks.profile : undefined,
        isError: false,
        refetch: mocks.refetchProfile,
      };
    },
  },
}));

vi.mock('../../components/Dashboard/modals/EditPlayerModal', () => ({
  default: () => null,
}));

vi.mock('../../components/Dashboard/modals/EditMemberModal', () => ({
  default: ({
    member,
    profileOnly,
  }: {
    member: { firstName: string };
    profileOnly?: boolean;
  }) =>
    profileOnly ? (
      <div data-testid="external-player-profile-correction">
        {member.firstName}
      </div>
    ) : null,
}));

vi.mock('sonner', () => ({
  toast: {
    success: mocks.success,
    error: mocks.error,
    warning: mocks.warning,
    info: vi.fn(),
  },
}));

vi.mock('../../lib/utils/csv', () => ({
  downloadCsv: mocks.downloadCsv,
}));

import PlayersTab from '../../components/Dashboard/matchTabs/PlayersTab';

function renderPlayersTab(locale = 'en', dashboardMessages = dashboard) {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={{ dashboard: dashboardMessages, common }}
    >
      <PlayersTab />
    </NextIntlClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  HTMLElement.prototype.hasPointerCapture = () => false;
  HTMLElement.prototype.setPointerCapture = () => {};
  HTMLElement.prototype.releasePointerCapture = () => {};
  HTMLElement.prototype.scrollIntoView = () => {};
  mocks.capabilities = [Capability.ADMINISTRATION];
  mocks.players = [player];
  mocks.teams = [];
  mocks.lifecycleCandidates = [];
  mocks.playersError = false;
  mocks.teamsError = false;
  mocks.candidatesError = false;
  mocks.playersHaveData = true;
  mocks.teamsHaveData = true;
  mocks.candidatesHaveData = true;
  mocks.teamsLoading = false;
  mocks.candidatesLoading = false;
  mocks.profile = {
    id: 'canonical-user-id',
    accountKind: 'person',
    firstName: 'External',
    lastName: 'Player',
  };
  mocks.downloadCsv.mockReturnValue(true);
});

describe('PlayersTab External Player administration', () => {
  it('reaches canonical Person correction from an active External Player without replacing Player controls', async () => {
    const user = userEvent.setup();
    renderPlayersTab();

    expect(
      screen.getByRole('button', { name: 'Edit player teams' })
    ).toBeVisible();
    await user.click(
      screen.getByRole('button', {
        name: 'Correct person profile for External Player',
      })
    );

    expect(mocks.profileUserId).toHaveBeenLastCalledWith('canonical-user-id');
    expect(
      screen.getByTestId('external-player-profile-correction')
    ).toHaveTextContent('External');
  });

  it('renders a compact mobile projection without desktop-only row content', () => {
    const firstTeam = teamCard('team-one', 'First Team');
    const secondTeam = teamCard(
      'team-two',
      'A deliberately long second Team name'
    );
    mocks.teams = [firstTeam, secondTeam];
    mocks.players = [
      {
        ...player,
        userName: 'A deliberately long Player name that must wrap',
        teamIds: [firstTeam.id, secondTeam.id],
        accountSetup: {
          ...player.accountSetup!,
          accountOnboardingStatus: AccountOnboardingStatus.READY,
          deliveryStatus: 'sent',
          reissueAvailable: false,
        },
      },
    ];

    renderPlayersTab();

    const mobileList = within(screen.getByTestId('mobile-players-list'));
    expect(
      mobileList.getByText('A deliberately long Player name that must wrap')
    ).toHaveClass('break-words');
    expect(mobileList.getByText('First Team')).toBeVisible();
    expect(
      mobileList.getByText('A deliberately long second Team name')
    ).toHaveClass('break-words');
    expect(mobileList.queryByText('0/0')).not.toBeInTheDocument();
    expect(mobileList.queryByText('Setup complete')).not.toBeInTheDocument();
    expect(
      mobileList.queryByText('Participation enabled')
    ).not.toBeInTheDocument();
    expect(screen.getByRole('table').parentElement).toHaveClass('hidden');
  });

  it('keeps mobile select-all and individual selection on the existing batch owner', async () => {
    const user = userEvent.setup();
    mocks.players = [
      player,
      {
        ...player,
        id: 'second-player',
        userId: 'second-user',
        userName: 'Second Player',
        accountSetup: undefined,
      },
    ];
    renderPlayersTab();

    const mobileList = within(screen.getByTestId('mobile-players-list'));
    const selectAll = mobileList.getByRole('checkbox', {
      name: 'Select all players',
    });
    await user.click(selectAll);

    expect(
      mobileList.getByRole('checkbox', { name: 'Select External Player' })
    ).toBeChecked();
    expect(
      mobileList.getByRole('checkbox', { name: 'Select Second Player' })
    ).toBeChecked();
    expect(screen.getByText('2 player(s) selected')).toBeVisible();

    await user.click(
      mobileList.getByRole('checkbox', { name: 'Select Second Player' })
    );
    expect(screen.getByText('1 player(s) selected')).toBeVisible();
  });

  it('routes setup, recovery locale, and lifecycle actions through the mobile menu', async () => {
    const user = userEvent.setup();
    mocks.players = [
      {
        ...player,
        passwordRecoveryAvailable: true,
        isActivePlayer: false,
        accountSetup: {
          ...player.accountSetup!,
          accountOnboardingStatus:
            AccountOnboardingStatus.PASSWORD_SETUP_EXPIRED,
        },
      },
    ];
    mocks.reissue.mockResolvedValue({
      generation: 2,
      deliveryStatus: 'sent',
    });
    mocks.recover.mockResolvedValue({ deliveryStatus: 'sent' });
    renderPlayersTab();

    const mobileList = within(screen.getByTestId('mobile-players-list'));
    expect(mobileList.getByText('Setup link expired')).toBeVisible();
    expect(mobileList.getByText('Current delivery failed')).toBeVisible();

    await user.click(
      mobileList.getByRole('button', {
        name: 'Actions for External Player',
      })
    );
    expect(
      screen.getByRole('menuitem', { name: 'Edit player teams' })
    ).toBeVisible();
    expect(
      screen.getByRole('menuitem', {
        name: 'Permanently clean up Player record',
      })
    ).toBeVisible();
    await user.click(
      screen.getByRole('menuitem', { name: 'Reissue setup email' })
    );
    await waitFor(() =>
      expect(mocks.reissue).toHaveBeenCalledWith('setup-owner-user-id')
    );

    await user.click(
      mobileList.getByRole('button', {
        name: 'Actions for External Player',
      })
    );
    await user.hover(screen.getByRole('menuitem', { name: 'Send recovery' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'English' }));
    await waitFor(() =>
      expect(mocks.recover).toHaveBeenCalledWith({
        id: 'canonical-user-id',
        locale: 'en',
      })
    );
  });

  it('shows a retryable Player failure instead of a false empty list', async () => {
    const user = userEvent.setup();
    mocks.playersError = true;
    mocks.playersHaveData = false;

    renderPlayersTab();

    expect(screen.getByText('Players could not be loaded')).toBeVisible();
    expect(screen.queryByText('No players found')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(mocks.refetchPlayers).toHaveBeenCalledOnce();
  });

  it('keeps Players visible while disabling Team-dependent actions after a Team failure', () => {
    mocks.teamsError = true;
    mocks.teamsHaveData = false;
    mocks.players = [{ ...player, teamIds: ['unavailable-team'] }];

    renderPlayersTab();

    const mobileList = within(screen.getByTestId('mobile-players-list'));
    expect(screen.getAllByText('External Player')[0]).toBeVisible();
    expect(
      mobileList.queryByText('No current Team assignments')
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/Team filters and association actions are disabled/)
    ).toBeVisible();
    expect(screen.getAllByRole('combobox')[0]).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Edit player teams' })
    ).toBeDisabled();
  });

  it('disables lifecycle establishment when candidates fail without hiding Players', () => {
    mocks.candidatesError = true;
    mocks.candidatesHaveData = false;

    renderPlayersTab();

    expect(screen.getAllByText('External Player')[0]).toBeVisible();
    expect(
      screen.getByText(/Lifecycle candidates are unavailable/)
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Manage Player participation' })
    ).toBeDisabled();
  });

  it('keeps Players visible while initial Team facts are loading', () => {
    mocks.teamsHaveData = false;
    mocks.teamsLoading = true;
    mocks.players = [{ ...player, teamIds: ['loading-team'] }];

    renderPlayersTab();

    const mobileList = within(screen.getByTestId('mobile-players-list'));
    expect(screen.getAllByText('External Player')[0]).toBeVisible();
    expect(
      mobileList.queryByText('No current Team assignments')
    ).not.toBeInTheDocument();
    expect(screen.getByText(/Loading Team information/)).toBeVisible();
    expect(screen.getAllByRole('combobox')[0]).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Edit player teams' })
    ).toBeDisabled();
  });

  it('shows no-Team copy only for a resolved empty association set', () => {
    mocks.players = [
      { ...player, id: 'no-team-player', userName: 'No Team Player' },
      {
        ...player,
        id: 'unresolved-team-player',
        userName: 'Unresolved Team Player',
        teamIds: ['missing-team'],
      },
    ];

    renderPlayersTab();

    const mobileList = within(screen.getByTestId('mobile-players-list'));
    expect(mobileList.getAllByText('No current Team assignments')).toHaveLength(
      1
    );
    expect(mobileList.getByText('Unresolved Team Player')).toBeVisible();
  });

  it('preserves cached Team labels when the Team refresh fails', () => {
    const cachedTeam = teamCard('cached-team', 'Cached Team');
    mocks.teamsError = true;
    mocks.teams = [cachedTeam];
    mocks.players = [{ ...player, teamIds: [cachedTeam.id] }];

    renderPlayersTab();

    const mobileList = within(screen.getByTestId('mobile-players-list'));
    expect(mobileList.getByText('Cached Team')).toBeVisible();
    expect(
      mobileList.queryByText('No current Team assignments')
    ).not.toBeInTheDocument();
  });

  it('withholds participation management while candidates are loading', () => {
    mocks.candidatesHaveData = false;
    mocks.candidatesLoading = true;

    renderPlayersTab();

    expect(screen.getAllByText('External Player')[0]).toBeVisible();
    expect(screen.getByText(/Loading lifecycle candidates/)).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Manage Player participation' })
    ).toBeDisabled();
  });

  it('exports the selected Team roster from eligible Player-team relationships', async () => {
    const user = userEvent.setup();
    const teamId = '507f1f77bcf86cd799439013';
    mocks.teams = [
      {
        id: teamId,
        teamId: 't1',
        shortName: 'First Team',
        leagueTeamName: 'First League Team',
        matchLevel: TeamLevel.C,
        createdById: '507f1f77bcf86cd799439014',
        playerIds: [],
        createdAt: '2026-07-19T00:00:00.000Z',
        updatedAt: '2026-07-19T00:00:00.000Z',
        playerCount: 0,
        players: [],
      },
    ];
    mocks.players = [
      { ...player, teamIds: [teamId] },
      {
        ...player,
        id: 'ineligible-player',
        userId: 'ineligible-user',
        userName: 'Ineligible Player',
        teamIds: [teamId],
        isEffectivelyEligible: false,
      },
    ];
    renderPlayersTab();

    await user.click(screen.getAllByRole('combobox')[0]);
    await user.click(screen.getByRole('option', { name: /First Team/ }));
    await user.click(screen.getByRole('button', { name: 'Team Roster CSV' }));

    expect(mocks.downloadCsv).toHaveBeenCalledWith(
      expect.objectContaining({
        filename: expect.stringMatching(
          /^team_roster_First Team_\d{4}-\d{2}-\d{2}\.csv$/
        ),
        rows: [expect.objectContaining({ id: 'player-record-id' })],
      })
    );
    expect(mocks.success).toHaveBeenCalledWith(
      'The selected Team roster was exported.'
    );
  });

  it('offers administrators the fixed External Player task without sporting or Membership inputs', async () => {
    const user = userEvent.setup();
    renderPlayersTab();

    await user.click(
      screen.getByRole('button', { name: 'Add External Player' })
    );

    expect(screen.getAllByText('Add External Player')).not.toHaveLength(0);
    expect(screen.queryByText('Membership Details')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Active')).not.toBeInTheDocument();
    expect(screen.queryByText('Team assignment')).not.toBeInTheDocument();
  });

  it('shows administrator-only setup recovery and uses the canonical setup User id', async () => {
    const user = userEvent.setup();
    mocks.reissue.mockResolvedValue({
      generation: 2,
      deliveryStatus: 'sent',
    });
    renderPlayersTab();

    expect(screen.getAllByText('Current delivery failed')[0]).toBeVisible();
    await user.click(
      screen.getByRole('button', {
        name: 'Reissue password setup for External Player',
      })
    );

    await waitFor(() => expect(mocks.reissue).toHaveBeenCalledOnce());
    expect(mocks.reissue).toHaveBeenCalledWith('setup-owner-user-id');
    expect(mocks.success).toHaveBeenCalledWith(
      'A new password setup email was sent.'
    );
  });

  it('offers backend-approved recovery only in the External Player task context', async () => {
    const user = userEvent.setup();
    mocks.players = [{ ...player, passwordRecoveryAvailable: true }];
    mocks.recover.mockResolvedValue({ deliveryStatus: 'sent' });
    renderPlayersTab();

    await user.click(
      screen.getByRole('button', {
        name: 'Send password recovery for External Player',
      })
    );
    expect(mocks.recover).toHaveBeenCalledWith({
      id: 'canonical-user-id',
      locale: 'de',
    });
    expect(mocks.success).toHaveBeenCalledWith(
      'The password recovery email was sent.'
    );
  });

  it('does not expose establishment or setup details without administration capability', () => {
    mocks.capabilities = [Capability.ACTIVE_PLAYER];
    renderPlayersTab();

    expect(
      screen.queryByRole('button', { name: 'Add External Player' })
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Account setup')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Current delivery failed')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Reissue password setup/ })
    ).not.toBeInTheDocument();
    const mobileList = within(screen.getByTestId('mobile-players-list'));
    expect(mobileList.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(
      mobileList.queryByRole('button', { name: /Actions for/ })
    ).not.toBeInTheDocument();
  });

  it('submits one confirmed Team command and reports the shared updated count', async () => {
    const user = userEvent.setup();
    mocks.teams = [
      {
        id: '507f1f77bcf86cd799439013',
        teamId: 't1',
        shortName: 'First Team',
        leagueTeamName: 'First League Team',
        matchLevel: TeamLevel.C,
        createdById: '507f1f77bcf86cd799439014',
        playerIds: [],
        createdAt: '2026-07-19T00:00:00.000Z',
        updatedAt: '2026-07-19T00:00:00.000Z',
        playerCount: 0,
        players: [],
      },
    ];
    mocks.batchUpdate.mockResolvedValue({ updatedCount: 1 });
    renderPlayersTab();

    await user.click(
      within(screen.getByRole('table')).getByRole('checkbox', {
        name: 'Select External Player',
      })
    );
    await user.click(screen.getByRole('button', { name: 'Update Teams' }));
    await user.click(screen.getAllByRole('combobox').at(-1)!);
    await user.click(screen.getByRole('option', { name: /First Team/ }));
    expect(
      screen.getByText('Affected players:').parentElement
    ).toHaveTextContent('Affected players: 1');
    await user.click(screen.getByRole('button', { name: 'Confirm addition' }));

    await waitFor(() => expect(mocks.batchUpdate).toHaveBeenCalledOnce());
    expect(mocks.batchUpdate).toHaveBeenCalledWith({
      playerIds: ['player-record-id'],
      updates: { addToTeams: ['507f1f77bcf86cd799439013'] },
    });
    expect(mocks.success).toHaveBeenCalledWith(
      'Added 1 player(s) to First Team.'
    );
  });

  it('keeps the Team and Player selection after a safe batch failure', async () => {
    const user = userEvent.setup();
    mocks.teams = [
      {
        id: '507f1f77bcf86cd799439013',
        teamId: 't1',
        shortName: 'First Team',
        leagueTeamName: 'First League Team',
        matchLevel: TeamLevel.C,
        createdById: '507f1f77bcf86cd799439014',
        playerIds: [],
        createdAt: '2026-07-19T00:00:00.000Z',
        updatedAt: '2026-07-19T00:00:00.000Z',
        playerCount: 0,
        players: [],
      },
    ];
    mocks.batchUpdate.mockRejectedValue(new Error('private transport detail'));
    renderPlayersTab();

    const playerCheckbox = within(screen.getByRole('table')).getByRole(
      'checkbox',
      {
        name: 'Select External Player',
      }
    );
    await user.click(playerCheckbox);
    await user.click(screen.getByRole('button', { name: 'Update Teams' }));
    await user.click(screen.getAllByRole('combobox').at(-1)!);
    await user.click(screen.getByRole('option', { name: /First Team/ }));
    await user.click(screen.getByRole('button', { name: 'Confirm addition' }));

    await waitFor(() => expect(mocks.error).toHaveBeenCalledOnce());
    expect(mocks.error).toHaveBeenCalledWith(
      'Team associations could not be updated. Your selection was kept so you can try again.'
    );
    expect(playerCheckbox).toBeChecked();
    expect(screen.getByText('First Team')).toBeVisible();
    expect(
      screen.queryByText('private transport detail')
    ).not.toBeInTheDocument();
  });

  it('establishes participation for a selected current Member without a Player', async () => {
    const user = userEvent.setup();
    mocks.lifecycleCandidates = [
      {
        userId: 'member-without-player',
        userName: 'Member Without Player',
        membershipStatus: 'active',
        isParticipationEnabled: false,
        isEffectivelyEligible: false,
      },
    ];
    mocks.lifecycleBatch.mockResolvedValue({
      updatedCount: 1,
      failureCount: 0,
      items: [],
    });
    renderPlayersTab();

    await user.click(
      screen.getByRole('button', { name: 'Manage Player participation' })
    );
    await user.click(
      screen.getByRole('checkbox', { name: /Member Without Player/ })
    );
    await user.type(screen.getByLabelText('Required reason'), 'Season setup');
    await user.click(screen.getByRole('button', { name: 'Apply to 1' }));

    await waitFor(() => expect(mocks.lifecycleBatch).toHaveBeenCalledOnce());
    expect(mocks.lifecycleBatch).toHaveBeenCalledWith({
      request: {
        userIds: ['member-without-player'],
        action: 'enable',
        reason: 'Season setup',
      },
    });
  });

  it('deactivates a selected active External Player through the lifecycle batch', async () => {
    const user = userEvent.setup();
    mocks.lifecycleBatch.mockResolvedValue({
      updatedCount: 1,
      failureCount: 0,
      items: [],
    });
    renderPlayersTab();

    await user.click(
      within(screen.getByRole('table')).getByRole('checkbox', {
        name: 'Select External Player',
      })
    );
    await user.click(screen.getByRole('button', { name: 'End participation' }));
    await user.type(screen.getByLabelText('Required reason'), 'Season ended');
    await user.click(screen.getByRole('button', { name: 'Apply to 1' }));

    await waitFor(() => expect(mocks.lifecycleBatch).toHaveBeenCalledOnce());
    expect(mocks.lifecycleBatch).toHaveBeenCalledWith({
      request: {
        userIds: ['canonical-user-id'],
        action: 'deactivate',
        reason: 'Season ended',
      },
    });
  });

  it('offers and confirms conversion only for an eligible retained former Member', async () => {
    const user = userEvent.setup();
    mocks.players = [
      {
        ...player,
        id: 'former-member-player',
        type: PlayerType.MEMBER,
        userName: 'Former Member',
        membershipStatus: MembershipStatus.INACTIVE,
        isActivePlayer: false,
        isEffectivelyEligible: false,
        teamIds: [],
      },
      {
        ...player,
        id: 'current-member-player',
        type: PlayerType.MEMBER,
        userName: 'Current Member',
        membershipStatus: MembershipStatus.ACTIVE,
        isActivePlayer: false,
        isEffectivelyEligible: false,
        teamIds: [],
      },
    ];
    mocks.convertFormerMember.mockResolvedValue({});
    renderPlayersTab();

    expect(
      screen.queryByRole('button', {
        name: 'Convert Current Member to an External Player',
      })
    ).not.toBeInTheDocument();
    await user.click(
      within(screen.getByTestId('mobile-players-list')).getByRole('button', {
        name: 'Actions for Former Member',
      })
    );
    await user.click(
      screen.getByRole('menuitem', {
        name: 'Convert former Member to External Player',
      })
    );
    await user.type(
      screen.getByLabelText('Required reason'),
      'Approved for external play'
    );
    await user.click(
      screen.getByRole('button', { name: 'Convert to External Player' })
    );

    await waitFor(() =>
      expect(mocks.convertFormerMember).toHaveBeenCalledWith({
        id: 'former-member-player',
        reason: 'Approved for external play',
      })
    );
    expect(mocks.success).toHaveBeenCalledWith(
      'The former Member is now an External Player. Team assignment remains a separate task.'
    );
  });

  it('uses the active locale for Player lifecycle controls', async () => {
    const user = userEvent.setup();
    renderPlayersTab('de', dashboardDe);

    expect(screen.getByText('Spielerliste')).toBeVisible();
    await user.click(
      screen.getByRole('button', { name: 'Spielerbeteiligung verwalten' })
    );
    expect(screen.getByLabelText('Erforderliche Begründung')).toBeVisible();
    expect(screen.getByText('Einrichten / aktivieren')).toBeVisible();
  });

  it('uses the active locale for irreversible Player cleanup controls', async () => {
    const user = userEvent.setup();
    mocks.players = [{ ...player, isActivePlayer: false }];
    renderPlayersTab('de', dashboardDe);

    await user.click(
      screen.getByRole('button', {
        name: 'Spielerdatensatz von External Player dauerhaft bereinigen',
      })
    );

    expect(
      screen.getByRole('dialog', {
        name: 'Spielerdatensatz dauerhaft bereinigen?',
      })
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Dauerhaft bereinigen' })
    ).toBeVisible();
  });
});
