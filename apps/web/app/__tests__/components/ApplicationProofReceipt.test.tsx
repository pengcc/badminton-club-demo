import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithIntl, screen } from '../utils/renderWithIntl';
import commonEn from '../../../messages/en/common.json';
import dashboardEn from '../../../messages/en/dashboard.json';
import commonDe from '../../../messages/de/common.json';
import dashboardDe from '../../../messages/de/dashboard.json';
import commonZh from '../../../messages/zh/common.json';
import dashboardZh from '../../../messages/zh/dashboard.json';

const mocks = vi.hoisted(() => ({
  confirm: vi.fn(),
  reset: vi.fn(),
  deleteProof: vi.fn(),
  downloadProof: vi.fn(),
  viewProof: vi.fn(),
  retryDecision: vi.fn(),
  updateNote: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock('@app/services/membershipApplicationService', () => ({
  MembershipApplicationService: {
    useReissuePasswordSetup: () => ({ mutateAsync: vi.fn(), isPending: false }),
  },
}));
vi.mock('@app/lib/api/membershipApplicationApi', () => ({
  confirmSignedReceipt: mocks.confirm,
  resetSignedReceipt: mocks.reset,
  deleteAdminStudentProof: mocks.deleteProof,
  downloadAdminStudentProof: mocks.downloadProof,
  viewAdminStudentProof: mocks.viewProof,
  retryDecisionNotification: mocks.retryDecision,
  updateApplicationReviewNote: mocks.updateNote,
}));
vi.mock('sonner', () => ({
  toast: { success: mocks.success, warning: vi.fn(), error: mocks.error },
}));

import ApplicationDetailsModal from '@app/components/Dashboard/modals/ApplicationDetailsModal';

const base = {
  id: 'application-1',
  status: 'pending',
  membershipType: 'student',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
  submittedAt: '2026-08-01T00:00:00.000Z',
  verifiedEmail: 'student@example.test',
  personalInfo: {
    firstName: 'Student',
    lastName: 'Member',
    email: 'student@example.test',
    phone: '+49123456789',
    dateOfBirth: '2000-01-01',
    gender: 'female',
    address: {
      street: 'Main 1',
      postalCode: '78647',
      city: 'Trossingen',
      country: 'DE',
    },
  },
  bankingSummary: { present: false, complete: false },
  studentProof: [],
};

describe('administrator student proof and signed receipt UI', () => {
  const intl = { messages: { common: commonEn, dashboard: dashboardEn } };
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.confirm.mockResolvedValue({
      ...base,
      signedApplicationReceipt: {
        receivedAt: '2026-08-02T00:00:00.000Z',
        receivedBy: 'admin-1',
      },
    });
    mocks.deleteProof.mockResolvedValue(undefined);
    mocks.viewProof.mockResolvedValue(new Blob(['%PDF-']));
    mocks.updateNote.mockImplementation(
      async (_id: string, reviewNote: string) => ({ ...base, reviewNote })
    );
  });

  it('shows missing proof without making it an approval gate and confirms signed application receipt', async () => {
    renderWithIntl(
      <ApplicationDetailsModal
        isOpen
        onClose={vi.fn()}
        application={base as never}
      />,
      intl
    );
    expect(
      screen.getByText(/No student proof has been uploaded/)
    ).toHaveTextContent(/does not block approval/);
    const confirmButtons = screen.getAllByRole('button', {
      name: 'Confirm received',
    });
    expect(confirmButtons).toHaveLength(2);
    expect(confirmButtons[1]).toBeDisabled();
    await userEvent.click(confirmButtons[0]);
    expect(mocks.confirm).toHaveBeenCalledWith('application-1', 'application');
    expect(await screen.findByText(/Received/)).toBeInTheDocument();
  });

  it('saves an internal-only review note through the explicit review-note action', async () => {
    renderWithIntl(
      <ApplicationDetailsModal
        isOpen
        onClose={vi.fn()}
        application={base as never}
      />,
      intl
    );
    await userEvent.type(
      screen.getByLabelText('Internal review note'),
      'Internal only'
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Save internal note' })
    );
    expect(mocks.updateNote).toHaveBeenCalledWith(
      'application-1',
      'Internal only'
    );
  });

  it('allows explicit deletion of retained private proof', async () => {
    renderWithIntl(
      <ApplicationDetailsModal
        isOpen
        onClose={vi.fn()}
        application={
          {
            ...base,
            studentProof: [
              {
                id: 'proof-1.pdf',
                originalName: 'proof.pdf',
                mimeType: 'application/pdf',
                size: 10,
                createdAt: '2026-08-01T00:00:00.000Z',
              },
            ],
          } as never
        }
      />,
      intl
    );
    await userEvent.click(screen.getByRole('button', { name: 'View' }));
    expect(mocks.viewProof).toHaveBeenCalledWith(
      'application-1',
      'proof-1.pdf'
    );
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(mocks.deleteProof).toHaveBeenCalledWith(
      'application-1',
      'proof-1.pdf'
    );
    expect(screen.queryByText('proof.pdf')).not.toBeInTheDocument();
  });

  it('shows and retries a failed terminal decision notification', async () => {
    const rejected = {
      ...base,
      status: 'rejected',
      rejectionReason: 'Capacity',
      decisionNotificationKind: 'rejection',
      decisionNotificationStatus: 'failed',
    };
    mocks.retryDecision.mockResolvedValue({
      ...rejected,
      decisionNotificationStatus: 'sent',
    });
    renderWithIntl(
      <ApplicationDetailsModal
        isOpen
        onClose={vi.fn()}
        application={rejected as never}
      />,
      intl
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Retry decision email' })
    );
    expect(mocks.retryDecision).toHaveBeenCalledWith('application-1');
    expect(await screen.findByText('Delivery: Sent')).toBeInTheDocument();
  });

  it('renders audited labels and machine values in Chinese without English leakage', () => {
    renderWithIntl(
      <ApplicationDetailsModal
        isOpen
        onClose={vi.fn()}
        application={base as never}
      />,
      { locale: 'zh', messages: { common: commonZh, dashboard: dashboardZh } }
    );

    expect(screen.getByText('申请状态')).toBeInTheDocument();
    expect(screen.getByText('女')).toBeInTheDocument();
    expect(screen.getByText('学生会员')).toBeInTheDocument();
    expect(screen.getByText(/尚未上传学生证明/)).toBeInTheDocument();
    expect(screen.queryByText('female')).not.toBeInTheDocument();
    expect(screen.queryByText('student')).not.toBeInTheDocument();
    expect(screen.queryByText('Application Status')).not.toBeInTheDocument();
  });

  it('localizes non-binary gender and pending decision delivery in Chinese', () => {
    renderWithIntl(
      <ApplicationDetailsModal
        isOpen
        onClose={vi.fn()}
        application={
          {
            ...base,
            status: 'approved',
            decisionNotificationStatus: 'pending',
            personalInfo: { ...base.personalInfo, gender: 'non-binary' },
          } as never
        }
      />,
      { locale: 'zh', messages: { common: commonZh, dashboard: dashboardZh } }
    );

    expect(screen.getByText('其他')).toBeInTheDocument();
    expect(screen.getByText('发送状态：待发送')).toBeInTheDocument();
    expect(screen.queryByText('non-binary')).not.toBeInTheDocument();
    expect(screen.queryByText('pending')).not.toBeInTheDocument();
  });

  it('renders audited labels and machine values in German without English leakage', () => {
    renderWithIntl(
      <ApplicationDetailsModal
        isOpen
        onClose={vi.fn()}
        application={base as never}
      />,
      { locale: 'de', messages: { common: commonDe, dashboard: dashboardDe } }
    );

    expect(screen.getByText('Antragsstatus')).toBeInTheDocument();
    expect(screen.getByText('Weiblich')).toBeInTheDocument();
    expect(screen.getByText('Studenten-Mitgliedschaft')).toBeInTheDocument();
    expect(screen.getByText(/kein Studierendennachweis/)).toBeInTheDocument();
    expect(screen.queryByText('female')).not.toBeInTheDocument();
    expect(screen.queryByText('student')).not.toBeInTheDocument();
    expect(screen.queryByText('Application Status')).not.toBeInTheDocument();
  });
});
