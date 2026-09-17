import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import dashboardMessages from '../../../messages/en/dashboard.json';

const services = vi.hoisted(() => ({
  create: { mutateAsync: vi.fn(), isPending: false },
  update: { mutateAsync: vi.fn(), isPending: false },
  toggle: { mutateAsync: vi.fn(), isPending: false },
  remove: { mutateAsync: vi.fn(), isPending: false },
  requestPublication: vi.fn(),
  locations: [] as Array<Record<string, unknown>>,
  query: {
    isLoading: false,
    isError: false,
    isRefetchError: false,
    isFetching: false,
    refetch: vi.fn(),
  },
}));

vi.mock('@app/services/locationService', () => ({
  LocationService: {
    useAdminLocations: () => ({ data: services.locations, ...services.query }),
    useLocation: () => ({ data: undefined, isFetching: false }),
    useCreateLocation: () => services.create,
    useUpdateLocation: () => services.update,
    useToggleLocation: () => services.toggle,
    useDeleteLocation: () => services.remove,
  },
}));
vi.mock('@app/lib/publication', () => ({
  requestPublication: services.requestPublication,
}));

import LocationManager from '@app/components/Dashboard/LocationManager';

function renderManager() {
  return render(
    <NextIntlClientProvider
      locale="en"
      messages={{ dashboard: dashboardMessages }}
    >
      <LocationManager />
    </NextIntlClientProvider>
  );
}

describe('LocationManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    services.locations = [];
    Object.assign(services.query, {
      isLoading: false,
      isError: false,
      isRefetchError: false,
      isFetching: false,
    });
    services.toggle.mutateAsync.mockResolvedValue(undefined);
    services.requestPublication.mockResolvedValue(undefined);
  });

  it('uses structured controls for weekly time-slot administration', () => {
    renderManager();

    fireEvent.click(screen.getByRole('button', { name: 'New Location' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add Time' }));

    expect(screen.getByLabelText('Weekday')).toBeInTheDocument();
    expect(screen.getByLabelText('Start')).toHaveAttribute('type', 'time');
    expect(screen.getByLabelText('End')).toHaveAttribute('type', 'time');
    expect(screen.getByLabelText('Active')).toBeChecked();
    const guestPlayControl = screen.getByLabelText('Available for Guest Play');
    expect(guestPlayControl).toBeChecked();
    fireEvent.click(guestPlayControl);
    expect(guestPlayControl).not.toBeChecked();
    expect(screen.getByLabelText('Available for Taster Session')).toBeChecked();
    expect(screen.getByLabelText('Beginner')).toBeChecked();
    expect(screen.getByLabelText('Experienced')).toBeChecked();
    expect(
      screen.getByLabelText('Participation note (English, optional)')
    ).toBeInTheDocument();
  });

  it('preserves a valid Taster level selection independently from Guest Play', () => {
    renderManager();

    fireEvent.click(screen.getByRole('button', { name: 'New Location' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add Time' }));

    const guestPlay = screen.getByLabelText('Available for Guest Play');
    const tasterSession = screen.getByLabelText('Available for Taster Session');
    const beginner = screen.getByLabelText('Beginner');
    const experienced = screen.getByLabelText('Experienced');

    fireEvent.click(experienced);
    expect(beginner).toBeChecked();
    expect(experienced).not.toBeChecked();
    fireEvent.click(experienced);
    fireEvent.click(beginner);
    expect(beginner).not.toBeChecked();
    expect(experienced).toBeChecked();

    fireEvent.click(experienced);
    expect(experienced).toBeChecked();
    expect(
      screen.getByText(
        'Keep at least one visitor level selected while Taster Session is available.'
      )
    ).toBeInTheDocument();

    fireEvent.click(guestPlay);
    expect(guestPlay).not.toBeChecked();
    expect(tasterSession).toBeChecked();
    expect(experienced).toBeChecked();

    fireEvent.click(tasterSession);
    expect(beginner).toBeDisabled();
    expect(experienced).toBeDisabled();
    fireEvent.click(tasterSession);
    expect(experienced).toBeChecked();
    expect(beginner).not.toBeChecked();
    expect(guestPlay).not.toBeChecked();
  });

  it('names row actions and reflects active and hidden toggle states', async () => {
    services.locations = [
      {
        id: 'location-1',
        name: 'Sports Hall: TU',
        address: 'Tempelhofer Ufer 19',
        timeSlots: [],
        imageUrl: '',
        order: 0,
        isActive: true,
      },
    ];
    const view = renderManager();

    fireEvent.click(
      screen.getByRole('button', { name: 'Hide location Sports Hall: TU' })
    );
    await waitFor(() =>
      expect(services.toggle.mutateAsync).toHaveBeenCalledWith('location-1')
    );
    expect(
      screen.getByRole('button', { name: 'Edit location Sports Hall: TU' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Delete location Sports Hall: TU' })
    ).toBeInTheDocument();

    services.locations = [{ ...services.locations[0], isActive: false }];
    view.rerender(
      <NextIntlClientProvider
        locale="en"
        messages={{ dashboard: dashboardMessages }}
      >
        <LocationManager />
      </NextIntlClientProvider>
    );
    expect(
      screen.getByRole('button', { name: 'Show location Sports Hall: TU' })
    ).toBeInTheDocument();
  });

  it('shows a retryable failure instead of mutation controls on initial query failure', () => {
    services.locations = undefined as unknown as Array<Record<string, unknown>>;
    services.query.isError = true;

    renderManager();

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Training locations could not be loaded'
    );
    expect(
      screen.queryByRole('button', { name: 'New Location' })
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(services.query.refetch).toHaveBeenCalledTimes(1);
  });

  it('preserves cached empty data and reports a degraded refetch failure', () => {
    services.locations = [];
    services.query.isRefetchError = true;

    renderManager();

    expect(screen.getByRole('status')).toHaveTextContent(
      'The latest locations could not be loaded. Previously loaded data remains visible.'
    );
    expect(
      screen.getByRole('button', { name: 'New Location' })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(services.query.refetch).toHaveBeenCalledTimes(1);
  });
});
