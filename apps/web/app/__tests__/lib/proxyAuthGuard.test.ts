import { beforeEach, describe, expect, it, vi } from 'vitest';

const intlMiddleware = vi.hoisted(() =>
  vi.fn(() => new Response('continued', { status: 200 }))
);

vi.mock('next-intl/middleware', () => ({
  default: () => intlMiddleware,
}));

import proxy from '../../../proxy';

describe('Proxy localization boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    '/en/dashboard',
    '/de/account',
    '/zh/login',
  ])('leaves authentication truth to the protected server boundary for %s', (pathname) => {
    const url = `https://club.example.test${pathname}`;
    const request = { url, nextUrl: new URL(url) } as never;

    const response = proxy(request);

    expect(response.status).toBe(200);
    expect(intlMiddleware).toHaveBeenCalledWith(request);
  });

  it('passes the legacy non-localized Recruitment entry to locale negotiation', () => {
    const url = 'https://club.example.test/recruitment';
    const request = { url, nextUrl: new URL(url) } as never;

    expect(proxy(request).status).toBe(200);
    expect(intlMiddleware).toHaveBeenCalledWith(request);
  });
});
