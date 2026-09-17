import createMiddleware from 'next-intl/middleware';

const intlMiddleware = createMiddleware({
  // A list of all locales that are supported
  locales: ['en', 'de', 'zh'],

  // Used when no locale matches
  defaultLocale: 'de',

  // Prefix the default locale
  localePrefix: 'always',
});

export default intlMiddleware;

export const config = {
  // Match all pathnames except for
  // - api routes
  // - the internal publication route
  // - static files
  // - _next internals
  matcher: ['/((?!api|publication/revalidate|_next|.*\\..*).*)'],
};
