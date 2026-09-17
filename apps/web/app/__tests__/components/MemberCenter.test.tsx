import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AccountOnboardingStatus,
  AccountKind,
  Gender,
  MemberListFilter,
  MembershipStatus,
  PlayerType,
} from '@club/shared-types/core/enums';
import type { Api } from '@club/shared-types/api/user';
import type { Api as PlayerApi } from '@club/shared-types/api/player';
import MemberCenter from '../../components/Dashboard/MemberCenter';
import dashboardMessages from '../../../messages/en/dashboard.json';
import * as userApi from '../../lib/api/userApi';
import * as playerApi from '../../lib/api/playerApi';

const toastMocks = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
}));

const memberExportMocks = vi.hoisted(() => ({
  exportMembers: vi.fn(),
  exportRichMembers: vi.fn(),
  isExporting: false,
  isExportingRich: false,
}));

vi.mock('sonner', () => ({ toast: toastMocks }));

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'admin-user' } }),
}));

vi.mock('../../hooks/useMemberExport', () => ({
  useMemberExport: () => ({
    exportMembers: memberExportMocks.exportMembers,
    isExporting: memberExportMocks.isExporting,
  }),
  useRichMemberExport: () => ({
    exportMembers: memberExportMocks.exportRichMembers,
    isExporting: memberExportMocks.isExportingRich,
  }),
}));

vi.mock('../../lib/api/userApi', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api/userApi')>(
    '../../lib/api/userApi'
  );

  return {
    ...actual,
    getMemberList: vi.fn(),
    establishAccount: vi.fn(),
    updateUser: vi.fn(),
    setAdministratorDesignation: vi.fn(),
    transitionMembershipActivity: vi.fn(),
    suspendAccount: vi.fn(),
    unsuspendAccount: vi.fn(),
    deleteUser: vi.fn(),
    reissueAccountSetup: vi.fn(),
    requestPasswordRecovery: vi.fn(),
  };
});

vi.mock('../../lib/api/playerApi', async () => {
  const actual = await vi.importActual<
    typeof import('../../lib/api/playerApi')
  >('../../lib/api/playerApi');

  return {
    ...actual,
    getPlayers: vi.fn(),
  };
});

