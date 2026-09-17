import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  PublicationRefreshError,
  requestPublication,
} from '@app/lib/publication';

describe('publication transport', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('posts the named target to the Web-owned publication route', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 200 }));

    await requestPublication('homepage');

    expect(fetchMock).toHaveBeenCalledWith('/publication/revalidate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: 'homepage' }),
    });
  });

  it('reports a non-success response as a publication refresh failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 404 })
    );

    await expect(requestPublication('homepage')).rejects.toBeInstanceOf(
      PublicationRefreshError
    );
  });
});
