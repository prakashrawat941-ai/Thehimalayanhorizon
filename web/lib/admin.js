// Admin portal helpers (Part 6). Admin is granted only by the owner (profiles.role = 'admin');
// every admin read/write is also checked by the database rules.
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/account';

export async function requireAdmin(next = '/admin') {
  const ctx = await requireUser(next);
  if (!ctx.roles?.admin) notFound();
  // A management member is scoped to their own dashboard even if a legacy profile still says admin.
  const { data: member, error } = await ctx.db.from('management_members').select('user_id').eq('user_id', ctx.user.id).maybeSingle();
  if (!error && member) notFound();
  return ctx;
}

export const count = async (q) => { const { count: c } = await q; return c || 0; };
