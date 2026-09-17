import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const services = vi.hoisted(() => ({
  create: { mutateAsync: vi.fn(), isPending: false },
  update: { mutateAsync: vi.fn(), isPending: false },
  toggle: { mutateAsync: vi.fn(), isPending: false },
  remove: { mutateAsync: vi.fn(), isPending: false },
  requestPublication: vi.fn(),
  refetch: vi.fn(),
  announcements: [] as Array<Record<string, unknown>>,
  announcementDetail: undefined as Record<string, unknown> | undefined,
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
vi.mock('@app/services/announcementService', () => ({
  AnnouncementService: {
    useAdminAnnouncements: () => ({
      data: services.announcements,
      isLoading: false,
      isError: false,
      isRefetchError: false,
      refetch: services.refetch,
    }),
    useAnnouncement: (id: string) => ({
      data: id ? services.announcementDetail : undefined,
      isFetching: false,
      isError: false,
      refetch: services.refetch,
    }),
    useCreateAnnouncement: () => services.create,
    useUpdateAnnouncement: () => services.update,
    useToggleAnnouncement: () => services.toggle,
    useDeleteAnnouncement: () => services.remove,
  },
}));
vi.mock('sonner', () => ({ toast: toasts }));
vi.mock('@app/lib/publication', () => ({
  requestPublication: services.requestPublication,
}));

import AnnouncementManager from '@app/components/Dashboard/AnnouncementManager';

describe('AnnouncementManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    services.create.mutateAsync.mockResolvedValue(undefined);
    services.update.mutateAsync.mockResolvedValue(undefined);
    services.toggle.mutateAsync.mockResolvedValue(undefined);
    services.requestPublication.mockResolvedValue(undefined);
    services.announcementDetail = undefined;
    services.announcements = [
      {
        id: 'announcement-1',
        title: 'Summer training',
        content: 'Updated schedule',
        type: 'info',
        displayDate: '2026.08.04',
        isActive: true,
        order: 0,
      },
    ];
  });

  it('names row actions and reflects active and hidden toggle states', async () => {
    const view = render(<AnnouncementManager />);

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Hide announcement Summer training',
      })
    );
    await waitFor(() =>
      expect(services.toggle.mutateAsync).toHaveBeenCalledWith('announcement-1')
    );
    expect(
      screen.getByRole('button', {
        name: 'Edit announcement Summer training',
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: 'Delete announcement Summer training',
      })
    ).toBeInTheDocument();

    services.announcements = [
      { ...services.announcements[0], isActive: false },
    ];
    view.rerender(<AnnouncementManager />);
    expect(
      screen.getByRole('button', {
        name: 'Show announcement Summer training',
      })
    ).toBeInTheDocument();
  });

  it('creates canonical German content with optional translations and one external link', async () => {
    services.announcements = [];
    render(<AnnouncementManager />);

    fireEvent.click(screen.getByRole('button', { name: 'New Announcement' }));
    fireEvent.change(screen.getByLabelText('Title *'), {
      target: { value: 'Vereinsabend' },
    });
    fireEvent.change(screen.getByLabelText('Content *'), {
      target: { value: 'Aktuelle Informationen' },
    });
    fireEvent.change(screen.getByLabelText('External link (optional)'), {
      target: { value: 'https://example.test/update' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(services.create.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          translations: {
            de: { title: 'Vereinsabend', content: 'Aktuelle Informationen' },
            en: { title: '', content: '' },
            zh: { title: '', content: '' },
          },
          externalLink: 'https://example.test/update',
        })
      )
    );
    expect(services.requestPublication).toHaveBeenCalledWith('homepage');
  });

  it('edits one field while preserving the complete canonical Announcement', async () => {
    services.announcementDetail = {
      id: 'announcement-1',
      translations: {
        de: { title: 'Sommertraining', content: 'Aktualisierter Zeitplan' },
        en: { title: 'Summer training', content: 'Updated schedule' },
        zh: { title: '夏季训练', content: '更新时间表' },
      },
      type: 'warning',
      displayDate: '2026.08.04',
      externalLink: 'https://example.test/summer-training',
      isActive: false,
      order: 7,
      createdAt: '2026-08-01T10:00:00.000Z',
      updatedAt: '2026-08-04T10:00:00.000Z',
      createdBy: { id: 'admin-1', name: 'Admin User' },
      updatedBy: { id: 'admin-1', name: 'Admin User' },
      completeness: {
        title: { complete: true, missingLanguages: [] },
        content: { complete: true, missingLanguages: [] },
      },
    };
    render(<AnnouncementManager />);

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Edit announcement Summer training',
      })
    );
    const germanTitle = await screen.findByDisplayValue('Sommertraining');
    fireEvent.change(germanTitle, {
      target: { value: 'Sommertraining aktualisiert' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(services.update.mutateAsync).toHaveBeenCalledWith({
        id: 'announcement-1',
        data: {
          translations: {
            de: {
              title: 'Sommertraining aktualisiert',
              content: 'Aktualisierter Zeitplan',
            },
            en: { title: 'Summer training', content: 'Updated schedule' },
            zh: { title: '夏季训练', content: '更新时间表' },
          },
          type: 'warning',
          displayDate: '2026.08.04',
          externalLink: 'https://example.test/summer-training',
          isActive: false,
          order: 7,
        },
      })
    );
    expect(services.requestPublication).toHaveBeenCalledTimes(1);
    expect(services.requestPublication).toHaveBeenCalledWith('homepage');
  });

  it('retries Homepage publication without replaying the saved Announcement', async () => {
    services.announcements = [];
    services.requestPublication
      .mockRejectedValueOnce(new Error('refresh failed'))
      .mockResolvedValueOnce(undefined);
    render(<AnnouncementManager />);

    fireEvent.click(screen.getByRole('button', { name: 'New Announcement' }));
    fireEvent.change(screen.getByLabelText('Title *'), {
      target: { value: 'Vereinsabend' },
    });
    fireEvent.change(screen.getByLabelText('Content *'), {
      target: { value: 'Aktuelle Informationen' },
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
    expect(services.create.mutateAsync).toHaveBeenCalledTimes(1);
  });
});
