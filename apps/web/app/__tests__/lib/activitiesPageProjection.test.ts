import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.hoisted(() => vi.fn());

vi.mock('react', () => ({
  cache: <T extends (...args: never[]) => unknown>(callback: T) => callback,
}));
vi.stubGlobal('fetch', fetchMock);

import { getPublicActivities } from '../../lib/data/getActivitiesPageData';

const pagination = { page: 1, limit: 6, total: 0, totalPages: 0 };
const activity = {
  id: 'activity-1',
  name: 'Open training day',
  description: 'Meet the club.',
  images: [],
  videoLink: '',
  videoDescription: '',
  isVisible: true,
  order: 1,
  createdAt: '2026-08-08T00:00:00.000Z',
  updatedAt: '2026-08-08T00:00:00.000Z',
};

function response(data: unknown, ok = true) {
  return { ok, status: ok ? 200 : 503, json: async () => data };
}

describe('Activities public projection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('preserves ready items and pagination', async () => {
    fetchMock.mockResolvedValue(
      response({
        success: true,
        availability: { enabled: true },
        data: [activity],
        pagination: { ...pagination, total: 1, totalPages: 1 },
      })
    );

    await expect(getPublicActivities('en', 1)).resolves.toEqual({
      status: 'ready',
      data: {
        activities: [activity],
        pagination: { ...pagination, total: 1, totalPages: 1 },
      },
    });
  });

  it('preserves successful zero Activities as ready-empty', async () => {
    fetchMock.mockResolvedValue(
      response({
        success: true,
        availability: { enabled: true },
        data: [],
        pagination,
      })
    );

    await expect(getPublicActivities('de', 1)).resolves.toEqual({
      status: 'ready',
      data: { activities: [], pagination },
    });
  });

  it('preserves an intentional disabled state separately from ready-empty', async () => {
    fetchMock.mockResolvedValue(
      response({
        success: true,
        availability: { enabled: false },
        data: [],
        pagination,
      })
    );

    await expect(getPublicActivities('de', 1)).resolves.toEqual({
      status: 'disabled',
    });
  });

  it.each([
    response({}, false),
    response({
      success: true,
      availability: { enabled: true },
      data: [],
      pagination: undefined,
    }),
    response({
      success: true,
      availability: { enabled: true },
      data: [{ id: 42 }],
      pagination,
    }),
    response({ success: true, data: [], pagination }),
  ])('returns unavailable without fabricated pagination for invalid data', async (value) => {
    fetchMock.mockResolvedValue(value);
    await expect(getPublicActivities('zh', 2)).resolves.toEqual({
      status: 'unavailable',
    });
  });
});