const messages = {
  common: {
    pagination: {
      range: 'Showing {start} to {end} of {total} items',
      rangeCompact: '{start}–{end} / {total}',
      perPage: 'Items per page:',
      perPageCompact: 'Per page',
      perPageLabel: 'Items per page',
      page: 'Page {current} of {total}',
      pageCompact: '{current} / {total}',
      previous: 'Previous page',
      next: 'Next page',
    },
    setupReissue: {
      sent: 'A new password setup email was sent.',
      failed: 'Delivery failed.',
      uncertain: 'Delivery could not be confirmed.',
      requestFailed: 'Reissue failed.',
    },
    accountSetup: {
      header: 'Account setup',
      state: {
        ready: 'Setup complete',
        required: 'Setup required',
        expired: 'Setup link expired',
      },
      delivery: {
        sent: 'Current setup email sent',
        failed: 'Current delivery failed',
        uncertain: 'Current delivery unconfirmed',
        not_attempted: 'No current delivery result',
      },
      reissue: 'Reissue setup email',
      reissuing: 'Reissuing…',
      reissueFor: 'Reissue password setup for {name}',
    },
  },
  dashboard: {
    memberImport: dashboardMessages.memberImport,
    languageOptions: {
      de: 'German',
      en: 'English',
      zh: 'Chinese',
    },
    passwordRecovery: {
      action: 'Send recovery',
      sending: 'Sending…',
      actionFor: 'Send password recovery for {name}',
      languageFor: 'Recovery email language for {name}',
      sent: 'The password recovery email was sent.',
      failed: 'The recovery email could not be sent.',
      uncertain: 'Delivery could not be confirmed.',
      requestFailed: 'Password recovery could not be requested.',
    },
    memberList: {
      title: 'Member Management',
      empty: 'No members found',
      columns: {
        name: 'Name',
        email: 'Email',
        gender: 'Gender',
        birthday: 'Date of birth',
        status: 'Status',
        player: 'Player',
        administrator: 'Administrator',
        actions: 'Actions',
      },
      notSpecified: 'Not specified',
      notProvided: 'Not provided',
      playerBadge: 'Player',
      administratorBadge: 'Designated',
      administratorBadgeShort: 'Admin',
      actionsFor: 'Actions for {name}',
      edit: 'Edit member',
      deleteAccount: 'Permanently delete account',
      editNamed: 'Edit {name}',
      deleteNamed: 'Permanently delete account for {name}',
      accountSuspended: 'Account suspended',
      accountSuspensionReason: 'Reason: {reason}',
      genderValues: {
        male: 'Male',
        female: 'Female',
      },
      loading: 'Loading members...',
      loadErrorTitle: 'Unable to load members',
      loadErrorDescription:
        'The member list could not be loaded. Please try again.',
      refreshErrorTitle: 'Members may be out of date',
      refreshErrorDescription:
        'The latest update could not be loaded. Showing the previously loaded member list.',
      retry: 'Retry',
      retrying: 'Retrying...',
      export: 'Export member CSV',
      portableCurrentExport: 'Portable Member CSV — Current members',
      basicAllExport: 'Basic CSV — All retained members (includes inactive)',
      richCurrentExport: 'Full CSV — Current members',
      richAllExport: 'Full CSV — All retained members (includes inactive)',
      addMember: 'Add member',
      exporting: 'Exporting...',
      noMembersToExport: 'There are no members to export for this filter.',
      exportFailed: 'The member export could not be created. Please try again.',
      searchLabel: 'Search members',
      searchPlaceholder: 'Search by name or email...',
      filterLabel: 'Membership status filter',
      administratorFilterLabel: 'Administrator designation filter',
      administratorsOnly: 'Administrators',
      genderFilterLabel: 'Gender filter',
      genderFilters: {
        all: 'All genders',
        male: 'Male',
        female: 'Female',
        other: 'Non-binary',
        missing: 'Missing',
      },
      filters: {
        current: 'Current',
        active: 'Active',
        passive: 'Passive',
        suspended: 'Suspended',
        inactive: 'Inactive',
        all: 'All',
      },
      statistics: 'Statistics ({count} {cohort})',
      statisticsCohorts: {
        members: 'members',
      },
      genderDistribution: 'Gender distribution',
      birthYearDistribution: 'Birth year distribution',
      other: 'Other',
      notAvailable: 'N/A',
      missingBirthDate: 'Missing birth date: {count}',
      deleteTitle: 'Permanently delete account?',
      deleteDescription:
        'This will permanently delete the account for <strong>{name}</strong> ({email}). Current membership status: {status}.',
      deleteConsequences:
        'If Membership is current, it is ended through Membership Lifecycle. The account, current profile, sessions, banking data, and eligible Player are removed together. Independently owned history remains. This action cannot be undone.',
      deleteReasonLabel: 'Administrator reason',
      deleteReasonPlaceholder:
        'Explain why this account must be permanently deleted',
      deleteReasonRequired: 'A reason is required.',
      deleteCancel: 'Cancel',
      cleanupFailed:
        'The account could not be permanently deleted. Nothing changed. Resolve dependencies and try again.',
      deletePending: 'Deleting account…',
      activeExternalPlayers: {
        title: 'Active External Players',
        description:
          'A read-only overview for identifying and contacting current External Players.',
        loading: 'Loading active External Players...',
        loadErrorTitle: 'Unable to load active External Players',
        loadErrorDescription:
          'This secondary overview could not be loaded. Member administration remains available above.',
        refreshError: 'Active External Player details may be out of date.',
        retry: 'Retry External Players',
        retrying: 'Retrying External Players...',
        empty: 'There are no active External Players.',
        ranking: 'Singles {singles} / Doubles {doubles}',
        columns: {
          name: 'Name',
          email: 'Email',
          ranking: 'Ranking',
        },
      },
    },
    modals: {
      editMember: {
        title: 'Edit Member',
        close: 'Close',
        emailWorkflow: 'Verified email workflow',
        administratorResponsibility: 'Administrator responsibility',
        administratorHelp: 'Designation help',
        grantAdministrator: 'Grant administrator',
        revokeAdministrator: 'Revoke administrator',
        accountAccess: 'Account access',
        accountAccessHelp: 'Account access help',
        accountActive: 'Access active',
        accountSuspended: 'Access suspended',
        accountSuspensionReason: 'Reason: {reason}',
        accountSuspensionReasonLabel: 'Required suspension reason',
        accountAccessError: 'Account access could not be updated. Try again.',
        profileError:
          'Profile corrections could not be saved. Your entries were kept so you can retry.',
        correctProfile: 'Correct profile data',
        designationError:
          'Administrator responsibility could not be updated. Try again.',
        membershipError:
          'Membership activity could not be updated. Your reason was kept so you can retry.',
        suspendAccount: 'Suspend account',
        unsuspendAccount: 'Unsuspend account',
        membershipActivity: 'Membership activity classification',
        membershipActivityHelp: 'Membership lifecycle help',
        membershipActivityReason: 'Reason',
        setPassive: 'Set passive',
        setActive: 'Set active',
        cancel: 'Cancel',
        saveCorrections: 'Save profile corrections',
      },
    },
    form: {
      firstName: 'First name',
      lastName: 'Last name',
      phone: 'Phone',
      dateOfBirth: 'Date of birth',
      gender: 'Gender',
      genderOptions: {
        male: 'Male',
        female: 'Female',
        nonBinary: 'Non-binary',
      },
    },
  },
};

const member: Api.AdministratorUserResponse = {
  id: 'member-1',
  email: 'member@example.test',
  firstName: 'Test',
  lastName: 'Member',
  fullName: 'Member, Test',
  gender: Gender.FEMALE,
  dateOfBirth: '1990-01-01',
  accountKind: AccountKind.PERSON,
  administratorDesignation: false,
  membershipStatus: MembershipStatus.ACTIVE,
  accountOnboardingStatus: AccountOnboardingStatus.READY,
  isPlayer: false,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  accountSetup: {
    userId: 'member-1',
    accountOnboardingStatus: AccountOnboardingStatus.READY,
    deliveryStatus: 'none',
    reissueAvailable: false,
  },
  passwordRecoveryAvailable: false,
};

