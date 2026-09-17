import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  GuestPlayAdminResponse,
  GuestPlayMemberResponse,
  GuestPlayNotificationStatus,
  GuestPlayStatus,
} from '@club/shared-types/api/guestPlay';
import deMessages from '@messages/de/common.json';
import enMessages from '@messages/en/common.json';
import zhMessages from '@messages/zh/common.json';

const api = vi.hoisted(() => ({
  getOpportunities: vi.fn(),
  createRequest: vi.fn(),
  getMyRequests: vi.fn(),
  cancelRequest: vi.fn(),
  getAllRequests: vi.fn(),
  getStats: vi.fn(),
  getRequestById: vi.fn(),
  decide: vi.fn(),
  correct: vi.fn(),
  archive: vi.fn(),
  restore: vi.fn(),
  retryNotification: vi.fn(),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock('@app/lib/api/guestPlayApi', () => ({ guestPlayApi: api }));

import GuestPlayCenter from '@app/components/Dashboard/GuestPlayCenter';
import GuestPlayDetailsModal from '@app/components/Dashboard/modals/GuestPlayDetailsModal';

const conflict = Object.assign(new Error('conflict'), {
  response: { status: 409 },
});
const now = '2026-08-02T10:00:00.000Z';
const appointment = {
  locationId: 'location',
  timeSlotId: 'slot',
  locationName: 'Hall',
  locationAddress: 'Street 1',
  localDate: '2099-01-01',
  startTime: '19:00',
  endTime: '21:00',
  startAt: '2099-01-01T18:00:00.000Z',
};

function memberRequest(
  status: GuestPlayStatus,
  version: number
): GuestPlayMemberResponse {
  return {
    id: 'request',
    memberId: 'member',
    guestCount: 2,
    status,
    appointment,
    locale: 'en',
    version,
    createdAt: now,
    updatedAt: now,
  };
}

function notification(
  status: GuestPlayNotificationStatus,
  retryAvailable = false
) {
  return { status, attempts: 1, recipients: [], retryAvailable };
}

function adminRequest(
  status: GuestPlayStatus,
  version: number,
  options: {
    archived?: boolean;
    adminNotes?: string;
    retryStatus?: GuestPlayNotificationStatus;
  } = {}
): GuestPlayAdminResponse {
  return {
    ...memberRequest(status, version),
    memberName: 'Current Member',
    memberEmail: 'member@example.test',
    adminNotes: options.adminNotes,
    archived: options.archived ?? false,
    notifications: {
      memberReceipt: notification('sent'),
      administratorAlert: notification('sent'),
      decisionEmail: notification(
        options.retryStatus ?? 'sent',
        options.retryStatus === 'failed'
      ),
    },
  };
}

function queryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function renderAdmin(initial: GuestPlayAdminResponse) {
  return render(
    <QueryClientProvider client={queryClient()}>
      <GuestPlayDetailsModal isOpen onClose={vi.fn()} request={initial} />
    </QueryClientProvider>
  );
}

describe('Guest Play stale-command recovery', () => {
  beforeEach(() => {
    for (const mock of Object.values(api)) mock.mockReset();
  });

  it('reloads the member list after a stale cancellation', async () => {
    const pending = memberRequest('pending', 1);
    api.getMyRequests
      .mockResolvedValueOnce([pending])
      .mockResolvedValue([memberRequest('approved', 2)]);
    api.cancelRequest.mockRejectedValue(conflict);
    render(
      <QueryClientProvider client={queryClient()}>
        <GuestPlayCenter />
      </QueryClientProvider>
    );

    fireEvent.click(
      await screen.findByRole('button', { name: 'actions.cancelRequest' })
    );

    expect(await screen.findByText('errors.conflict')).toBeInTheDocument();
    expect(await screen.findByText('status.approved')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'actions.cancelRequest' })
    ).not.toBeInTheDocument();
    expect(api.getMyRequests).toHaveBeenCalledTimes(2);
  });

  it('does not claim member recovery when the conflict refetch fails', async () => {
    const pending = memberRequest('pending', 1);
    api.getMyRequests
      .mockResolvedValueOnce([pending])
      .mockRejectedValueOnce(new Error('network unavailable'));
    api.cancelRequest.mockRejectedValue(conflict);
    render(
      <QueryClientProvider client={queryClient()}>
        <GuestPlayCenter />
      </QueryClientProvider>
    );

    fireEvent.click(
      await screen.findByRole('button', { name: 'actions.cancelRequest' })
    );

    expect(await screen.findByText('errors.cancel')).toBeInTheDocument();
    expect(screen.queryByText('errors.conflict')).not.toBeInTheDocument();
  });

  it('reloads an approved decision and permits a correction from the latest version', async () => {
    const pending = adminRequest('pending', 1, { adminNotes: 'Old note' });
    const approved = adminRequest('approved', 2, {
      adminNotes: 'Latest server note',
    });
    api.getRequestById
      .mockResolvedValueOnce(pending)
      .mockResolvedValue(approved);
    api.decide.mockRejectedValue(conflict);
    api.correct.mockResolvedValue(adminRequest('declined', 3));
    renderAdmin(pending);

    fireEvent.click(
      await screen.findByRole('button', { name: 'actions.decline' })
    );

    expect(await screen.findByText('errors.conflict')).toBeInTheDocument();
    expect(await screen.findByText('status.approved')).toBeInTheDocument();
    expect(screen.getByLabelText('admin.internalNotes')).toHaveValue(
      'Latest server note'
    );
    fireEvent.change(screen.getByLabelText('admin.correctionReason'), {
      target: { value: 'Correct latest decision' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'actions.correctToDeclined' })
    );
    await waitFor(() =>
      expect(api.correct).toHaveBeenCalledWith('request', {
        expectedVersion: 2,
        decision: 'declined',
        reason: 'Correct latest decision',
        adminNotes: 'Latest server note',
      })
    );
  });

  it('does not claim administrator recovery when the conflict refetch fails', async () => {
    const pending = adminRequest('pending', 1, { adminNotes: 'Old note' });
    api.getRequestById
      .mockResolvedValueOnce(pending)
      .mockRejectedValueOnce(new Error('network unavailable'));
    api.decide.mockRejectedValue(conflict);
    renderAdmin(pending);

    fireEvent.click(
      await screen.findByRole('button', { name: 'actions.decline' })
    );

    expect(await screen.findByText('errors.command')).toBeInTheDocument();
    expect(screen.queryByText('errors.conflict')).not.toBeInTheDocument();
    expect(screen.getByLabelText('admin.internalNotes')).toHaveValue(
      'Old note'
    );
  });

  it('reloads archive state after stale archive and restore commands', async () => {
    const active = adminRequest('declined', 2);
    api.getRequestById
      .mockResolvedValueOnce(active)
      .mockResolvedValue(adminRequest('declined', 3, { archived: true }));
    api.archive.mockRejectedValue(conflict);
    const first = renderAdmin(active);
    fireEvent.click(
      await screen.findByRole('button', { name: 'actions.archive' })
    );
    expect(await screen.findByText('errors.conflict')).toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: 'actions.restore' })
    ).toBeInTheDocument();
    first.unmount();

    const archived = adminRequest('declined', 3, { archived: true });
    api.getRequestById
      .mockResolvedValueOnce(archived)
      .mockResolvedValue(adminRequest('declined', 4));
    api.restore.mockRejectedValue(conflict);
    renderAdmin(archived);
    fireEvent.click(
      await screen.findByRole('button', { name: 'actions.restore' })
    );
    expect(await screen.findByText('errors.conflict')).toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: 'actions.archive' })
    ).toBeInTheDocument();
  });

  it('reloads notification delivery state after a stale retry', async () => {
    const failed = adminRequest('declined', 2, { retryStatus: 'failed' });
    api.getRequestById
      .mockResolvedValueOnce(failed)
      .mockResolvedValue(adminRequest('declined', 3));
    api.retryNotification.mockRejectedValue(conflict);
    renderAdmin(failed);

    fireEvent.click(
      await screen.findByRole('button', { name: 'actions.retryDelivery' })
    );

    expect(await screen.findByText('errors.conflict')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'actions.retryDelivery' })
    ).not.toBeInTheDocument();
    expect(api.getRequestById).toHaveBeenCalledTimes(2);
  });

  it('provides explicit conflict recovery copy in every supported locale', () => {
    expect(enMessages.guestPlay.errors.conflict).toContain('latest state');
    expect(deMessages.guestPlay.errors.conflict).toContain('neu geladen');
    expect(zhMessages.guestPlay.errors.conflict).toContain('最新状态');
  });
});
