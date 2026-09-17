import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Language } from '@club/shared-types/core/enums';

const client = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock('../../lib/api/client', () => ({ default: client }));

import { getActivities, getAdminActivities } from '../../lib/api/activityApi';
import {
  getAdminAnnouncements,
  getAnnouncements,
} from '../../lib/api/announcementApi';
import { getAdminLocations, getLocations } from '../../lib/api/locationApi';

describe('content projection API adapters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    client.get.mockResolvedValue({ data: { data: [] } });
  });

  it('uses public endpoints without caller-controlled visibility flags', async () => {
    await getActivities(Language.GERMAN);
    await getAnnouncements(Language.GERMAN);
    await getLocations(Language.GERMAN);

    expect(client.get).toHaveBeenNthCalledWith(1, '/activities', {
      params: { language: Language.GERMAN },
    });
    expect(client.get).toHaveBeenNthCalledWith(2, '/announcements', {
      params: { language: Language.GERMAN },
    });
    expect(client.get).toHaveBeenNthCalledWith(3, '/locations', {
      params: { language: Language.GERMAN },
    });
  });

  it('uses explicit protected administration endpoints', async () => {
    await getAdminActivities(Language.CHINESE);
    await getAdminAnnouncements(Language.CHINESE);
    await getAdminLocations(Language.CHINESE);

    expect(client.get).toHaveBeenNthCalledWith(1, '/activities/admin', {
      params: { language: Language.CHINESE },
    });
    expect(client.get).toHaveBeenNthCalledWith(2, '/announcements/admin', {
      params: { language: Language.CHINESE },
    });
    expect(client.get).toHaveBeenNthCalledWith(3, '/locations/admin', {
      params: { language: Language.CHINESE },
    });
  });
});
