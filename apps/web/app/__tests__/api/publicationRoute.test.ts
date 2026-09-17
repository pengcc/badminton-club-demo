import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const cacheEntries = vi.hoisted(
  () =>
    new Map<string, { value: unknown; tags: readonly string[] | undefined }>()
);
const revalidatePath = vi.hoisted(() => vi.fn());
const revalidateTag = vi.hoisted(() =>
  vi.fn((tag: string) => {
    for (const [key, entry] of cacheEntries) {
      if (entry.tags?.includes(tag)) cacheEntries.delete(key);
    }
  })
);
const unstableCache = vi.hoisted(() =>
  vi.fn(
    <Arguments extends unknown[], Result>(
      callback: (...args: Arguments) => Promise<Result>,
      keyParts: string[] = [],
      options?: { tags?: readonly string[] }
    ) =>
      async (...args: Arguments) => {
        const key = JSON.stringify([keyParts, args]);
        const cached = cacheEntries.get(key);
        if (cached) return cached.value as Result;
        const value = await callback(...args);
        cacheEntries.set(key, { value, tags: options?.tags });
        return value;
      }
  )
);

vi.mock('next/cache', () => ({
  revalidatePath,
  revalidateTag,
  unstable_cache: unstableCache,
}));

import { POST } from '@app/publication/revalidate/route';
import { getPublicDocuments } from '@app/lib/data/getPublicDocuments';
import { Language } from '@club/shared-types/core/enums';

function request(
  body: unknown,
  options: {
    cookie?: string | null;
    origin?: string | null;
    referer?: string;
  } = {}
) {
  const headers = new Headers();
  if (options.origin !== null) {
    headers.set('Origin', options.origin ?? 'https://club.example.test');
  }
  if (options.referer) headers.set('Referer', options.referer);
  return {
    headers,
    cookies: {
      get: vi.fn(() =>
        options.cookie === null
          ? undefined
          : { value: options.cookie ?? 'admin-session' }
      ),
    },
    nextUrl: new URL('http://internal-web:3000/publication/revalidate'),
    json: async () => body,
  } as never;
}

