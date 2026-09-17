import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithIntl, screen } from '../utils/renderWithIntl';
import dashboard from '../../../messages/en/dashboard.json';
import dashboardDe from '../../../messages/de/dashboard.json';
import dashboardZh from '../../../messages/zh/dashboard.json';
import common from '../../../messages/en/common.json';

const mocks = vi.hoisted(() => ({
  approve: vi.fn(),
  reject: vi.fn(),
  contact: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
}));
vi.mock('@app/services/membershipApplicationService', () => ({
  MembershipApplicationService: {
    useApproveApplication: () => ({ mutateAsync: mocks.approve }),
    useRejectApplication: () => ({ mutateAsync: mocks.reject }),
    useContactApplicant: () => ({ mutateAsync: mocks.contact }),
  },
}));
vi.mock('sonner', () => ({
  toast: { success: mocks.success, warning: mocks.warning, error: mocks.error },
}));

import ApplicationReviewModal from '@app/components/Dashboard/modals/ApplicationReviewModal';
import ContactApplicantModal from '@app/components/Dashboard/modals/ContactApplicantModal';

const renderModal = (
  ui: React.ReactElement,
  locale = 'en',
  dashboardMessages = dashboard
) =>
  renderWithIntl(ui, {
    locale,
    messages: { dashboard: dashboardMessages, common },
  });

const application = {
  id: 'application-1',
  status: 'pending',
  membershipType: 'student',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
  verifiedEmail: 'member@example.test',
  communicationLocale: 'en' as const,
  studentProof: [],
  bankingSummary: { present: true, complete: true, ibanLastFour: '2051' },
  signedApplicationReceipt: {
    receivedAt: '2026-08-01T00:00:00.000Z',
    receivedBy: 'admin-1',
  },
  signedSepaReceipt: {
    receivedAt: '2026-08-01T00:00:00.000Z',
    receivedBy: 'admin-1',
  },
  personalInfo: {
    firstName: 'Test',
    lastName: 'Member',
    email: 'member@example.test',
    phone: '+49123456789',
    dateOfBirth: '1990-01-01',
    gender: 'female',
    address: {
      street: 'Main 1',
      postalCode: '78647',
      city: 'Trossingen',
      country: 'DE',
    },
  },
};

