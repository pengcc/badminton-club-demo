import nextIntlPlugin from 'next-intl/plugin';

const withNextIntl = nextIntlPlugin('./i18n.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: '/',
        destination: '/de',
        permanent: false,
      },
      {
        source: '/dashboard',
        destination: '/de/dashboard',
        permanent: false,
      },
    ];
  },
  // Only use dev-time rewrites to a local API.
  // In production on Vercel, the app uses NEXT_PUBLIC_API_URL directly.
  async rewrites() {
    if (process.env.NODE_ENV === 'development') {
      const devApiOrigin = process.env.DEV_API_ORIGIN || 'http://localhost:3003';
      return [
        {
          source: '/api/:path*',
          destination: `${devApiOrigin}/api/:path*`,
        },
      ];
    }
    return [];
  },
  images: {
    domains: ['localhost'],
    unoptimized: true,
  },
}

export default withNextIntl(nextConfig);