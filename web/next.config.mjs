import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
// Version shown in the footer: package version + short commit (Netlify sets COMMIT_REF).
const commit = (process.env.COMMIT_REF || '').slice(0, 7);
// Every hosted preview must stay on staging, including future branches.
const stagingPreview = process.env.VERCEL_ENV === 'preview'
  || ['deploy-preview', 'branch-deploy'].includes(process.env.CONTEXT);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: { unoptimized: true },
  eslint: { ignoreDuringBuilds: true },
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version.split('.')[0] + (commit ? `·${commit}` : ''),
    ...(stagingPreview ? {
      NEXT_PUBLIC_SUPABASE_URL: 'https://gboxcnxgdkcewstkxogt.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_7yvsb933SSqzntiJ0npq5Q_hHnsnFCo',
    } : {}),
  },
  async headers() {
    return [
      { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }, { key: 'Service-Worker-Allowed', value: '/' }] },
      { source: '/(.*)', headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
      ] },
    ];
  },
};

export default nextConfig;
