import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/account';

// Both layouts and pages call this: App Router may render the page independently of its layout.
export async function requireManagement(role, path) {
  const ctx = await requireUser(path);
  const { data: member, error } = await ctx.db.from('management_members')
    .select('role, office').eq('user_id', ctx.user.id).maybeSingle();
  if (error) throw new Error('Management directory unavailable');
  if (!member || member.role !== role) notFound();
  const { data, error: assuranceError } = await ctx.db.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assuranceError) throw new Error('MFA status unavailable');
  return { ...ctx, roles: { ...ctx.roles, admin: false }, managementRole: role, mfaNeeded: data.currentLevel !== 'aal2' };
}
