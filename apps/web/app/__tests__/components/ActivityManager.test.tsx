import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const services = vi.hoisted(() => ({
  availabilityMutation: { mutateAsync: vi.fn(), isPending: false },
  availability: {
    data: { enabled: false } as { enabled: boolean } | undefined,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  },
  create: { mutateAsync: vi.fn(), isPending: false },
  update: { mutateAsync: vi.fn(), isPending: false },
  toggle: { mutateAsync: vi.fn(), isPending: false },
  remove: { mutateAsync: vi.fn(), isPending: false },
  requestPublication: vi.fn(),
  list: {
    data: [] as Array<Record<string, unknown>> | undefined,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  },
  detail: {
    data: undefined as Record<string, unknown> | undefined,
    isPending: false,
    isFetching: false,
    isError: false,
    refetch: vi.fn(),
  },
}));
const toasts = vi.hoisted(() => ({
  success: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
}));

vi.mock('next-intl', async () => {
  const { dashboardTranslator } = await import('../testI18nMock');
  return {
    useLocale: () => 'de',
    useTranslations: dashboardTranslator,
  };
});
vi.mock('sonner', () => ({
  toast: toasts,
}));
vi.mock('@app/services/activityService', () => ({
  ActivityService: {
    useAvailability: () => services.availability,
    useUpdateAvailability: () => services.availabilityMutation,
    useAdminActivities: () => services.list,
    useActivity: () => services.detail,
    useCreateActivity: () => services.create,
    useUpdateActivity: () => services.update,
    useToggleActivity: () => services.toggle,
    useDeleteActivity: () => services.remove,
  },
}));
vi.mock('@app/lib/publication', () => ({
  requestPublication: services.requestPublication,
}));

import ActivityManager from '@app/components/Dashboard/ActivityManager';

const activityDetail = {
  id: 'activity-1',
  translations: {
    de: { name: 'Sommerfest', description: 'Deutsch' },
    en: { name: '', description: '' },
    zh: { name: '', description: '' },
  },
  images: [],
  videoLink: '',
  videoDescription: { de: '', en: '', zh: '' },
  isVisible: true,
  order: 0,
  completeness: {
    name: { complete: false, missingLanguages: ['en', 'zh'] },
    description: { complete: true, missingLanguages: [] },
    videoDescription: { complete: true, missingLanguages: [] },
  },
};

