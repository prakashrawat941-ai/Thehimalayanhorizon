// Admin portal helpers (Part 6). Admin is granted only by the owner (profiles.role = 'admin');
// every admin read/write is also checked by the database rules.
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/account';

export async function requireAdmin(next = '/admin') {
  const ctx = await requireUser(next);
  if (!ctx.roles?.admin) notFound();
  return ctx;
}

export const count = async (q) => { const { count: c } = await q; return c || 0; };
