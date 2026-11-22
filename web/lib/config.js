// Public settings. The publishable key is safe in the browser: it can only do what
// the database security rules (RLS) allow. Never put a service_role/secret key here.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kjuboknsxlsotzoibdnv.supabase.co';
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_W3k9MDp45hzkKn1hj_7EBw_VjCyK6pJ';
export const SITE_URL = (process.env.URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://thehimalayanhorizon.netlify.app').replace(/\/$/, '');
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || '18';
// Screens not yet rebuilt in Next.js open in the current live app.
export const LEGACY_APP = 'https://thehimalayanhorizon.netlify.app/#/';
