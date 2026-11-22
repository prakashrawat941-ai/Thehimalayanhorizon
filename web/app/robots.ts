import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/config';

export default function robots(): MetadataRoute.Robots {
  // Deploy previews must not be indexed; only the main site is.
  const isProd = process.env.CONTEXT === 'production' || !process.env.CONTEXT;
  return {
    rules: isProd ? [{ userAgent: '*', allow: '/', disallow: ['/account', '/admin', '/partner', '/auth', '/login'] }] : [{ userAgent: '*', disallow: '/' }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
