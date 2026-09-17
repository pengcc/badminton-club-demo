import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  getActivityAvailability: vi.fn(),
  updateActivityAvailability: vi.fn(),
  createActivity: vi.fn(),
  updateActivity: vi.fn(),
  toggleActivity: vi.fn(),
  deleteActivity: vi.fn(),
}));

vi.mock('@app/lib/api/activityApi', () => api);

import { ActivityService } from '@app/services/activityService';

const request = {
  translations: {
    de: { name: 'Sommerfest', description: '' },
    en: { name: '', description: '' },
    zh: { name: '', description: '' },
  },
  retainedImages: [],
  newImages: [],
  videoLink: '',
  videoDescription: { de: '', en: '', zh: '' },
  isVisible: true,
  order: 0,
};

function wrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe('Activity mutation Query ownership', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.values(api).forEach((mutation) => mutation.mockResolvedValue({}));
    api.updateActivity.mockResolvedValue({
      activity: { id: 'activity' },
      mediaCleanupWarning: {
        code: 'ACTIVITY_MEDIA_CLEANUP_FAILED',
        message: 'Activity saved; previous media cleanup failed',
      },
    });
    api.deleteActivity.mockResolvedValue({
      deleted: true,
      mediaCleanupWarning: {
        code: 'ACTIVITY_MEDIA_CLEANUP_FAILED',
        message: 'Activity deleted; media cleanup failed',
      },
    });
  });

  it('invalidates the complete Activity Query family after every successful mutation', async () => {
    const client = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(
      () => ({
        create: ActivityService.useCreateActivity(),
        update: ActivityService.useUpdateActivity(),
        toggle: ActivityService.useToggleActivity(),
        remove: ActivityService.useDeleteActivity(),
      }),
      { wrapper: wrapper(client) }
    );

    await act(async () => {
      await result.current.create.mutateAsync(request);
      await result.current.update.mutateAsync({
        id: 'activity',
        data: request,
      });
      await result.current.toggle.mutateAsync('activity');
      await result.current.remove.mutateAsync('activity');
    });

    expect(invalidate).toHaveBeenCalledTimes(4);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['activities'] });
  });

  it('updates only the exact availability Query after persistence', async () => {
    api.updateActivityAvailability.mockResolvedValue({ enabled: true });
    const client = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    client.setQueryData(ActivityService.availabilityQueryKey, {
      enabled: false,
    });
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(
      () => ActivityService.useUpdateAvailability(),
      { wrapper: wrapper(client) }
    );

    await act(async () => {
      await result.current.mutateAsync(true);
    });

    expect(client.getQueryData(ActivityService.availabilityQueryKey)).toEqual({
      enabled: true,
    });
    expect(invalidate).not.toHaveBeenCalled();
  });
});
