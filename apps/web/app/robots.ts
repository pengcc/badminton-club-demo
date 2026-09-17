import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  // HTML must remain crawlable so crawlers can observe the locale-root noindex.
  return { rules: { userAgent: '*', allow: '/' } };
}
