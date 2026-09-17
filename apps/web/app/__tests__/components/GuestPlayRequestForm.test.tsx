import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  getOpportunities: vi.fn(),
  createRequest: vi.fn(),
}));
vi.mock('next-intl', () => ({
  useLocale: () => 'de',
  useTranslations: () => (key: string, values?: { count?: number }) =>
    values?.count === undefined ? key : `${key}:${values.count}`,
}));
vi.mock('@app/lib/api/guestPlayApi', () => ({
  guestPlayApi: {
    ...api,
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
  },
}));

import GuestPlayRequestForm from '@app/components/Dashboard/GuestPlayRequestForm';

describe('Guest Play member request form', () => {
  beforeEach(() => {
    HTMLElement.prototype.hasPointerCapture = () => false;
    HTMLElement.prototype.setPointerCapture = () => {};
    HTMLElement.prototype.releasePointerCapture = () => {};
    HTMLElement.prototype.scrollIntoView = () => {};
    vi.clearAllMocks();
    api.getOpportunities.mockResolvedValue([
      {
        locationId: 'location',
        timeSlotId: 'slot',
        localDate: '2026-08-05',
        startTime: '18:00',
        endTime: '20:00',
        startAt: '2026-08-05T16:00:00.000Z',
        locationName: 'Hall',
        locationAddress: 'Street 1',
        participationNote: 'Bring indoor shoes.',
      },
    ]);
    api.createRequest.mockResolvedValue({ id: 'request' });
  });

  it('clears a selected opportunity back to the real empty state', async () => {
    const user = userEvent.setup();
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    render(
      <QueryClientProvider client={client}>
        <GuestPlayRequestForm />
      </QueryClientProvider>
    );

    const opportunity = await screen.findByLabelText('selectSession');
    await user.click(opportunity);
    await user.click(screen.getByRole('option', { name: /2026-08-05.*Hall/ }));
    expect(screen.getByText('Bring indoor shoes.')).toBeInTheDocument();

    await user.click(opportunity);
    await user.click(
      screen.getByRole('option', { name: 'form.selectPlaceholder' })
    );
    expect(screen.queryByText('Bring indoor shoes.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'form.submit' })).toBeDisabled();
    expect(api.createRequest).not.toHaveBeenCalled();
  });

  it('renders the localized participation note and submits only authoritative option identifiers', async () => {
    const user = userEvent.setup();
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    render(
      <QueryClientProvider client={client}>
        <GuestPlayRequestForm />
      </QueryClientProvider>
    );
    const opportunity = await screen.findByLabelText('selectSession');
    await user.click(opportunity);
    await user.click(screen.getByRole('option', { name: /2026-08-05.*Hall/ }));
    expect(screen.getByText('Bring indoor shoes.')).toBeInTheDocument();
    await user.click(screen.getByLabelText('guestCount'));
    await user.click(
      screen.getByRole('option', { name: 'form.guestOption:3' })
    );
    fireEvent.change(screen.getByLabelText('form.messageLabel'), {
      target: { value: 'Family visit' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'form.submit' }));
    await waitFor(() =>
      expect(api.createRequest).toHaveBeenCalledWith({
        locationId: 'location',
        timeSlotId: 'slot',
        localDate: '2026-08-05',
        guestCount: 3,
        message: 'Family visit',
        locale: 'de',
      })
    );
  });
});
