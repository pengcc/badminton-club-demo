import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { CONTENT_LANGUAGES } from '@club/shared-types/api/localizedContent';
import type { Language } from '@club/shared-types/core/enums';

export const PUBLIC_DISCOVERY_ROUTES = [
  'home',
  'teams',
  'activities',
  'membership',
  'tasterSession',
  'recruitment',
] as const;

export type PublicDiscoveryRoute = (typeof PUBLIC_DISCOVERY_ROUTES)[number];

const routeSuffixes: Record<PublicDiscoveryRoute, string> = {
  home: '',
  teams: '/teams',
  activities: '/activities',
  membership: '/membership',
  tasterSession: '/taster-session',
  recruitment: '/recruitment',
};

export function getPublicOrigin(value = process.env.FRONTEND_URL): URL {
  if (!value) {
    throw new Error('FRONTEND_URL is required for public metadata');
  }

  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('FRONTEND_URL must use http or https');
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error(
      'FRONTEND_URL must be an origin without credentials or query data'
    );
  }
  if (url.pathname !== '/' && url.pathname !== '') {
    throw new Error('FRONTEND_URL must not include a path');
  }

  return new URL(url.origin);
}

export function buildPublicUrl({
  origin,
  locale,
  route,
  activitiesPage = 1,
}: {
  origin: URL;
  locale: Language;
  route: PublicDiscoveryRoute;
  activitiesPage?: number;
}): string {
  const url = new URL(`/${locale}${routeSuffixes[route]}`, origin);
  if (route === 'activities' && activitiesPage > 1) {
    url.searchParams.set('page', String(activitiesPage));
  }
  return url.toString();
}

export function buildPublicLanguageAlternates(
  origin: URL,
  route: PublicDiscoveryRoute,
  activitiesPage = 1
): Record<Language, string> {
  return Object.fromEntries(
    CONTENT_LANGUAGES.map((locale) => [
      locale,
      buildPublicUrl({ origin, locale, route, activitiesPage }),
    ])
  ) as Record<Language, string>;
}

export async function buildPublicMetadata({
  locale,
  route,
  activitiesPage = 1,
}: {
  locale: Language;
  route: PublicDiscoveryRoute;
  activitiesPage?: number;
}): Promise<Metadata> {
  const origin = getPublicOrigin();
  const t = await getTranslations({ locale, namespace: 'common.seo' });

  return {
    metadataBase: origin,
    title: t(`${route}.title`),
    description: t(`${route}.description`),
    alternates: {
      canonical: buildPublicUrl({ origin, locale, route, activitiesPage }),
      languages: buildPublicLanguageAlternates(origin, route, activitiesPage),
    },
  };
}

export function getPublicRouteSuffix(route: PublicDiscoveryRoute): string {
  return routeSuffixes[route];
}
