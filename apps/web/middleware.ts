import createMiddleware from 'next-intl/middleware';
import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';

const intlMiddleware = createMiddleware({
  // A list of all locales that are supported
  locales: ['en', 'de', 'zh'],

  // Used when no locale matches
  defaultLocale: 'de',

  // Prefix the default locale
  localePrefix: 'always'
});

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protected routes that require authentication
  const protectedRoutes = ['/dashboard', '/account'];
  const publicRoutes = ['/login', '/register', '/'];

  // Extract locale and route path
  const pathnameWithoutLocale = pathname.replace(/^\/(en|de|zh)/, '');

  // Check if route is protected
  const isProtectedRoute = protectedRoutes.some(route =>
    pathnameWithoutLocale.startsWith(route)
  );
  const isPublicRoute = publicRoutes.some(route =>
    pathnameWithoutLocale === route || pathnameWithoutLocale.startsWith(route)
  );

  // Get token from cookies
  const token = request.cookies.get('token')?.value;

  // Redirect unauthenticated users from protected routes to login
  if (isProtectedRoute && !token) {
    const locale = pathname.match(/^\/(en|de|zh)/)?.[1] || 'de';
    return NextResponse.redirect(new URL(`/${locale}/login`, request.url));
  }

  // Redirect authenticated users from login/register to dashboard
  if (isPublicRoute && token && (pathnameWithoutLocale === '/login' || pathnameWithoutLocale === '/register')) {
    const locale = pathname.match(/^\/(en|de|zh)/)?.[1] || 'de';
    return NextResponse.redirect(new URL(`/${locale}/dashboard`, request.url));
  }

  // Continue with intl middleware
  return intlMiddleware(request);
}export const config = {
  // Match all pathnames except for
  // - api routes
  // - static files
  // - _next internals
  matcher: ['/((?!api|_next|.*\\..*).*)']
};
