import { afterEach, describe, expect, it, vi } from 'vitest';

const serverCache = vi.hoisted(() => new Map<string, unknown>());
const unstableCache = vi.hoisted(() =>
  vi.fn(
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
      }
  )
);

vi.mock('next/cache', () => ({ unstable_cache: unstableCache }));

import { getPublicDocuments } from '@app/lib/data/getPublicDocuments';
import { Language } from '@club/shared-types/core/enums';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  serverCache.clear();
});

describe('getPublicDocuments availability contract', () => {
  it('does not reuse a legacy slot-shaped cache entry after the contract cutover', async () => {
    serverCache.set(
      JSON.stringify([
        ['public-documents-projection', 'http://localhost:3003'],
        [Language.GERMAN],
      ]),
      [
        {
          slot: 'statutes',
          displayName: 'Satzung',
          documentDate: '2012-06-09',
          fileUrl: '/documents/statutes.pdf',
        },
      ]
    );
    const current = {
      id: '507f1f77bcf86cd799439011',
      displayName: 'Satzung',
      documentDate: '2012-06-09',
      fileUrl: '/documents/statutes.pdf',
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [current] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(getPublicDocuments(Language.GERMAN)).resolves.toEqual({
      status: 'ready',
      documents: [current],
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('does not cache a failed owner response as an empty document list', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [] }),
      });
    vi.stubGlobal('fetch', fetchMock);

    await expect(getPublicDocuments(Language.GERMAN)).resolves.toEqual({
      status: 'unavailable',
    });
    await expect(getPublicDocuments(Language.GERMAN)).resolves.toEqual({
      status: 'ready',
      documents: [],
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining('language=de')
    );
  });

  it('reuses a validated successful projection within its cache lifetime', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: [
          {
            id: '507f1f77bcf86cd799439011',
            displayName: 'Statutes',
            documentDate: '2012-06-09',
            fileUrl: '/documents/statutes.pdf',
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const first = await getPublicDocuments(Language.ENGLISH);
    const second = await getPublicDocuments(Language.ENGLISH);

    expect(first).toEqual(second);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('treats an invalid successful payload as unavailable', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: [{ id: 'other' }] }),
      })
    );

    await expect(getPublicDocuments(Language.ENGLISH)).resolves.toEqual({
      status: 'unavailable',
    });
  });

  it('accepts and preserves a ten-document ordered edge-case projection', async () => {
    const documents = Array.from({ length: 10 }, (_, index) => ({
      id: index.toString(16).padStart(24, '0'),
      displayName: `Document ${index + 1}`,
      documentDate: '2026-08-23',
      fileUrl: `/documents/document-${index + 1}.pdf`,
    }));
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: documents }),
      })
    );

    await expect(getPublicDocuments(Language.GERMAN)).resolves.toEqual({
      status: 'ready',
      documents,
    });
  });
});