function nonRetryableApiError(): Error & { response: { status: number } } {
  return Object.assign(new Error('private detail'), {
    response: { status: 400 },
  });
}

function responseWith(
  items: Api.AdministratorUserResponse[],
  overrides: Partial<Api.MemberListResponse> = {}
): Api.MemberListResponse {
  const total = overrides.pagination?.total ?? items.length;
  const pageSize = overrides.pagination?.pageSize ?? 20;
  return {
    success: true,
    appliedFilter: overrides.appliedFilter ?? MemberListFilter.CURRENT,
    items,
    pagination: {
      page: overrides.pagination?.page ?? 1,
      pageSize,
      total,
      totalPages:
        overrides.pagination?.totalPages ?? Math.ceil(total / pageSize),
      returned: items.length,
    },
    statistics: overrides.statistics ?? {
      total,
      gender: { male: 0, female: items.length, other: 0, missing: 0 },
      birthYears: [],
      missingBirthDate: 0,
    },
    genderFilterCounts: overrides.genderFilterCounts ?? {
      male: 0,
      female: items.length,
      other: 0,
      missing: 0,
    },
  };
}

function renderMemberCenter() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const view = render(
    <NextIntlClientProvider locale="en" messages={messages} onError={() => {}}>
      <QueryClientProvider client={queryClient}>
        <MemberCenter />
      </QueryClientProvider>
    </NextIntlClientProvider>
  );

  return { ...view, queryClient };
}

