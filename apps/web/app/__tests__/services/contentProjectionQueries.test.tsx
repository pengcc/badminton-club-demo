import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Language } from '@club/shared-types/core/enums';

const api = vi.hoisted(() => ({
  getActivities: vi.fn(),
  getAdminActivities: vi.fn(),
  getAnnouncements: vi.fn(),
  getAdminAnnouncements: vi.fn(),
  getLocations: vi.fn(),
  getAdminLocations: vi.fn(),
}));

vi.mock('@app/lib/api/activityApi', () => ({
  getActivities: api.getActivities,
  getAdminActivities: api.getAdminActivities,
}));
vi.mock('@app/lib/api/announcementApi', () => ({
  getAnnouncements: api.getAnnouncements,
  getAdminAnnouncements: api.getAdminAnnouncements,
}));
vi.mock('@app/lib/api/locationApi', () => ({
  getLocations: api.getLocations,
  getAdminLocations: api.getAdminLocations,
}));

import { ActivityService } from '@app/services/activityService';
import { AnnouncementService } from '@app/services/announcementService';
import { LocationService } from '@app/services/locationService';

const wrapper =
  (client: QueryClient) =>
  ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

describe('content projection Query ownership', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.values(api).forEach((getProjection) =>
      getProjection.mockResolvedValue([])
    );
  });

  it('keys public and administration lists by locale and projection', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { result } = renderHook(
      () => ({
        publicActivities: ActivityService.useActivities(Language.GERMAN),
        adminActivities: ActivityService.useAdminActivities(Language.GERMAN),
        publicAnnouncements: AnnouncementService.useAnnouncements(
          Language.GERMAN
        ),
        adminAnnouncements: AnnouncementService.useAdminAnnouncements(
          Language.GERMAN
        ),
        publicLocations: LocationService.useLocations(Language.GERMAN),
        adminLocations: LocationService.useAdminLocations(Language.GERMAN),
      }),
      { wrapper: wrapper(client) }
    );

    await waitFor(() =>
      expect(
        Object.values(result.current).every((query) => query.isSuccess)
      ).toBe(true)
    );

    for (const feature of ['activities', 'announcements', 'locations']) {
      expect(
        client.getQueryData([
          feature,
          'list',
          { language: Language.GERMAN, projection: 'public' },
        ])
      ).toEqual([]);
      expect(
        client.getQueryData([
          feature,
          'list',
          { language: Language.GERMAN, projection: 'admin' },
        ])
      ).toEqual([]);
    }

    expect(api.getActivities).toHaveBeenCalledWith(Language.GERMAN);
    expect(api.getAdminActivities).toHaveBeenCalledWith(Language.GERMAN);
    expect(api.getAnnouncements).toHaveBeenCalledWith(Language.GERMAN);
    expect(api.getAdminAnnouncements).toHaveBeenCalledWith(Language.GERMAN);
    expect(api.getLocations).toHaveBeenCalledWith(Language.GERMAN);
    expect(api.getAdminLocations).toHaveBeenCalledWith(Language.GERMAN);
  });
});
