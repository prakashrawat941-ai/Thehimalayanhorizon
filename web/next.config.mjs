import { validateStaging } from './scripts/staging-config.mjs';
validateStaging(process.env);
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
// Version shown in the footer: package version + short commit (Netlify sets COMMIT_REF).
const commit = (process.env.COMMIT_REF || '').slice(0, 7);
const cabPreviewBranches = ['cab-customer-design', 'cab-seat-booking'];
const cabDesignPreview = (process.env.VERCEL_ENV === 'preview' && cabPreviewBranches.includes(process.env.VERCEL_GIT_COMMIT_REF))
  || (['deploy-preview', 'branch-deploy'].includes(process.env.CONTEXT)
    && [process.env.BRANCH, process.env.HEAD].some((branch) => cabPreviewBranches.includes(branch)));

/** @type {import('next').NextConfig} */
const staging = process.env.THH_ENV === 'staging' || ['deploy-preview','branch-deploy'].includes(process.env.CONTEXT);
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: { unoptimized: true },
  eslint: { ignoreDuringBuilds: true },
  env: {
    NEXT_PUBLIC_THH_STAGING: staging ? '1' : '0',
    NEXT_PUBLIC_APP_VERSION: pkg.version.split('.')[0] + (commit ? `·${commit}` : ''),
    ...(cabDesignPreview ? {
      NEXT_PUBLIC_SUPABASE_URL: 'https://gboxcnxgdkcewstkxogt.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_7yvsb933SSqzntiJ0npq5Q_hHnsnFCo',
    } : {}),
  },
  async headers() {
    return [
      ...(staging ? [{source:'/(.*)',headers:[{key:'X-Robots-Tag',value:'noindex, nofollow'}]}] : []),
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
