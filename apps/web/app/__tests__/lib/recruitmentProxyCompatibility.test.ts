import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import proxy from '../../../proxy';

describe('Recruitment legacy locale compatibility', () => {
  it.each([
    ['en', '/en/recruitment'],
    ['de', '/de/recruitment'],
    ['zh', '/zh/recruitment'],
  ])('redirects /recruitment to the negotiated %s canonical route', (language, pathname) => {
    const response = proxy(
      new NextRequest('https://club.example.test/recruitment', {
        headers: { 'accept-language': language },
      })
    );

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get('location') ?? '').pathname).toBe(
      pathname
    );
  });
});