function playerResponse(
  overrides: Partial<PlayerApi.PlayerResponse> = {}
): PlayerApi.PlayerResponse {
  return {
    id: 'player-1',
    userId: 'external-1',
    type: PlayerType.EXTERNAL,
    userName: 'External, Player',
    userEmail: 'external@example.test',
    singlesRanking: 4,
    doublesRanking: 7,
    rankingDisplay: '4/7',
    isActivePlayer: true,
    membershipStatus: MembershipStatus.INACTIVE,
    isEffectivelyEligible: true,
    teamIds: [],
    matchCount: 0,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function playersResponse(
  items: PlayerApi.PlayerResponse[]
): Awaited<ReturnType<typeof playerApi.getPlayers>> {
  return items;
}

describe('MemberCenter member projection', () => {
  const getMemberListMock = vi.mocked(userApi.getMemberList);

  beforeEach(() => {
    vi.clearAllMocks();
    memberExportMocks.isExporting = false;
    memberExportMocks.isExportingRich = false;
    memberExportMocks.exportMembers.mockResolvedValue(undefined);
    memberExportMocks.exportRichMembers.mockResolvedValue(undefined);
    HTMLElement.prototype.hasPointerCapture = () => false;
    HTMLElement.prototype.setPointerCapture = () => {};
    HTMLElement.prototype.releasePointerCapture = () => {};
    HTMLElement.prototype.scrollIntoView = () => {};
    vi.mocked(playerApi.getPlayers).mockResolvedValue(playersResponse([]));
    vi.mocked(userApi.setAdministratorDesignation).mockImplementation(
      async (_id, designated) => ({
        ...member,
        administratorDesignation: designated,
      })
    );
    vi.mocked(userApi.transitionMembershipActivity).mockImplementation(
      async (_id, targetStatus) => ({
        ...member,
        membershipStatus: targetStatus,
      })
    );
    vi.mocked(userApi.suspendAccount).mockImplementation(
      async (_id, reason) => ({
        ...member,
        accountSuspension: {
          reason,
          suspendedAt: '2026-08-14T12:00:00.000Z',
          suspendedBy: 'admin-user',
        },
      })
    );
    vi.mocked(userApi.unsuspendAccount).mockResolvedValue(member);
  });

  afterEach(() => {
    cleanup();
  });

  it('uses Members as the primary task and shows only eligible External Players in the secondary overview', async () => {
    getMemberListMock.mockResolvedValue(responseWith([member]));
    vi.mocked(playerApi.getPlayers).mockResolvedValue(
      playersResponse([
        playerResponse({
          userName:
            'External-Player-With-An-Exceptionally-Long-Double-Surname, Alexandra',
          userEmail:
            'alexandra.external-player-with-a-long-address@example.test',
        }),
        playerResponse({
          id: 'member-player',
          type: PlayerType.MEMBER,
          userName: 'Member, Sporting',
          userEmail: 'sporting-member@example.test',
        }),
        playerResponse({
          id: 'inactive-external',
          userName: 'External, Inactive',
          userEmail: 'inactive-external@example.test',
          isEffectivelyEligible: false,
        }),
      ])
    );

    renderMemberCenter();

    expect((await screen.findAllByText('Member, Test')).length).toBeGreaterThan(
      0
    );
    expect(
      await screen.findByText(
        'External-Player-With-An-Exceptionally-Long-Double-Surname, Alexandra'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'alexandra.external-player-with-a-long-address@example.test'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Singles 4 / Doubles 7')).toBeInTheDocument();
    expect(screen.queryByText('Member, Sporting')).not.toBeInTheDocument();
    expect(screen.queryByText('External, Inactive')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Active participants' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: 'Edit External-Player-With-An-Exceptionally-Long-Double-Surname, Alexandra',
      })
    ).not.toBeInTheDocument();
    expect(playerApi.getPlayers).toHaveBeenCalledWith();
  });

  it('keeps Member administration available when the External Player overview fails', async () => {
    getMemberListMock.mockResolvedValue(responseWith([member]));
    vi.mocked(playerApi.getPlayers).mockRejectedValue(
      new Error('private player detail')
    );

    renderMemberCenter();

    expect((await screen.findAllByText('Member, Test')).length).toBeGreaterThan(
      0
    );
    const externalPlayerAlert = await screen.findByRole('alert');
    expect(externalPlayerAlert).toHaveTextContent(
      'Unable to load active External Players'
    );
    expect(screen.queryByText('private player detail')).not.toBeInTheDocument();
  });

  it('shows loading while the initial request is pending', () => {
    getMemberListMock.mockReturnValue(new Promise(() => {}));

    renderMemberCenter();

    expect(screen.getByText('Loading members...')).toBeInTheDocument();
    expect(screen.queryByText('No members found')).not.toBeInTheDocument();
  });

  it('shows a safe error instead of the genuine empty state when the request fails', async () => {
    getMemberListMock.mockRejectedValue(new Error('sensitive backend detail'));

    renderMemberCenter();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to load members'
    );
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(
      screen.queryByText('sensitive backend detail')
    ).not.toBeInTheDocument();
    expect(screen.queryByText('No members found')).not.toBeInTheDocument();
  });

  it('retries the failed request and can reach the genuine empty state', async () => {
    const user = userEvent.setup();
    getMemberListMock
      .mockRejectedValueOnce(new Error('request failed'))
      .mockResolvedValueOnce(responseWith([]));

    renderMemberCenter();

    await user.click(await screen.findByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(getMemberListMock).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('No members found')).toBeInTheDocument();
  });

  it('uses the current-member projection by default', async () => {
    getMemberListMock.mockResolvedValue(responseWith([member]));

    renderMemberCenter();

    expect((await screen.findAllByText('Member, Test')).length).toBeGreaterThan(
      0
    );
    expect(getMemberListMock).toHaveBeenCalledWith({
      filter: MemberListFilter.CURRENT,
      gender: undefined,
      administratorOnly: undefined,
      search: undefined,
      page: 1,
      pageSize: 20,
    });
  });

  it('opens the bounded import flow from the CSV menu', async () => {
    const user = userEvent.setup();
    getMemberListMock.mockResolvedValue(responseWith([member]));
    renderMemberCenter();
    await user.click(
      await screen.findByRole('button', { name: 'Export member CSV' })
    );
    await user.click(screen.getByRole('menuitem', { name: 'Import CSV' }));
    expect(
      await screen.findByRole('dialog', { name: 'Import CSV' })
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Member CSV file')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Export member CSV' })
      ).toHaveFocus()
    );
  });

  it('keeps Add member direct and exposes import plus four explicit CSV cohort commands', async () => {
    const user = userEvent.setup();
    getMemberListMock.mockResolvedValue(responseWith([member]));

    renderMemberCenter();

    const addMember = await screen.findByRole('button', {
      name: 'Add member',
    });
    const csvMenu = screen.getByRole('button', {
      name: 'Export member CSV',
    });

    expect(addMember).toBeEnabled();
    expect(csvMenu).toHaveTextContent('CSV');

    await user.click(csvMenu);
    const exportCommands = await screen.findAllByRole('menuitem');
    expect(exportCommands).toHaveLength(5);
    expect(screen.getByRole('menuitem', { name: 'Import CSV' })).toBeEnabled();
    await user.click(
      screen.getByRole('menuitem', {
        name: 'Portable Member CSV — Current members',
      })
    );
    expect(memberExportMocks.exportMembers).toHaveBeenCalledWith('current');
    expect(memberExportMocks.exportRichMembers).not.toHaveBeenCalled();

    await user.click(csvMenu);
    await user.click(
      screen.getByRole('menuitem', {
        name: 'Basic CSV — All retained members (includes inactive)',
      })
    );
    expect(memberExportMocks.exportMembers).toHaveBeenCalledWith('all');

    await user.click(csvMenu);
    await user.click(
      screen.getByRole('menuitem', { name: 'Full CSV — Current members' })
    );
    expect(memberExportMocks.exportRichMembers).toHaveBeenCalledWith('current');

    await user.click(csvMenu);
    await user.click(
      screen.getByRole('menuitem', {
        name: 'Full CSV — All retained members (includes inactive)',
      })
    );
    expect(memberExportMocks.exportRichMembers).toHaveBeenCalledWith('all');

    await user.click(addMember);
    expect(await screen.findByRole('dialog')).toBeVisible();
  });

  it('disables and marks only the CSV entry busy while export is pending', async () => {
    memberExportMocks.isExporting = true;
    getMemberListMock.mockResolvedValue(responseWith([member]));

    renderMemberCenter();

    const csvMenu = await screen.findByRole('button', {
      name: 'Exporting...',
    });
    expect(csvMenu).toBeDisabled();
    expect(csvMenu).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: 'Add member' })).toBeEnabled();
  });

  it('requests a new server projection when the membership filter changes', async () => {
    const user = userEvent.setup();
    getMemberListMock.mockImplementation(async (query) =>
      responseWith(
        [
          {
            ...member,
            membershipStatus:
              query?.filter === MemberListFilter.PASSIVE
                ? MembershipStatus.PASSIVE
                : MembershipStatus.ACTIVE,
          },
        ],
        { appliedFilter: query?.filter }
      )
    );

    renderMemberCenter();
    await screen.findAllByText('Member, Test');
    await user.click(screen.getByRole('button', { name: 'Passive' }));

    await waitFor(() =>
      expect(getMemberListMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          filter: MemberListFilter.PASSIVE,
          page: 1,
        })
      )
    );
  });

  it('keeps list filters independent from the explicit export cohort', async () => {
    const user = userEvent.setup();
    getMemberListMock.mockResolvedValue(responseWith([member]));

    renderMemberCenter();
    await screen.findAllByText('Member, Test');
    await user.click(screen.getByRole('button', { name: 'Administrators' }));

    await waitFor(() =>
      expect(getMemberListMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ administratorOnly: true, page: 1 })
      )
    );
    await user.type(screen.getByLabelText('Search members'), 'Former');
    await user.click(screen.getByRole('button', { name: 'Female' }));
    await user.click(
      screen.getByRole('button', {
        name: 'All',
      })
    );
    await user.click(screen.getByRole('button', { name: 'Export member CSV' }));
    await user.click(
      screen.getByRole('menuitem', {
        name: 'Portable Member CSV — Current members',
      })
    );

    expect(memberExportMocks.exportMembers).toHaveBeenCalledWith('current');
    expect(memberExportMocks.exportMembers).toHaveBeenCalledTimes(1);
  });

  it('requests the all projection without introducing a pending member state', async () => {
    const user = userEvent.setup();
    getMemberListMock.mockImplementation(async (query) =>
      responseWith([member], { appliedFilter: query?.filter })
    );

    renderMemberCenter();
    await screen.findAllByText('Member, Test');
    await user.click(screen.getByRole('button', { name: 'All' }));

    await waitFor(() =>
      expect(getMemberListMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ filter: MemberListFilter.ALL })
      )
    );
    expect(screen.queryByText('Pending (legacy)')).not.toBeInTheDocument();
  });

  it('uses backend totals and resets paging for search and page-size changes', async () => {
    const user = userEvent.setup();
    getMemberListMock.mockImplementation(async (query) => {
      const requestedPageSize = query?.pageSize ?? 20;
      return responseWith([member], {
        pagination: {
          page: query?.page ?? 1,
          pageSize: requestedPageSize,
          total: 125,
          totalPages: Math.ceil(125 / requestedPageSize),
          returned: 1,
        },
        statistics: {
          total: 125,
          gender: { male: 62, female: 63, other: 0, missing: 0 },
          birthYears: [],
          missingBirthDate: 0,
        },
      });
    });

    renderMemberCenter();

    expect(
      await screen.findByRole('button', { name: 'Statistics (125 members)' })
    ).toBeInTheDocument();
    expect(screen.getByText(/Showing/)).toHaveTextContent(
      'Showing 1 to 20 of 125 items'
    );

    await user.click(screen.getByRole('button', { name: 'Next page' }));
    await waitFor(() =>
      expect(getMemberListMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2, pageSize: 20 })
      )
    );

    await user.type(screen.getByLabelText('Search members'), 'Test');
    await waitFor(() =>
      expect(getMemberListMock).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, search: 'Test' })
      )
    );

    await user.click(screen.getByRole('button', { name: 'Next page' }));
    await waitFor(() =>
      expect(getMemberListMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2, pageSize: 20, search: 'Test' })
      )
    );
    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: '50' }));
    await waitFor(() =>
      expect(getMemberListMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 1, pageSize: 50, search: 'Test' })
      )
    );
  });

  it('keeps populated members visible without invoking mutation APIs', async () => {
    getMemberListMock.mockResolvedValue(responseWith([member]));

    renderMemberCenter();

    expect((await screen.findAllByText('Member, Test')).length).toBeGreaterThan(
      0
    );
    expect(userApi.establishAccount).not.toHaveBeenCalled();
    expect(userApi.updateUser).not.toHaveBeenCalled();
    expect(userApi.deleteUser).not.toHaveBeenCalled();
  });

  it.each([
    ['German', 'de'],
    ['English', 'en'],
    ['Chinese', 'zh'],
  ] as const)('chooses %s only after opening the recovery action', async (language, locale) => {
    const user = userEvent.setup();
    getMemberListMock.mockResolvedValue(
      responseWith([{ ...member, passwordRecoveryAvailable: true }])
    );
    vi.mocked(userApi.requestPasswordRecovery).mockResolvedValue({
      deliveryStatus: 'sent',
    });
    renderMemberCenter();

    const actions = await screen.findAllByRole('button', {
      name: 'Send password recovery for Member, Test',
    });
    await user.click(actions[0]);
    expect(userApi.requestPasswordRecovery).not.toHaveBeenCalled();
    await user.click(await screen.findByRole('menuitem', { name: language }));
    expect(userApi.requestPasswordRecovery).toHaveBeenCalledWith(
      'member-1',
      locale
    );
    expect(toastMocks.success).toHaveBeenCalledWith(
      'The password recovery email was sent.'
    );
  });

  it('renders a dedicated mobile task item and keeps READY setup quiet there', async () => {
    const user = userEvent.setup();
    getMemberListMock.mockResolvedValue(
      responseWith([
        {
          ...member,
          administratorDesignation: true,
          isPlayer: true,
          passwordRecoveryAvailable: true,
        },
      ])
    );

    renderMemberCenter();

    const mobileList = await screen.findByTestId('mobile-member-list');
    expect(within(mobileList).getByText('Member, Test')).toBeInTheDocument();
    expect(
      within(mobileList).getByText('member@example.test')
    ).toBeInTheDocument();
    expect(within(mobileList).queryByText('Setup complete')).toBeNull();
    expect(screen.getAllByText('Setup complete')).toHaveLength(2);

    await user.click(
      within(mobileList).getByRole('button', {
        name: 'Actions for Member, Test',
      })
    );
    expect(
      await screen.findByRole('menuitem', { name: 'Edit member' })
    ).toBeVisible();
    expect(
      screen.getByRole('menuitem', { name: 'Send recovery' })
    ).toBeVisible();
  });

  it('hides zero-count optional gender filters and keeps a selected zero-result filter visible', async () => {
    const user = userEvent.setup();
    getMemberListMock.mockImplementation(async (query) =>
      responseWith(query?.gender ? [] : [member], {
        genderFilterCounts: query?.gender
          ? { male: 0, female: 0, other: 0, missing: 0 }
          : { male: 1, female: 1, other: 1, missing: 0 },
      })
    );

    renderMemberCenter();

    expect(
      await screen.findByRole('button', { name: 'Non-binary' })
    ).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Missing' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Non-binary' }));

    await waitFor(() =>
      expect(getMemberListMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ gender: Gender.NON_BINARY, page: 1 })
      )
    );
    expect(screen.getByRole('button', { name: 'Non-binary' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it.each([
    ['failed', 'error'],
    ['uncertain', 'warning'],
  ] as const)('does not present %s setup delivery as success', async (deliveryStatus, expectedToast) => {
    const user = userEvent.setup();
    const pendingMember = {
      ...member,
      accountOnboardingStatus: AccountOnboardingStatus.PASSWORD_SETUP_PENDING,
      accountSetup: {
        userId: member.id,
        accountOnboardingStatus: AccountOnboardingStatus.PASSWORD_SETUP_PENDING,
        deliveryStatus,
        reissueAvailable: true,
      },
    };
    vi.mocked(userApi.getMemberList).mockResolvedValue(
      responseWith([pendingMember])
    );
    vi.mocked(userApi.reissueAccountSetup).mockResolvedValue({
      generation: 2,
      deliveryStatus,
    });
    renderMemberCenter();

    const buttons = await screen.findAllByRole('button', {
      name: 'Reissue password setup for Member, Test',
    });
    await user.click(buttons[0]);

    await waitFor(() =>
      expect(toastMocks[expectedToast]).toHaveBeenCalledOnce()
    );
    expect(toastMocks[expectedToast]).toHaveBeenCalledWith(
      deliveryStatus === 'failed'
        ? 'Delivery failed.'
        : 'Delivery could not be confirmed.'
    );
    expect(toastMocks.success).not.toHaveBeenCalled();
  });

  it('does not offer setup reissue when the backend marks it unavailable', async () => {
    vi.mocked(userApi.getMemberList).mockResolvedValue(
      responseWith([
        {
          ...member,
          membershipStatus: MembershipStatus.INACTIVE,
          accountOnboardingStatus:
            AccountOnboardingStatus.PASSWORD_SETUP_PENDING,
          accountSetup: {
            userId: member.id,
            accountOnboardingStatus:
              AccountOnboardingStatus.PASSWORD_SETUP_PENDING,
            deliveryStatus: 'not_attempted',
            reissueAvailable: false,
          },
        },
      ])
    );

    renderMemberCenter();

    expect((await screen.findAllByText('Member, Test')).length).toBeGreaterThan(
      0
    );
    expect(
      screen.queryByRole('button', {
        name: 'Reissue password setup for Member, Test',
      })
    ).not.toBeInTheDocument();
  });

  it('renders the backend-projected expired and not-attempted setup state', async () => {
    vi.mocked(userApi.getMemberList).mockResolvedValue(
      responseWith([
        {
          ...member,
          accountOnboardingStatus:
            AccountOnboardingStatus.PASSWORD_SETUP_EXPIRED,
          accountSetup: {
            userId: member.id,
            accountOnboardingStatus:
              AccountOnboardingStatus.PASSWORD_SETUP_EXPIRED,
            deliveryStatus: 'not_attempted',
            reissueAvailable: true,
          },
        },
      ])
    );

    renderMemberCenter();

    expect(await screen.findAllByText('Setup link expired')).toHaveLength(3);
    expect(screen.getAllByText('No current delivery result')).toHaveLength(3);
  });

  it('uses bounded copy when setup reissue itself fails', async () => {
    const user = userEvent.setup();
    vi.mocked(userApi.getMemberList).mockResolvedValue(
      responseWith([
        {
          ...member,
          accountOnboardingStatus:
            AccountOnboardingStatus.PASSWORD_SETUP_PENDING,
          accountSetup: {
            userId: member.id,
            accountOnboardingStatus:
              AccountOnboardingStatus.PASSWORD_SETUP_PENDING,
            deliveryStatus: 'failed',
            reissueAvailable: true,
          },
        },
      ])
    );
    vi.mocked(userApi.reissueAccountSetup).mockRejectedValue(
      new Error('sensitive transport detail')
    );
    renderMemberCenter();

    const buttons = await screen.findAllByRole('button', {
      name: 'Reissue password setup for Member, Test',
    });
    await user.click(buttons[0]);

    await waitFor(() => expect(toastMocks.error).toHaveBeenCalledOnce());
    expect(toastMocks.error).toHaveBeenCalledWith('Reissue failed.');
    expect(
      screen.queryByText('sensitive transport detail')
    ).not.toBeInTheDocument();
  });

  it('offers setup reissue for a pending Member with suspended Account access', async () => {
    vi.mocked(userApi.getMemberList).mockResolvedValue(
      responseWith([
        {
          ...member,
          membershipStatus: MembershipStatus.ACTIVE,
          accountSuspension: {
            reason: 'Access review',
            suspendedAt: '2026-07-13T12:00:00.000Z',
            suspendedBy: member.id,
          },
          accountOnboardingStatus:
            AccountOnboardingStatus.PASSWORD_SETUP_PENDING,
          isPlayer: false,
          accountSetup: {
            userId: member.id,
            accountOnboardingStatus:
              AccountOnboardingStatus.PASSWORD_SETUP_PENDING,
            deliveryStatus: 'failed',
            reissueAvailable: true,
          },
        },
      ])
    );

    renderMemberCenter();

    expect(
      await screen.findAllByRole('button', {
        name: 'Reissue password setup for Member, Test',
      })
    ).toHaveLength(2);
  });

  it('keeps cached members visible and offers retry when a refetch fails', async () => {
    const user = userEvent.setup();
    getMemberListMock
      .mockResolvedValueOnce(responseWith([member]))
      .mockRejectedValueOnce(new Error('sensitive refresh detail'))
      .mockResolvedValueOnce(responseWith([member]));

    const { queryClient } = renderMemberCenter();

    expect((await screen.findAllByText('Member, Test')).length).toBeGreaterThan(
      0
    );

    await act(async () => {
      await queryClient.refetchQueries({ queryKey: ['users', 'list'] });
    });

    const refreshAlert = await screen.findByRole('alert');
    expect(refreshAlert).toHaveTextContent('Members may be out of date');
    expect(screen.getAllByText('Member, Test').length).toBeGreaterThan(0);
    expect(
      screen.queryByText('Unable to load members')
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(getMemberListMock).toHaveBeenCalledTimes(3));
    await waitFor(() =>
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    );
  });

  it('does not present a previous cohort when a key-changing request fails', async () => {
    const user = userEvent.setup();
    getMemberListMock.mockImplementation(async (query) => {
      if (query?.administratorOnly) {
        throw new Error('sensitive administrator-filter failure detail');
      }
      return responseWith([member]);
    });

    renderMemberCenter();

    expect((await screen.findAllByText('Member, Test')).length).toBeGreaterThan(
      0
    );
    await user.click(screen.getByRole('button', { name: 'Administrators' }));

    const errorAlert = await screen.findByRole('alert');
    expect(errorAlert).toHaveTextContent('Unable to load members');
    expect(screen.queryByText('Member, Test')).not.toBeInTheDocument();
    expect(getMemberListMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ administratorOnly: true, page: 1 })
    );
    expect(screen.getByRole('button', { name: 'Retry' })).toBeEnabled();
  });

  it('keeps the open modal on the returned designation and Membership state', async () => {
    const user = userEvent.setup();
    getMemberListMock.mockResolvedValue(responseWith([member]));
    renderMemberCenter();

    const editButtons = await screen.findAllByRole('button', {
      name: 'Edit Member, Test',
    });
    await user.click(editButtons[0]);
    await user.click(
      screen.getByRole('button', { name: 'Grant administrator' })
    );
    expect(
      await screen.findByRole('button', { name: 'Revoke administrator' })
    ).toBeVisible();

    await user.type(screen.getByLabelText('Reason'), 'Annual classification');
    await user.click(screen.getByRole('button', { name: 'Set passive' }));
    expect(
      await screen.findByRole('button', { name: 'Set active' })
    ).toBeVisible();
  });

  it('manages Account suspension for the selected member and shows its reason', async () => {
    const user = userEvent.setup();
    getMemberListMock.mockResolvedValue(responseWith([member]));
    renderMemberCenter();

    const editButtons = await screen.findAllByRole('button', {
      name: 'Edit Member, Test',
    });
    await user.click(editButtons[0]);

    expect(screen.getByText('Access active')).toBeVisible();
    await user.type(
      screen.getByLabelText('Required suspension reason'),
      'Policy review'
    );
    await user.click(screen.getByRole('button', { name: 'Suspend account' }));

    expect(userApi.suspendAccount).toHaveBeenCalledWith(
      'member-1',
      'Policy review'
    );
    expect(await screen.findByText('Access suspended')).toBeVisible();
    expect(screen.getByText('Reason: Policy review')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Unsuspend account' }));
    expect(userApi.unsuspendAccount).toHaveBeenCalledWith('member-1');
    expect(await screen.findByText('Access active')).toBeVisible();
  });

  it('keeps profile input visible and retryable when a profile correction fails', async () => {
    const user = userEvent.setup();
    getMemberListMock.mockResolvedValue(responseWith([member]));
    vi.mocked(userApi.updateUser).mockRejectedValue(nonRetryableApiError());
    renderMemberCenter();

    await user.click(
      (await screen.findAllByRole('button', { name: 'Edit Member, Test' }))[0]
    );
    await user.click(
      screen.getByRole('button', { name: 'Correct profile data' })
    );
    const firstName = screen.getByLabelText('First name');
    await user.clear(firstName);
    await user.type(firstName, 'Retained');
    await user.click(
      screen.getByRole('button', { name: 'Save profile corrections' })
    );

    expect(
      await screen.findByText(/Profile corrections could not be saved/)
    ).toBeVisible();
    expect(firstName).toHaveValue('Retained');
    expect(screen.queryByText('private detail')).not.toBeInTheDocument();
  });

  it('keeps the Membership reason after a failed transition', async () => {
    const user = userEvent.setup();
    getMemberListMock.mockResolvedValue(responseWith([member]));
    vi.mocked(userApi.transitionMembershipActivity).mockRejectedValue(
      nonRetryableApiError()
    );
    renderMemberCenter();

    await user.click(
      (await screen.findAllByRole('button', { name: 'Edit Member, Test' }))[0]
    );
    const reason = screen.getByLabelText('Reason');
    await user.type(reason, 'Annual classification');
    await user.click(screen.getByRole('button', { name: 'Set passive' }));

    expect(
      await screen.findByText(/Membership activity could not be updated/)
    ).toBeVisible();
    expect(reason).toHaveValue('Annual classification');
  });

  it('shows designation failure without changing the open Member context', async () => {
    const user = userEvent.setup();
    getMemberListMock.mockResolvedValue(responseWith([member]));
    vi.mocked(userApi.setAdministratorDesignation).mockRejectedValue(
      new Error('private detail')
    );
    renderMemberCenter();

    await user.click(
      (await screen.findAllByRole('button', { name: 'Edit Member, Test' }))[0]
    );
    await user.click(
      screen.getByRole('button', { name: 'Grant administrator' })
    );

    expect(
      await screen.findByText(
        /Administrator responsibility could not be updated/
      )
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Grant administrator' })
    ).toBeVisible();
  });

  it('offers permanent account deletion for current and inactive Members', async () => {
    const inactiveMember = {
      ...member,
      id: 'inactive-member',
      fullName: 'Inactive Member',
      membershipStatus: MembershipStatus.INACTIVE,
    };
    getMemberListMock.mockResolvedValue(responseWith([member, inactiveMember]));
    renderMemberCenter();

    expect(
      await screen.findAllByRole('button', {
        name: 'Permanently delete account for Member, Test',
      })
    ).not.toHaveLength(0);
    expect(
      screen.getAllByRole('button', {
        name: 'Permanently delete account for Inactive Member',
      })
    ).not.toHaveLength(0);
  });

  it('requires a reason and retains failed deletion context until retry succeeds', async () => {
    const user = userEvent.setup();
    const retainedMember = {
      ...member,
      membershipStatus: MembershipStatus.INACTIVE,
    };
    getMemberListMock.mockResolvedValue(responseWith([retainedMember]));
    vi.mocked(userApi.deleteUser)
      .mockRejectedValueOnce(new Error('dependency detail'))
      .mockResolvedValueOnce(undefined as never);
    renderMemberCenter();

    await user.click(
      (
        await screen.findAllByRole('button', {
          name: 'Permanently delete account for Member, Test',
        })
      )[0]
    );
    const deleteButton = screen.getByRole('button', {
      name: 'Permanently delete account',
    });
    expect(deleteButton).toBeDisabled();
    await user.type(
      screen.getByLabelText('Administrator reason'),
      'Duplicate account confirmed by administrator'
    );
    await user.click(deleteButton);

    expect(
      await screen.findByText(/account could not be permanently deleted/)
    ).toBeVisible();
    expect(screen.getAllByText('Member, Test').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Administrator reason')).toHaveValue(
      'Duplicate account confirmed by administrator'
    );
    await user.click(deleteButton);

    await waitFor(() => expect(userApi.deleteUser).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(
        screen.queryByText('Permanently delete account?')
      ).not.toBeInTheDocument()
    );
    expect(userApi.deleteUser).toHaveBeenLastCalledWith(
      retainedMember.id,
      'Duplicate account confirmed by administrator'
    );
  });
});