describe('ActivityManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    services.create.mutateAsync.mockResolvedValue(undefined);
    services.availabilityMutation.mutateAsync.mockImplementation(
      async (enabled) => ({ enabled })
    );
    services.availability = {
      data: { enabled: false },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    };
    services.update.mutateAsync.mockResolvedValue({
      activity: activityDetail,
      mediaCleanupWarning: null,
    });
    services.toggle.mutateAsync.mockResolvedValue(undefined);
    services.remove.mutateAsync.mockResolvedValue({
      deleted: true,
      mediaCleanupWarning: null,
    });
    services.requestPublication.mockResolvedValue(undefined);
    services.list = {
      data: [
        {
          id: 'activity-1',
          name: 'Sommerfest',
          description: 'Deutsch',
          images: [],
          videoLink: '',
          videoDescription: '',
          isVisible: true,
          order: 0,
          completeness: {
            name: { complete: false, missingLanguages: ['en', 'zh'] },
            description: { complete: true, missingLanguages: [] },
            videoDescription: { complete: true, missingLanguages: [] },
          },
        },
      ],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    };
    services.detail = {
      data: undefined,
      isPending: false,
      isFetching: false,
      isError: false,
      refetch: vi.fn(),
    };
  });

  it('keeps Activity records usable when availability fails to load', () => {
    services.availability.data = undefined;
    services.availability.isError = true;
    render(<ActivityManager />);

    expect(screen.getByText('Sommerfest')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Public availability could not be loaded. Activity content management remains available.'
      )
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(services.availability.refetch).toHaveBeenCalledTimes(1);
  });

  it('persists availability before publication and retries only publication', async () => {
    services.availability.data = { enabled: true };
    services.requestPublication
      .mockRejectedValueOnce(new Error('refresh failed'))
      .mockResolvedValueOnce(undefined);
    render(<ActivityManager />);

    fireEvent.click(screen.getByRole('button', { name: 'Disable Activities' }));

    expect(
      await screen.findByText('Saved, public refresh failed')
    ).toBeInTheDocument();
    expect(services.availabilityMutation.mutateAsync).toHaveBeenCalledWith(
      false
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Retry public refresh' })
    );
    await waitFor(() =>
      expect(services.requestPublication).toHaveBeenCalledTimes(2)
    );
    expect(services.availabilityMutation.mutateAsync).toHaveBeenCalledTimes(1);
  });

  it('surfaces incomplete translations and gives every row action an accessible name', () => {
    render(<ActivityManager />);
    expect(screen.getByText('Translations incomplete')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Hide Activity Sommerfest' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Edit Activity Sommerfest' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Delete Activity Sommerfest' })
    ).toBeInTheDocument();
  });

  it('keeps local draft values after a failed multipart save', async () => {
    services.list.data = [];
    services.create.mutateAsync.mockRejectedValueOnce({
      response: { data: { error: 'Activity image content is invalid' } },
    });
    render(<ActivityManager />);
    fireEvent.click(screen.getByRole('button', { name: 'New Activity' }));
    const name = screen.getByLabelText('Name');
    fireEvent.change(name, { target: { value: 'Lokaler Entwurf' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(services.create.mutateAsync).toHaveBeenCalled());
    expect(screen.getByDisplayValue('Lokaler Entwurf')).toBeInTheDocument();
    expect(toasts.error).toHaveBeenCalledWith('Activity could not be saved');
    expect(services.requestPublication).not.toHaveBeenCalled();
  });

  it('retries the Activities refresh without replaying persistence', async () => {
    services.list.data = [];
    services.requestPublication
      .mockRejectedValueOnce(new Error('refresh failed'))
      .mockResolvedValueOnce(undefined);
    render(<ActivityManager />);
    fireEvent.click(screen.getByRole('button', { name: 'New Activity' }));
    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Veröffentlichen' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByText('Saved, public refresh failed')
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Retry public refresh' })
    );
    await waitFor(() =>
      expect(services.requestPublication).toHaveBeenCalledTimes(2)
    );
    expect(services.requestPublication).toHaveBeenNthCalledWith(
      1,
      'activities'
    );
    expect(services.create.mutateAsync).toHaveBeenCalledTimes(1);
  });

  it('shows a retryable list failure instead of an empty create state', () => {
    services.list.data = undefined;
    services.list.isError = true;
    render(<ActivityManager />);

    expect(
      screen.getByText('Activities could not be loaded')
    ).toBeInTheDocument();
    expect(screen.queryByText('No activities yet')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'New Activity' })
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(services.list.refetch).toHaveBeenCalledTimes(1);
  });

  it('does not expose editable values or Save when detail loading fails', () => {
    services.detail.isError = true;
    render(<ActivityManager />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Edit Activity Sommerfest' })
    );

    expect(
      screen.getByText('Activity could not be loaded')
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Save' })
    ).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('Sommerfest')).not.toBeInTheDocument();
  });

  it('clears the previous Activity while a newly selected detail loads', async () => {
    services.list.data = [
      ...(services.list.data ?? []),
      {
        ...(services.list.data?.[0] ?? {}),
        id: 'activity-2',
        name: 'Winterfest',
      },
    ];
    services.detail.data = activityDetail;
    const { rerender } = render(<ActivityManager />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Edit Activity Sommerfest' })
    );
    expect(await screen.findByDisplayValue('Sommerfest')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Edit Activity Winterfest' })
    );
    rerender(<ActivityManager />);

    expect(screen.getByText('Loading Activity…')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Sommerfest')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Save' })
    ).not.toBeInTheDocument();
    expect(services.update.mutateAsync).not.toHaveBeenCalled();
  });

  it('opens only the intended Activity after a detail retry succeeds', async () => {
    services.detail.isError = true;
    const { rerender } = render(<ActivityManager />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Edit Activity Sommerfest' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(services.detail.refetch).toHaveBeenCalledTimes(1);

    services.detail = {
      data: activityDetail,
      isPending: false,
      isFetching: false,
      isError: false,
      refetch: services.detail.refetch,
    };
    rerender(<ActivityManager />);

    expect(await screen.findByDisplayValue('Sommerfest')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(services.update.mutateAsync).toHaveBeenCalledTimes(1)
    );
  });

  it('keeps the initialized editor available during a background refresh', async () => {
    services.detail.data = activityDetail;
    const { rerender } = render(<ActivityManager />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Edit Activity Sommerfest' })
    );
    const name = await screen.findByDisplayValue('Sommerfest');
    fireEvent.change(name, { target: { value: 'Lokaler Entwurf' } });

    services.detail.isFetching = true;
    rerender(<ActivityManager />);

    expect(screen.getByDisplayValue('Lokaler Entwurf')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    expect(screen.getByText('(Refreshing…)')).toBeInTheDocument();
  });

  it('does not overwrite a local draft when background refresh returns new data', async () => {
    services.detail.data = activityDetail;
    const { rerender } = render(<ActivityManager />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Edit Activity Sommerfest' })
    );
    const name = await screen.findByDisplayValue('Sommerfest');
    fireEvent.change(name, { target: { value: 'Lokaler Entwurf' } });

    services.detail.data = {
      ...activityDetail,
      translations: {
        ...activityDetail.translations,
        de: { name: 'Server-Aktualisierung', description: 'Neu' },
      },
    };
    rerender(<ActivityManager />);

    expect(screen.getByDisplayValue('Lokaler Entwurf')).toBeInTheDocument();
    expect(
      screen.queryByDisplayValue('Server-Aktualisierung')
    ).not.toBeInTheDocument();
  });

  it('preserves a cached detail draft after a background refresh failure', async () => {
    services.detail.data = activityDetail;
    const { rerender } = render(<ActivityManager />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Edit Activity Sommerfest' })
    );
    const name = await screen.findByDisplayValue('Sommerfest');
    fireEvent.change(name, { target: { value: 'Lokaler Entwurf' } });

    services.detail.isError = true;
    rerender(<ActivityManager />);

    expect(screen.getByDisplayValue('Lokaler Entwurf')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    expect(
      screen.getByText(
        'The Activity could not be refreshed. Your unsaved changes are preserved.'
      )
    ).toBeInTheDocument();
  });

  it('publishes a committed update warning and retries refresh without replaying it', async () => {
    services.detail.data = activityDetail;
    services.update.mutateAsync.mockResolvedValueOnce({
      activity: activityDetail,
      mediaCleanupWarning: {
        code: 'ACTIVITY_MEDIA_CLEANUP_FAILED',
        message: 'Activity saved; previous media cleanup failed',
      },
    });
    services.requestPublication
      .mockRejectedValueOnce(new Error('refresh failed'))
      .mockResolvedValueOnce(undefined);
    render(<ActivityManager />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Edit Activity Sommerfest' })
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(toasts.warning).toHaveBeenCalledWith(
        'Activity saved; media cleanup needs review and public refresh failed.'
      )
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Retry public refresh' })
    );
    await waitFor(() =>
      expect(services.requestPublication).toHaveBeenCalledTimes(2)
    );
    expect(services.update.mutateAsync).toHaveBeenCalledTimes(1);
  });
});
