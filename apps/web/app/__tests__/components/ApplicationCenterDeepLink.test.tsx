import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import dashboard from '../../../messages/en/dashboard.json';
import dashboardDe from '../../../messages/de/dashboard.json';
import { renderWithIntl } from '../utils/renderWithIntl';

const mocks = vi.hoisted(() => ({
  getApplication: vi.fn(),
  replace: vi.fn(),
  search: new URLSearchParams('application=target-application'),
  useApplicationList: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/en/dashboard/applications',
  useRouter: () => ({ replace: mocks.replace }),
  useSearchParams: () => mocks.search,
}));

vi.mock('@app/services/membershipApplicationService', () => ({
  MembershipApplicationService: {
    getApplication: mocks.getApplication,
    useApplicationList: mocks.useApplicationList,
  },
}));

vi.mock('@app/components/Dashboard/modals/ApplicationDetailsModal', () => ({
  default: ({ isOpen, application, onClose }: any) =>
    isOpen ? (
      <div role="dialog">
        <span>{application?.verifiedEmail}</span>
        <button onClick={onClose}>Close details</button>
      </div>
    ) : null,
}));
vi.mock('@app/components/Dashboard/modals/ApplicationReviewModal', () => ({
  default: () => null,
}));
vi.mock('@app/components/Dashboard/modals/ContactApplicantModal', () => ({
  default: () => null,
}));

import ApplicationCenter from '@app/components/Dashboard/ApplicationCenter';

const target = {
  id: 'target-application',
  verifiedEmail: 'target@example.test',
  personalInfo: {
    firstName: 'Target',
    lastName: 'Applicant',
    email: 'target@example.test',
  },
  bankingSummary: { present: false, complete: false },
  status: 'pending',
  studentProof: [],
};

describe('ApplicationCenter deep-link context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.search = new URLSearchParams('application=target-application');
    mocks.useApplicationList.mockReturnValue({ data: [], isLoading: false });
    mocks.getApplication.mockResolvedValue(target);
  });

  it('resolves a target outside the loaded list and opens the existing details modal', async () => {
    renderWithIntl(<ApplicationCenter />, { messages: { dashboard } });

    expect(await screen.findByRole('dialog')).toHaveTextContent(
      'target@example.test'
    );
    expect(mocks.getApplication).toHaveBeenCalledWith('target-application');

    fireEvent.click(screen.getByRole('button', { name: 'Close details' }));
    expect(mocks.replace).toHaveBeenCalledWith('/en/dashboard/applications', {
      scroll: false,
    });
  });

  it('keeps the normal workspace usable and clears missing record context', async () => {
    mocks.getApplication.mockRejectedValue(new Error('not found'));
    renderWithIntl(<ApplicationCenter />, { messages: { dashboard } });

    await waitFor(() =>
      expect(mocks.replace).toHaveBeenCalledWith('/en/dashboard/applications', {
        scroll: false,
      })
    );
    expect(screen.getByText('Membership Applications')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('does not present an initial dependency failure as an empty queue', () => {
    mocks.search = new URLSearchParams();
    mocks.useApplicationList.mockReturnValue({
      data: undefined,
      isLoading: false,
      isLoadingError: true,
      refetch: vi.fn(),
    });

    renderWithIntl(<ApplicationCenter />, { messages: { dashboard } });

    expect(screen.getByText('Applications could not be loaded')).toBeVisible();
    expect(screen.queryByText('No applications found')).not.toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('keeps an independently resolved deep link usable when the queue fails', async () => {
    mocks.useApplicationList.mockReturnValue({
      data: undefined,
      isLoading: false,
      isLoadingError: true,
      refetch: vi.fn(),
    });

    renderWithIntl(<ApplicationCenter />, { messages: { dashboard } });

    expect(await screen.findByRole('dialog')).toHaveTextContent(
      'target@example.test'
    );
    expect(screen.getByText('Applications could not be loaded')).toBeVisible();
    expect(screen.queryByText('No applications found')).not.toBeInTheDocument();
  });

  it('retains populated data and exposes retry after a background failure', () => {
    const refetch = vi.fn();
    mocks.search = new URLSearchParams();
    mocks.useApplicationList.mockReturnValue({
      data: [target],
      isLoading: false,
      isLoadingError: false,
      isRefetchError: true,
      isFetching: false,
      refetch,
    });

    renderWithIntl(<ApplicationCenter />, { messages: { dashboard } });

    expect(screen.getByText('Target Applicant')).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent(
      'previously loaded data'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it('uses the active locale for application queue discovery copy', () => {
    mocks.search = new URLSearchParams();

    renderWithIntl(<ApplicationCenter />, {
      locale: 'de',
      messages: { dashboard: dashboardDe },
    });

    expect(screen.getByText('Mitgliedschaftsanträge')).toBeVisible();
    expect(
      screen.getByPlaceholderText('Nach Name oder E-Mail suchen...')
    ).toBeVisible();
  });
});
