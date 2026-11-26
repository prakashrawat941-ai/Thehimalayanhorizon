// Admin portal helpers (Part 6). Admin is granted only by the owner (profiles.role = 'admin');
// every admin read/write is also checked by the database rules.
import { notFound, redirect } from 'next/navigation';
import { requireUser } from '@/lib/account';

export async function requireAdmin(next = '/admin') {
  const ctx = await requireUser(next);
  const { data: member, error } = await ctx.db
    .from('management_members')
    .select('role')
    .eq('user_id', ctx.user.id)
    .maybeSingle();
  if (error && error.code !== 'PGRST205' && error.code !== '42P01')
    throw Error('Management directory unavailable');
  if (member)
    redirect(member.role === 'co_founder' ? '/co-founder' : '/management');
  if (!ctx.roles?.admin) notFound();
  return ctx;
}

export const count = async (q) => {
  const { count: c } = await q;
  return c || 0;
};
