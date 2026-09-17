import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.hoisted(() => vi.fn());

vi.mock('react', () => ({
  cache: <T extends (...args: never[]) => unknown>(callback: T) => callback,
}));
vi.stubGlobal('fetch', fetchMock);

import { getActivitiesAvailability } from '@app/lib/data/getActivitiesAvailability';

describe('Activities availability public projection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it.each([
    true,
    false,
  ])('preserves the authoritative enabled=%s value', async (enabled) => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: { enabled } }), {
        status: 200,
      })
    );

    await expect(getActivitiesAvailability()).resolves.toEqual({
      status: 'ready',
      data: { enabled },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/activities/availability'),
      {
        next: {
          revalidate: 3600,
          tags: ['activities-availability-public'],
        },
      }
    );
  });

  it.each([
    new Response('{}', { status: 503 }),
    new Response(JSON.stringify({ success: true, data: {} }), { status: 200 }),
  ])('returns unavailable for failed or malformed owner state', async (response) => {
    fetchMock.mockResolvedValue(response);

    await expect(getActivitiesAvailability()).resolves.toEqual({
      status: 'unavailable',
    });
  });
});
