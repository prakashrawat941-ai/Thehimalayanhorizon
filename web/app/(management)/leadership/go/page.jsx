import { redirect } from 'next/navigation';
import { getT } from '@/lib/i18n/server';
import { getSession } from '@/lib/auth';
import { requireUser } from '@/lib/account';
import { leadershipDestination } from '@/lib/management/leadership';
import Mfa from '@/app/(management)/management/Mfa';

export const metadata = { title: 'Leadership', robots: { index: false } };
export const dynamic = 'force-dynamic';

// After Google sign-in: read the member's own role (RLS returns only their row), require AAL2,
// then send each role to its own dashboard. Anyone else is refused.
export default async function LeadershipGo() {
  const session = await getSession();
  if (!session.user) redirect('/leadership');
  const ctx = await requireUser('/leadership/go');
  const { data: member, error } = await ctx.db.from('management_members')
    .select('role').eq('user_id', ctx.user.id).maybeSingle();
  if (error) throw new Error('Management directory unavailable');
  const { data: aalData, error: aalError } = await ctx.db.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aalError) throw new Error('MFA status unavailable');

  const dest = leadershipDestination({ role: member?.role ?? null, aal: aalData.currentLevel });
  if (dest.status === 'go') redirect(dest.path);

  const { L, lang } = await getT();
  if (dest.status === 'mfa') {
    return (
      <div className="container">
        <h1>{L('Two-step verification required', 'दो-चरण सत्यापन ज़रूरी')}</h1>
        <Mfa lang={lang} />
      </div>
    );
  }
  return (
    <div className="container">
      <h1>{L('Access not available', 'एक्सेस उपलब्ध नहीं')}</h1>
      <p>{L('This account is not authorised for leadership access.', 'इस अकाउंट को लीडरशिप एक्सेस की अनुमति नहीं है।')}</p>
      <form method="post" action="/auth/signout">
        <button className="btn" type="submit">{L('Sign out', 'साइन आउट')}</button>
      </form>
    </div>
  );
}
