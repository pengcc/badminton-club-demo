import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const service = vi.hoisted(() => ({
  list: vi.fn(),
  stats: vi.fn(),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@app/services/guestPlayService', () => ({
  GuestPlayService: {
    useRequestList: service.list,
    useStats: service.stats,
  },
}));

vi.mock('@app/components/Dashboard/modals/GuestPlayDetailsModal', () => ({
  default: () => null,
}));

import GuestPlayManagement from '@app/components/Dashboard/GuestPlayManagement';

describe('Guest Play administration filters', () => {
  beforeEach(() => {
    HTMLElement.prototype.hasPointerCapture = () => false;
    HTMLElement.prototype.setPointerCapture = () => {};
    HTMLElement.prototype.releasePointerCapture = () => {};
    HTMLElement.prototype.scrollIntoView = () => {};
    vi.clearAllMocks();
    service.list.mockReturnValue({
      data: { requests: [], total: 0, limit: 100, offset: 0 },
      isPending: false,
      isError: false,
    });
    service.stats.mockReturnValue({ data: undefined });
  });

  it('preserves status and archive query transitions through shared Select', async () => {
    const user = userEvent.setup();
    render(<GuestPlayManagement />);

    await user.click(screen.getByLabelText('admin.statusFilter'));
    await user.click(screen.getByRole('option', { name: 'status.approved' }));
    await waitFor(() =>
      expect(service.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: 'approved', archived: 'exclude' })
      )
    );

    await user.click(screen.getByLabelText('admin.archiveFilter'));
    await user.click(screen.getByRole('option', { name: 'admin.archived' }));
    await waitFor(() =>
      expect(service.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: 'approved', archived: 'only' })
      )
    );
  });
});
