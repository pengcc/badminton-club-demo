import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MembershipTerminationStatus,
  MembershipTerminationSource,
  AccountKind,
} from '@club/shared-types/core/enums';
import { renderWithIntl, screen } from '../utils/renderWithIntl';
import { MembershipTerminationCard } from '../../components/Account/MembershipTerminationCard';
import MembershipTerminationCenter from '../../components/Dashboard/MembershipTerminationCenter';
import account from '../../../messages/en/account.json';
import dashboard from '../../../messages/en/dashboard.json';

const mocks = vi.hoisted(() => ({
  mine: vi.fn(),
  list: vi.fn(),
  request: vi.fn(),
  approve: vi.fn(),
  reject: vi.fn(),
  offline: vi.fn(),
  batch: vi.fn(),
  memberList: vi.fn(),
}));

vi.mock('../../services/membershipTerminationService', () => ({
  MembershipTerminationService: {
    useMine: () => mocks.mine(),
    useList: () => mocks.list(),
    useRequest: () => ({ mutateAsync: mocks.request, isPending: false }),
    useApprove: () => ({ mutateAsync: mocks.approve, isPending: false }),
    useReject: () => ({ mutateAsync: mocks.reject, isPending: false }),
    useRecordOffline: () => ({ mutateAsync: mocks.offline, isPending: false }),
    useRecordBatch: () => ({ mutateAsync: mocks.batch, isPending: false }),
  },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../services/userService', () => ({
  UserService: { useMemberList: () => mocks.memberList() },
}));

const messages = { account, dashboard };

const members = [
  {
    id: 'user-1',
    fullName: 'Member, Test',
    email: 'member@example.test',
  },
  {
    id: 'user-2',
    fullName: 'Member, Second',
    email: 'second@example.test',
  },
];

function memberTermination(
  status = MembershipTerminationStatus.PENDING_REVIEW
) {
  return {
    status,
    endDate: '2026-09-30',
  };
}

function administratorTermination(
  status = MembershipTerminationStatus.PENDING_REVIEW
) {
  return {
    id: 'termination-1',
    userId: 'user-1',
    memberName: 'Test Member',
    memberEmail: 'member@example.test',
    status,
    source: MembershipTerminationSource.ONLINE,
    requestedAt: '2026-07-16T10:00:00.000Z',
    requestedBy: {
      id: 'user-1',
      email: 'member@example.test',
      accountKind: AccountKind.PERSON,
      displayName: 'Test Member',
    },
    requestedEffectiveDate: '2026-09-30',
    createdAt: '2026-07-16T10:00:00.000Z',
    updatedAt: '2026-07-16T10:00:00.000Z',
  };
}

