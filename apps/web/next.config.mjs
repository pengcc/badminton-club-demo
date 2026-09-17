import nextIntlPlugin from 'next-intl/plugin';

const withNextIntl = nextIntlPlugin('./i18n.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(process.env.DOCKER_STANDALONE_BUILD === '1'
    ? { output: 'standalone' }
    : {}),
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
    const apiUrl =
      process.env.API_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      'http://localhost:3003';
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
      // Proxy uploads through Next.js in dev; in production Nginx serves /uploads/ directly
      {
        source: '/uploads/:path*',
        destination: `${apiUrl}/uploads/:path*`,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
      },
    ],
  },
};

export default withNextIntl(nextConfig);
