// Run during the build so an unconfigured preview cannot inherit production defaults.
export function validateStaging(env) {
  if (env.THH_ENV !== 'staging' && !['deploy-preview', 'branch-deploy'].includes(env.CONTEXT)) return;
  const ref = env.THH_STAGING_PROJECT_REF;
  const origin = env.NEXT_PUBLIC_SUPABASE_URL;
  if (!/^[a-z]{20}$/.test(ref || '') || ref === 'kjuboknsxlsotzoibdnv' ||
      origin !== 'https://' + ref + '.supabase.co') {
    throw Error('Configure a separate staging Supabase project and matching HTTPS URL.');
  }
  const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!key.startsWith('sb_publishable_')) {
    throw Error('Staging requires an explicit Supabase publishable key.');
  }
}