describe('membership termination workflows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    HTMLElement.prototype.hasPointerCapture = () => false;
    HTMLElement.prototype.setPointerCapture = () => {};
    HTMLElement.prototype.releasePointerCapture = () => {};
    HTMLElement.prototype.scrollIntoView = () => {};
    mocks.request.mockResolvedValue({});
    mocks.approve.mockResolvedValue({});
    mocks.reject.mockResolvedValue({});
    mocks.offline.mockResolvedValue({});
    mocks.batch.mockResolvedValue({
      createdCount: 1,
      failureCount: 1,
      items: [],
    });
    mocks.memberList.mockReturnValue({
      data: { items: members },
      isLoading: false,
      isPlaceholderData: false,
      isError: false,
      refetch: vi.fn(),
    });
  });

  it('shows an open member request and removes duplicate submission', () => {
    mocks.mine.mockReturnValue({
      data: memberTermination(),
      isLoading: false,
      isError: false,
    });
    renderWithIntl(<MembershipTerminationCard />, { messages });
    expect(
      screen.getByText('Pending administrator review')
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        (_content, element) =>
          element?.tagName === 'P' &&
          element.textContent ===
            'Requested membership end date: September 30, 2026'
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Submit request' })
    ).not.toBeInTheDocument();
  });

  it('shows an approved member termination from the narrow contract', () => {
    mocks.mine.mockReturnValue({
      data: memberTermination(MembershipTerminationStatus.APPROVED),
      isLoading: false,
      isError: false,
    });
    renderWithIntl(<MembershipTerminationCard />, { messages });
    expect(screen.getByText('Approved')).toBeInTheDocument();
    expect(
      screen.getByText(
        (_content, element) =>
          element?.tagName === 'P' &&
          element.textContent === 'Membership ends on: September 30, 2026'
      )
    ).toBeInTheDocument();
  });

  it('does not offer a new request when membership is not currently eligible', () => {
    mocks.mine.mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
    });
    renderWithIntl(<MembershipTerminationCard canRequest={false} />, {
      messages,
    });
    expect(
      screen.getByText(
        'A new request is not available for the current membership status.'
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Submit request' })
    ).not.toBeInTheDocument();
  });

  it('requires a deliberate date choice and confirms Member submission', async () => {
    mocks.mine.mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
    });
    renderWithIntl(<MembershipTerminationCard />, { messages });
    const user = userEvent.setup();
    expect(
      screen.getByRole('button', { name: 'Submit request' })
    ).toBeDisabled();
    await user.click(
      screen.getByRole('combobox', { name: 'Requested membership end date' })
    );
    await user.click(screen.getAllByRole('option')[0]);
    await user.click(screen.getByRole('button', { name: 'Submit request' }));
    expect(
      screen.getByText('Submit membership-end request?')
    ).toBeInTheDocument();
    await user.click(
      screen.getAllByRole('button', { name: 'Submit request' }).at(-1)!
    );
    expect(mocks.request).toHaveBeenCalledWith({
      request: expect.objectContaining({
        effectiveDate: expect.stringMatching(
          /^\d{4}-(03-31|06-30|09-30|12-31)$/
        ),
      }),
    });
  });

  it('shows a rejected request reason and allows a new request', () => {
    mocks.mine.mockReturnValue({
      data: {
        ...memberTermination(MembershipTerminationStatus.REJECTED),
        rejectionReason: 'Please choose another date',
      },
      isLoading: false,
      isError: false,
    });
    renderWithIntl(<MembershipTerminationCard />, { messages });
    expect(screen.getByText('Request rejected')).toBeInTheDocument();
    expect(screen.getByText(/Please choose another date/)).toBeInTheDocument();
    expect(
      screen.getByText('You may submit a new request.')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Submit request' })
    ).toBeDisabled();
  });

  it('shows pending and approved administrative task states', () => {
    mocks.list.mockReturnValue({
      data: {
        items: [
          administratorTermination(),
          {
            ...administratorTermination(MembershipTerminationStatus.APPROVED),
            id: 'termination-2',
            confirmedEffectiveDate: '2026-09-30',
          },
        ],
      },
      isLoading: false,
      isError: false,
    });
    renderWithIntl(<MembershipTerminationCenter />, { messages });
    expect(screen.getAllByText('Test Member')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
    expect(screen.getAllByText(/September 30, 2026/)).not.toHaveLength(0);
  });

  it('approves one Membership outcome and displays bounded processing failure truth', async () => {
    mocks.list.mockReturnValue({
      data: {
        items: [
          administratorTermination(),
          {
            ...administratorTermination(MembershipTerminationStatus.APPROVED),
            id: 'termination-2',
            confirmedEffectiveDate: '2026-09-30',
            lastProcessingFailure: {
              code: 'CONFLICT',
              message: 'Current Membership state needs administrator review.',
              failedAt: '2026-09-30T02:15:00.000Z',
            },
          },
        ],
      },
      isLoading: false,
      isError: false,
    });
    renderWithIntl(<MembershipTerminationCenter />, { messages });
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Approve' }));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(mocks.approve).toHaveBeenCalledWith({
      id: 'termination-1',
      request: {
        effectiveTiming: 'scheduled',
        note: undefined,
      },
    });
    expect(
      screen.getByText(
        'When effective, Membership and current Member Player participation end, and current Team assignments are removed.'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText('Current Membership state needs administrator review.')
    ).toBeInTheDocument();
    expect(screen.getByText(/Code: CONFLICT/)).toBeInTheDocument();
  });

  it('rejects with a required reason and no second confirmation', async () => {
    mocks.list.mockReturnValue({
      data: { items: [administratorTermination()] },
      isLoading: false,
      isError: false,
    });
    renderWithIntl(<MembershipTerminationCenter />, { messages });
    const user = userEvent.setup();
    const rejectButton = screen.getByRole('button', { name: 'Reject' });
    expect(rejectButton).toBeDisabled();
    await user.type(
      screen.getByLabelText('Rejection reason'),
      'Please choose another date'
    );
    await user.click(rejectButton);
    expect(mocks.reject).toHaveBeenCalledWith({
      id: 'termination-1',
      request: { reason: 'Please choose another date' },
    });
    expect(
      screen.queryByText('Approve requested end date?')
    ).not.toBeInTheDocument();
  });

  it('presents a direct rejection failure without an unhandled rejection', async () => {
    mocks.reject.mockRejectedValue(new Error('Reject failed'));
    mocks.list.mockReturnValue({
      data: { items: [administratorTermination()] },
      isLoading: false,
      isError: false,
    });
    renderWithIntl(<MembershipTerminationCenter />, { messages });
    const user = userEvent.setup();
    await user.type(
      screen.getByLabelText('Rejection reason'),
      'Needs correction'
    );
    await user.click(screen.getByRole('button', { name: 'Reject' }));
    expect(await screen.findByText('Reject failed')).toBeInTheDocument();
  });

  it('routes a stale online request to rejection', () => {
    mocks.list.mockReturnValue({
      data: {
        items: [
          {
            ...administratorTermination(),
            requestedAt: '2019-01-01T00:00:00.000Z',
            requestedEffectiveDate: '2020-03-31',
          },
        ],
      },
      isLoading: false,
      isError: false,
    });
    renderWithIntl(<MembershipTerminationCenter />, { messages });
    expect(screen.getByText(/cannot be approved/)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Approve' })
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeDisabled();
  });

  it('selects Members by recognizable identity and submits stable IDs', async () => {
    mocks.list.mockReturnValue({
      data: { items: [] },
      isLoading: false,
      isError: false,
    });
    renderWithIntl(<MembershipTerminationCenter />, { messages });
    const user = userEvent.setup();

    const batchSearch = screen.getAllByLabelText('Select member')[1];
    await user.type(batchSearch, 'member');
    const first = screen.getAllByRole('button', {
      name: /Member, Testmember@example.test/,
    });
    await user.click(first[1]);
    const second = screen.getAllByRole('button', {
      name: /Member, Secondsecond@example.test/,
    });
    await user.click(second[1]);
    await user.clear(batchSearch);
    expect(screen.getByText('Selected: 2 of 50')).toBeInTheDocument();
    await user.click(
      screen.getAllByRole('combobox', { name: 'Membership end date' })[1]
    );
    await user.click(screen.getAllByRole('option')[0]);
    await user.click(screen.getByRole('button', { name: 'Record batch' }));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(mocks.batch).toHaveBeenCalledWith({
      request: {
        userIds: ['user-1', 'user-2'],
        effectiveTiming: 'scheduled',
        effectiveDate: expect.stringMatching(
          /^\d{4}-(03-31|06-30|09-30|12-31)$/
        ),
        note: undefined,
      },
    });
    expect(
      await screen.findByText('Created: 1; failed: 1')
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Suspend account' })
    ).not.toBeInTheDocument();
  });

  it('does not render stale member results while a new search is pending', () => {
    mocks.list.mockReturnValue({
      data: { items: [] },
      isLoading: false,
      isError: false,
    });
    mocks.memberList.mockReturnValue({
      data: { items: members },
      isLoading: false,
      isPlaceholderData: true,
      isError: false,
      refetch: vi.fn(),
    });

    renderWithIntl(<MembershipTerminationCenter />, { messages });

    expect(screen.getAllByText('Searching members...')).toHaveLength(2);
    expect(
      screen.queryByRole('button', {
        name: /Member, Testmember@example.test/,
      })
    ).not.toBeInTheDocument();
  });

  it('uses local X deselection without a backend mutation', async () => {
    mocks.list.mockReturnValue({
      data: { items: [] },
      isLoading: false,
      isError: false,
    });
    renderWithIntl(<MembershipTerminationCenter />, { messages });
    const user = userEvent.setup();
    await user.click(
      screen.getAllByRole('button', {
        name: /Member, Testmember@example.test/,
      })[0]
    );
    await user.click(
      screen.getByRole('button', {
        name: 'Remove Member, Test from selection',
      })
    );
    expect(
      screen.queryByRole('button', {
        name: 'Remove Member, Test from selection',
      })
    ).not.toBeInTheDocument();
    expect(mocks.offline).not.toHaveBeenCalled();
    expect(mocks.batch).not.toHaveBeenCalled();
  });

  it('requires a reason and submits Today without a client date', async () => {
    mocks.list.mockReturnValue({
      data: { items: [] },
      isLoading: false,
      isError: false,
    });
    renderWithIntl(<MembershipTerminationCenter />, { messages });
    const user = userEvent.setup();

    const offlineResult = screen.getAllByRole('button', {
      name: /Member, Testmember@example.test/,
    })[0];
    await user.click(offlineResult);
    await user.type(
      screen.getByLabelText('Request received at'),
      '2026-08-15T12:00'
    );
    const todayButtons = screen.getAllByRole('button', {
      name: 'End membership today',
    });
    expect(todayButtons[0]).toBeDisabled();
    await user.type(screen.getAllByLabelText('Reason')[0], 'Exceptional exit');
    await user.click(todayButtons[0]);
    await user.click(
      screen.getAllByRole('button', { name: 'End membership today' }).at(-1)!
    );

    expect(mocks.offline).toHaveBeenCalledWith({
      request: expect.objectContaining({
        userId: 'user-1',
        effectiveTiming: 'today',
        note: 'Exceptional exit',
      }),
    });
    expect(mocks.offline.mock.calls[0][0].request).not.toHaveProperty(
      'effectiveDate'
    );
  });
});
