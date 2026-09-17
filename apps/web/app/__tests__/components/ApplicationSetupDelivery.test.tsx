import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithIntl, screen } from '../utils/renderWithIntl';
import commonEn from '../../../messages/en/common.json';
import dashboardEn from '../../../messages/en/dashboard.json';

const mocks = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
}));
vi.mock('@app/services/membershipApplicationService', () => ({
  MembershipApplicationService: {
    useReissuePasswordSetup: () => ({
      mutateAsync: mocks.mutateAsync,
      isPending: false,
    }),
  },
}));
vi.mock('sonner', () => ({
  toast: { success: mocks.success, warning: mocks.warning, error: mocks.error },
}));

import ApplicationDetailsModal from '@app/components/Dashboard/modals/ApplicationDetailsModal';

const messages = {
  common: {
    ...commonEn,
    setupDelivery: {
      sent: 'sent',
      failed: 'failed',
      uncertain: 'uncertain',
      notRequired: 'not required',
      reissue: 'Reissue setup email',
      reissuing: 'Reissuing',
      reissued: 'New setup sent',
      reissueFailed: 'Reissue failed',
    },
  },
  dashboard: dashboardEn,
};
const application = {
  id: 'application-1',
  status: 'approved',
  membershipType: 'regular',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  verifiedEmail: 'member@example.test',
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
  bankingSummary: { present: false, complete: false },
  studentProof: [],
};

describe('application setup delivery recovery UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mutateAsync.mockResolvedValue({
      generation: 2,
      deliveryStatus: 'sent',
    });
  });
  it('allows an administrator to explicitly reissue and reports the new delivery outcome', async () => {
    renderWithIntl(
      <ApplicationDetailsModal
        isOpen
        onClose={vi.fn()}
        application={application as never}
      />,
      { messages }
    );
    await userEvent.click(
      screen.getByRole('button', { name: /Reissue setup email/ })
    );
    expect(mocks.mutateAsync).toHaveBeenCalledWith({ id: 'application-1' });
    expect(mocks.success).toHaveBeenCalledWith('New setup sent');
  });
});
