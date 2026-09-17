import en from '@messages/en/common.json';
import de from '@messages/de/common.json';
import zh from '@messages/zh/common.json';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONTENT_LANGUAGES } from '@club/shared-types/api/localizedContent';
import { PUBLIC_DISCOVERY_ROUTES } from '@app/lib/publicSeo';

vi.mock('next-intl/server', () => ({
  getTranslations:
    ({ locale }: { locale: string }) =>
    (key: string) =>
      `${locale}:${key}`,
}));

import {
  buildPublicMetadata,
  buildPublicUrl,
  getPublicOrigin,
} from '@app/lib/publicSeo';
import robots from '@app/robots';
import { metadata as rootMetadata } from '@app/[lang]/layout';
import { metadata as dashboardMetadata } from '@app/[lang]/dashboard/layout';
import { generateMetadata as generateActivitiesMetadata } from '@app/[lang]/activities/page';
import { metadata as applyMetadata } from '@app/[lang]/apply/page';
import { metadata as applicationAccessMetadata } from '@app/[lang]/apply/access/page';
import { metadata as continueApplicationMetadata } from '@app/[lang]/apply/continue/page';
import { metadata as setPasswordMetadata } from '@app/[lang]/set-password/page';

describe('public SEO ownership', () => {
  const previousFrontendUrl = process.env.FRONTEND_URL;

  beforeEach(() => {
    process.env.FRONTEND_URL = 'https://club.example/';
  });

  afterEach(() => {
    if (previousFrontendUrl === undefined) {
      delete process.env.FRONTEND_URL;
    } else {
      process.env.FRONTEND_URL = previousFrontendUrl;
    }
  });

  it.each(
    CONTENT_LANGUAGES
  )('builds localized metadata for every admitted route in %s', async (locale) => {
    for (const route of PUBLIC_DISCOVERY_ROUTES) {
      const metadata = await buildPublicMetadata({ locale, route });
      expect(metadata.robots).toBeUndefined();
      expect(metadata.title).toBe(`${locale}:${route}.title`);
      expect(metadata.description).toBe(`${locale}:${route}.description`);
      expect(metadata.alternates?.canonical).toBe(
        buildPublicUrl({ origin: getPublicOrigin(), locale, route })
      );
      expect(metadata.alternates?.languages).toEqual({
        de: expect.stringContaining('/de'),
        en: expect.stringContaining('/en'),
        zh: expect.stringContaining('/zh'),
      });
    }
  });

  it('establishes site-wide noindex without adding nofollow, including truthful discovery metadata', () => {
    expect(rootMetadata.robots).toEqual({ index: false });
    expect(dashboardMetadata.title).toContain('Badminton Club Demo');
    for (const messages of [de, en, zh]) {
      for (const route of PUBLIC_DISCOVERY_ROUTES) {
        expect(messages.seo[route].title).toContain('Badminton Club Demo');
        expect(messages.seo[route].description).toContain(
          'Badminton Club Demo'
        );
        expect(messages.seo[route].title).not.toMatch(/DCBV|Deutsch-Chines/);
      }
    }
  });

  it('normalizes the origin and rejects missing or non-origin input', () => {
    expect(getPublicOrigin('https://club.example/').toString()).toBe(
      'https://club.example/'
    );
    delete process.env.FRONTEND_URL;
    expect(() => getPublicOrigin()).toThrow(/FRONTEND_URL/);
    expect(() => getPublicOrigin('ftp://club.example')).toThrow(
      /http or https/
    );
    expect(() => getPublicOrigin('https://club.example/path')).toThrow(
      /must not include a path/
    );
  });

  it('preserves normalized Activities page identity in canonical and alternates', async () => {
    const metadata = await generateActivitiesMetadata({
      params: Promise.resolve({ lang: 'en' }),
      searchParams: Promise.resolve({ page: '3' }),
    });

    expect(metadata.alternates?.canonical).toBe(
      'https://club.example/en/activities?page=3'
    );
    expect(metadata.alternates?.languages).toEqual({
      de: 'https://club.example/de/activities?page=3',
      en: 'https://club.example/en/activities?page=3',
      zh: 'https://club.example/zh/activities?page=3',
    });
  });

  it.each([
    'invalid',
    '0',
    '-1',
  ])('canonicalizes malformed page %s to page one', async (page) => {
    const metadata = await generateActivitiesMetadata({
      params: Promise.resolve({ lang: 'de' }),
      searchParams: Promise.resolve({ page }),
    });
    expect(metadata.alternates?.canonical).toBe(
      'https://club.example/de/activities'
    );
  });

  it('gives Recruitment the ordinary localized public metadata contract', async () => {
    const metadata = await buildPublicMetadata({
      locale: 'en',
      route: 'recruitment',
    });

    expect(metadata.metadataBase).toEqual(new URL('https://club.example'));
    expect(metadata.alternates?.canonical).toBe(
      'https://club.example/en/recruitment'
    );
    expect(metadata.openGraph).toBeUndefined();
    expect(metadata.twitter).toBeUndefined();
    expect(String(metadata.description)).not.toMatch(/open|paused/i);
  });

  it('allows HTML crawling without advertising a sitemap', () => {
    expect(robots()).toEqual({
      rules: { userAgent: '*', allow: '/' },
    });
  });

  it.each([
    ['application', applyMetadata],
    ['application access', applicationAccessMetadata],
    ['application continuation', continueApplicationMetadata],
    ['password setup', setPasswordMetadata],
  ])('keeps the focused %s route out of search indexes', (_route, metadata) => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
