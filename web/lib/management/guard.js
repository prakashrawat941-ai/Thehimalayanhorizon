import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/account';

async function getMembership(ctx) {
  const { data: member, error } = await ctx.db.from('management_members')
    .select('role').eq('user_id', ctx.user.id).maybeSingle();
  if (error) throw new Error('Management directory unavailable');
  return member?.role ?? null;
}

async function hasMfa(ctx) {
  const { data, error } = await ctx.db.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) throw new Error('MFA status unavailable');
  return data.currentLevel === 'aal2';
}

/** A switcher option is shown only to a user already authorised for the target dashboard. */
export async function managementRoleForSwitcher(ctx) {
  try {
    const role = await getMembership(ctx);
    return role && await hasMfa(ctx) ? role : null;
  } catch {
    return null;
  }
}

// Both layouts and pages call this: App Router may render the page independently of its layout.
export async function requireManagement(role, path) {
  const ctx = await requireUser(path);
  if (await getMembership(ctx) !== role) notFound();
  return { ...ctx, managementRole: role, mfaNeeded: !(await hasMfa(ctx)) };
}
