// Public settings. The publishable key is safe in the browser: it can only do what
// the database security rules (RLS) allow. Never put a service_role/secret key here.
// Missing deployment settings must fail closed. A preview must never silently
// contact a different Supabase project during a build or at runtime.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('Supabase environment is incomplete: configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
}
if (process.env.THH_ENV === 'staging' &&
    SUPABASE_URL !== `https://${process.env.THH_STAGING_PROJECT_REF}.supabase.co`) {
    throw new Error('Staging Supabase URL does not match THH_STAGING_PROJECT_REF.');
}
export const SITE_URL = (process.env.URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://thehimalayanhorizon.netlify.app').replace(/\/$/, '');
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || '18';
