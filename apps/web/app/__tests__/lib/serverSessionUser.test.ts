import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({ cookies: vi.fn() }));

import { verifyServerSession } from '@app/lib/auth/getServerSessionUser';

describe('server session verification', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('uses the server-only API origin ahead of the browser-visible fallback', async () => {
    vi.stubEnv('API_URL', 'http://api:3003');
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://localhost:43110/api');
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ user: { id: 'user-1' } }), {
        status: 200,
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await verifyServerSession('opaque-value');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://api:3003/api/auth/verify',
      expect.any(Object)
    );
  });

  it('forwards only the named opaque cookie and never bearer authorization', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ user: { id: 'user-1' } }), {
        status: 200,
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(verifyServerSession('opaque-value')).resolves.toEqual({
      kind: 'verified',
      user: { id: 'user-1' },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3003/api/auth/verify',
      expect.objectContaining({
        headers: { Cookie: 'club_session=opaque-value' },
        cache: 'no-store',
      })
    );
    expect(fetchMock.mock.calls[0]?.[1]?.headers).not.toHaveProperty(
      'Authorization'
    );
  });

  it('does not call the backend without the ordinary session cookie', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(verifyServerSession(undefined)).resolves.toEqual({
      kind: 'unauthenticated',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('treats only the dedicated invalid-session response as unauthenticated', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ code: 'SESSION_INVALID' }), {
          status: 401,
        })
      )
    );

    await expect(verifyServerSession('opaque-value')).resolves.toEqual({
      kind: 'unauthenticated',
    });
  });

  it('preserves backend failures as verification unavailable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('unavailable', { status: 500 }))
    );

    await expect(verifyServerSession('opaque-value')).resolves.toEqual({
      kind: 'unavailable',
    });
  });

  it('preserves verification timeout as unavailable', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => {
              reject(new DOMException('Aborted', 'AbortError'));
            });
          })
      )
    );

    const verification = verifyServerSession('opaque-value');
    await vi.advanceTimersByTimeAsync(5_000);

    await expect(verification).resolves.toEqual({ kind: 'unavailable' });
  });
});
