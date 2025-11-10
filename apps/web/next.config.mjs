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
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:5000/api/:path*',
      },
    ];
  },
  images: {
    domains: ['localhost'],
    unoptimized: true,
  },
}

export default withNextIntl(nextConfig);