describe('named publication route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cacheEntries.clear();
    vi.stubEnv('FRONTEND_URL', 'https://club.example.test');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            user: { capabilities: ['administration'] },
          }),
          { status: 200 }
        )
      )
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('expands a named homepage target to every locale route', async () => {
    const response = await POST(request({ target: 'homepage' }));

    expect(response.status).toBe(200);
    expect(revalidatePath.mock.calls.map(([path]) => path)).toEqual([
      '/de',
      '/en',
      '/zh',
    ]);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('expands the bounded Public Documents target to every homepage locale', async () => {
    const response = await POST(request({ target: 'public-documents' }));

    expect(response.status).toBe(200);
    expect(revalidatePath.mock.calls.map(([path]) => path)).toEqual([
      '/de',
      '/en',
      '/zh',
    ]);
    expect(revalidateTag).toHaveBeenCalledWith('public-documents', {
      expire: 0,
    });
  });

  it('invalidates Activities availability and every shared discovery route', async () => {
    const response = await POST(request({ target: 'activities' }));

    expect(response.status).toBe(200);
    expect(revalidateTag).toHaveBeenCalledWith(
      'activities-availability-public',
      { expire: 0 }
    );
    expect(revalidatePath.mock.calls.map(([path]) => path)).toEqual([
      '/de',
      '/en',
      '/zh',
      '/de/teams',
      '/en/teams',
      '/zh/teams',
      '/de/activities',
      '/en/activities',
      '/zh/activities',
      '/de/membership',
      '/en/membership',
      '/zh/membership',
      '/de/recruitment',
      '/en/recruitment',
      '/zh/recruitment',
      '/de/taster-session',
      '/en/taster-session',
      '/zh/taster-session',
    ]);
  });

  it.each([
    [
      'taster-information',
      'taster-information-public',
      [
        '/de',
        '/en',
        '/zh',
        '/de/taster-session',
        '/en/taster-session',
        '/zh/taster-session',
      ],
    ],
    [
      'membership-information',
      'membership-information-public',
      [
        '/de',
        '/en',
        '/zh',
        '/de/membership',
        '/en/membership',
        '/zh/membership',
      ],
    ],
    [
      'recruitment',
      'recruitment-information-public',
      ['/de/recruitment', '/en/recruitment', '/zh/recruitment'],
    ],
    [
      'contact',
      'contact-entries-public',
      [
        '/de',
        '/en',
        '/zh',
        '/de/recruitment',
        '/en/recruitment',
        '/zh/recruitment',
      ],
    ],
    [
      'locations',
      'locations-public',
      [
        '/de',
        '/en',
        '/zh',
        '/de/recruitment',
        '/en/recruitment',
        '/zh/recruitment',
      ],
    ],
  ] as const)('expands %s to its owner page and homepage summaries', async (target, tag, paths) => {
    const response = await POST(request({ target }));

    expect(response.status).toBe(200);
    expect(revalidatePath.mock.calls.map(([path]) => path)).toEqual(paths);
    expect(revalidateTag).toHaveBeenCalledWith(tag, { expire: 0 });
  });

  it('invalidates the successful Public Document projection so the next read observes new content', async () => {
    let documentDate = '2012-06-09';
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes('/auth/verify')) {
          return new Response(
            JSON.stringify({ user: { capabilities: ['administration'] } }),
            { status: 200 }
          );
        }
        return new Response(
          JSON.stringify({
            success: true,
            data: [
              {
                id: '507f1f77bcf86cd799439011',
                displayName: 'Statutes',
                documentDate,
                fileUrl: '/documents/statutes.pdf',
              },
            ],
          }),
          { status: 200 }
        );
      })
    );

    expect(await getPublicDocuments(Language.ENGLISH)).toMatchObject({
      status: 'ready',
      documents: [{ documentDate: '2012-06-09' }],
    });
    documentDate = '2026-08-05';
    expect(await getPublicDocuments(Language.ENGLISH)).toMatchObject({
      documents: [{ documentDate: '2012-06-09' }],
    });

    expect((await POST(request({ target: 'public-documents' }))).status).toBe(
      200
    );
    expect(await getPublicDocuments(Language.ENGLISH)).toMatchObject({
      status: 'ready',
      documents: [{ documentDate: '2026-08-05' }],
    });
  });

  it('rejects caller-controlled paths', async () => {
    const response = await POST(request({ paths: ['/admin', '/anything'] }));

    expect(response.status).toBe(400);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('requires an administrator capability', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ user: { capabilities: [] } }), {
        status: 200,
      })
    );

    const response = await POST(request({ target: 'teams' }));

    expect(response.status).toBe(403);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects cross-site mutation requests before session verification', async () => {
    const response = await POST(
      request({ target: 'teams' }, { origin: 'https://attacker.example.test' })
    );

    expect(response.status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('accepts the configured browser origin when the runtime request origin differs', async () => {
    const response = await POST(request({ target: 'teams' }, { cookie: null }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: 'Authentication required',
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('accepts a configured first-party Referer when Origin is absent', async () => {
    const response = await POST(
      request(
        { target: 'teams' },
        {
          origin: null,
          referer: 'https://club.example.test/dashboard/content',
        }
      )
    );

    expect(response.status).toBe(200);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it.each([
    'https://attacker.example.test',
    'not a valid URL',
  ])('does not rescue an untrusted Origin with a first-party Referer: %s', async (origin) => {
    const response = await POST(
      request(
        { target: 'teams' },
        {
          origin,
          referer: 'https://club.example.test/dashboard/content',
        }
      )
    );

    expect(response.status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each([
    '',
    'not a valid URL',
    'ftp://club.example.test',
    'https://user@club.example.test',
    'https://club.example.test/path',
    'https://club.example.test?mode=test',
    'https://club.example.test#fragment',
  ])('fails closed for invalid configured frontend URL %j', async (value) => {
    vi.stubEnv('FRONTEND_URL', value);

    const response = await POST(request({ target: 'teams' }));

    expect(response.status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('forwards only the ordinary session cookie to backend verification', async () => {
    const response = await POST(
      request({ target: 'teams' }, { cookie: 'opaque-session-value' })
    );

    expect(response.status).toBe(200);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/auth/verify'),
      expect.objectContaining({
        headers: { Cookie: 'club_session=opaque-session-value' },
        cache: 'no-store',
      })
    );
  });

  it('verifies the session against the same API_URL origin as normal Web API traffic', async () => {
    vi.stubEnv('API_URL', 'http://intended-api:43110');
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://other-api:3003/api');

    const response = await POST(request({ target: 'public-documents' }));

    expect(response.status).toBe(200);
    expect(fetch).toHaveBeenCalledWith(
      'http://intended-api:43110/api/auth/verify',
      expect.objectContaining({
        headers: { Cookie: 'club_session=admin-session' },
        cache: 'no-store',
      })
    );
  });
});
