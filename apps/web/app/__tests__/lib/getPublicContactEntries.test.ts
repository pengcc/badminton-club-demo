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

import { getPublicContactEntries } from '@app/lib/data/getPublicContactEntries';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  serverCache.clear();
});

describe('public Contact projection data', () => {
  it('keeps owner failure separate from an intentional empty list', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [] }),
      });
    vi.stubGlobal('fetch', fetchMock);

    await expect(getPublicContactEntries('de')).resolves.toEqual({
      status: 'unavailable',
    });
    await expect(getPublicContactEntries('de')).resolves.toEqual({
      status: 'ready',
      entries: [],
    });
  });

  it('accepts and caches a complete active ordered projection', async () => {
    const entry = {
      id: 'contact-1',
      category: 'general',
      title: 'General',
      description: 'Questions',
      email: 'info@example.test',
      qrCode: '',
      qrExplanation: '',
      externalLink: '',
      externalLinkLabel: '',
      order: 0,
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [entry] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(getPublicContactEntries('en')).resolves.toEqual({
      status: 'ready',
      entries: [entry],
    });
    await getPublicContactEntries('en');
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('never accepts an unsafe external link into the renderable projection', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              id: 'contact-unsafe',
              category: 'general',
              title: 'General',
              description: 'Questions',
              email: 'info@example.test',
              qrCode: '',
              qrExplanation: '',
              externalLink: 'javascript:alert(1)',
              externalLinkLabel: 'Unsafe',
              order: 0,
            },
          ],
        }),
      })
    );

    await expect(getPublicContactEntries('de')).resolves.toEqual({
      status: 'unavailable',
    });
  });
});