describe('administrator Membership Application decision UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.approve.mockResolvedValue({
      data: {
        setupRequired: false,
        deliveryStatus: 'sent',
        decisionDeliveryStatus: 'sent',
      },
    });
    mocks.reject.mockResolvedValue({
      data: {
        ...application,
        status: 'rejected',
        decisionNotificationStatus: 'sent',
      },
    });
  });

  it('requires a second approval confirmation and states that no Player is created', async () => {
    renderModal(
      <ApplicationReviewModal
        isOpen
        onClose={vi.fn()}
        application={application as never}
        action="approve"
      />
    );
    expect(screen.getByText(/Student proof is missing/)).toHaveTextContent(
      /does not block approval/
    );
    await userEvent.type(
      screen.getByLabelText('Applicant-visible approval message (Optional)'),
      'Welcome'
    );
    await userEvent.type(
      screen.getByLabelText('Internal review note (Optional)'),
      'Internal only'
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Continue to confirmation' })
    );
    expect(screen.getByRole('alert')).toHaveTextContent(/active Membership/);
    expect(screen.getByRole('alert')).toHaveTextContent(
      /does not create a Player/
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Confirm active Membership & send' })
    );
    expect(mocks.approve).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'application-1',
        reviewNote: 'Internal only',
        approvalMessage: 'Welcome',
      })
    );
  });

  it('blocks approval when banking or signed-document gates are incomplete', () => {
    renderModal(
      <ApplicationReviewModal
        isOpen
        onClose={vi.fn()}
        application={
          {
            ...application,
            bankingSummary: {
              present: true,
              complete: false,
              ibanLastFour: '2051',
            },
            signedSepaReceipt: undefined,
          } as never
        }
        action="approve"
      />
    );

    expect(screen.getByText(/Banking information:/)).toHaveTextContent(
      'incomplete'
    );
    expect(screen.getByText(/Signed SEPA mandate:/)).toHaveTextContent(
      'missing or reset'
    );
    expect(
      screen.getByRole('button', { name: 'Continue to confirmation' })
    ).toBeDisabled();
  });

  it('keeps applicant rejection reason separate from the internal review note', async () => {
    renderModal(
      <ApplicationReviewModal
        isOpen
        onClose={vi.fn()}
        application={application as never}
        action="reject"
      />
    );
    await userEvent.type(
      screen.getByLabelText('Applicant-visible rejection reason *'),
      'Capacity reached'
    );
    await userEvent.type(
      screen.getByLabelText('Internal review note (Optional)'),
      'Discussed at meeting'
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Reject & Send Email' })
    );
    expect(mocks.reject).toHaveBeenCalledWith({
      id: 'application-1',
      reason: 'Capacity reached',
      reviewNote: 'Discussed at meeting',
    });
  });

  it.each([
    ['de', 'German'],
    ['en', 'English'],
    ['zh', 'Chinese'],
  ] as const)('shows the stored %s recipient language beside decision text', (communicationLocale, language) => {
    renderModal(
      <ApplicationReviewModal
        isOpen
        onClose={vi.fn()}
        application={{ ...application, communicationLocale } as never}
        action="reject"
      />
    );

    const decision = screen.getByLabelText(
      'Applicant-visible rejection reason *'
    );
    expect(
      screen.getByText(
        `Write this recipient-visible text in ${language}. It will be included unchanged in the applicant's email.`
      )
    ).toBeVisible();
    expect(decision).toHaveAttribute(
      'aria-describedby',
      'decision-message-language decision-message-error'
    );
    expect(
      screen.getByText(/Internal review notes are never included/)
    ).toBeVisible();
  });

  it('shows the stored recipient language beside contact text', () => {
    renderModal(
      <ContactApplicantModal
        isOpen
        onClose={vi.fn()}
        application={{ ...application, communicationLocale: 'zh' } as never}
      />
    );

    const message = screen.getByLabelText('Message *');
    expect(
      screen.getByText(
        "Write this message in Chinese. It will be included unchanged in the applicant's email."
      )
    ).toBeVisible();
    expect(message).toHaveAttribute(
      'aria-describedby',
      'contact-message-language contact-message-error'
    );
  });

  it('preserves a failed correction message so the administrator can retry it', async () => {
    mocks.contact
      .mockRejectedValueOnce(new Error('delivery failed'))
      .mockResolvedValueOnce(undefined);
    renderModal(
      <ContactApplicantModal
        isOpen
        onClose={vi.fn()}
        application={application as never}
      />
    );
    const message = screen.getByLabelText('Message *');
    await userEvent.type(message, 'Please correct your address');
    await userEvent.click(screen.getByRole('button', { name: 'Send Message' }));
    expect(message).toHaveValue('Please correct your address');
    await userEvent.click(screen.getByRole('button', { name: 'Send Message' }));
    expect(mocks.contact).toHaveBeenCalledTimes(2);
    expect(mocks.contact).toHaveBeenLastCalledWith({
      id: 'application-1',
      message: 'Please correct your address',
    });
  });

  it('shows truthful delivery guidance instead of a synthesized full email preview', () => {
    renderModal(
      <ApplicationReviewModal
        isOpen
        onClose={vi.fn()}
        application={application as never}
        action="approve"
      />
    );

    expect(
      screen.getByText(/configured localized Membership Application email/)
    ).toBeVisible();
    expect(
      screen.queryByText('Willkommen beim BC Trossingen!')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Preview Email/ })
    ).not.toBeInTheDocument();
  });

  it('uses the active locale for irreversible decision and contact controls', () => {
    renderModal(
      <ApplicationReviewModal
        isOpen
        onClose={vi.fn()}
        application={application as never}
        action="reject"
      />,
      'de',
      dashboardDe
    );

    expect(
      screen.getByLabelText(
        'Sichtbarer Ablehnungsgrund für den Antragsteller *'
      )
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Ablehnen und E-Mail senden' })
    ).toBeVisible();
    expect(
      screen.getByText('Diese Aktion kann nicht rückgängig gemacht werden')
    ).toBeVisible();
  });

  it('localizes recipient-language guidance in the active administrator locale', () => {
    renderModal(
      <ContactApplicantModal
        isOpen
        onClose={vi.fn()}
        application={{ ...application, communicationLocale: 'de' } as never}
      />,
      'zh',
      dashboardZh
    );

    expect(
      screen.getByText(
        '请使用德语填写这条消息。内容会原样加入发给申请人的邮件。'
      )
    ).toBeVisible();
  });
});
