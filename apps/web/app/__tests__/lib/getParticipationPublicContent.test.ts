import { afterEach, describe, expect, it, vi } from 'vitest';

const serverCache = vi.hoisted(() => new Map<string, unknown>());
vi.mock('next/cache', () => ({
  unstable_cache:
    <Arguments extends unknown[], Result>(
      callback: (...args: Arguments) => Promise<Result>,
      keyParts: string[] = []
    ) =>
    async (...args: Arguments) => {
      const key = JSON.stringify([keyParts, args]);
      if (serverCache.has(key)) return serverCache.get(key) as Result;
      const result = await callback(...args);
      serverCache.set(key, result);
      return result;
    },
}));

import {
  getMembershipAvailability,
  getMembershipPublicContent,
  getTasterSessionPublicContent,
} from '@app/lib/data/getParticipationPublicContent';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  serverCache.clear();
});

describe('participation public data boundaries', () => {
  it('does not cache a failed Taster owner response as empty content', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            homepageSummary: 'Summary',
            introduction: 'Introduction',
            preparation: '',
            participationGuidance: '',
            followUpGuidance: '',
          },
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    await expect(getTasterSessionPublicContent('en')).resolves.toEqual({
      status: 'unavailable',
    });
    await expect(getTasterSessionPublicContent('en')).resolves.toMatchObject({
      status: 'ready',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('validates the Membership projection and caches only success', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          homepageSummary: 'Summary',
          introduction: 'Introduction',
          membershipTypes: 'Types',
          membershipPath: 'Path',
          applicationPreparation: '',
          studentProof: '',
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const first = await getMembershipPublicContent('zh');
    const second = await getMembershipPublicContent('zh');
    expect(first).toEqual(second);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('reads membership availability without caching or exposing another owner', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { membershipOpen: false } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(getMembershipAvailability()).resolves.toBe(false);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/settings/membership'),
      { cache: 'no-store' }
    );
  });
});
