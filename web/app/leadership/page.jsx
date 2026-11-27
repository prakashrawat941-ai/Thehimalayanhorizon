import { redirect } from 'next/navigation';
import { getT } from '@/lib/i18n/server';
import { getSession } from '@/lib/auth';
import { GoogleButton } from '@/components/GoogleButton';

export const metadata = { title: 'Leadership sign in', robots: { index: false } };

// One common leadership login. Role and MFA are decided on /leadership/go, never here.
export default async function LeadershipLogin() {
  const session = await getSession();
  if (session.user) redirect('/leadership/go');
  const { L } = await getT();
  return (
    <div className="auth-split">
      <div className="auth-form">
        <div style={{ width: '100%', maxWidth: 400 }}>
          <div className="stack">
            <h1>{L('Leadership sign in', 'लीडरशिप लॉगिन')}</h1>
            <p className="muted">
              {L(
                'For the Founder, CEO and Co-Founder. Use your verified Google account; two-step verification is required.',
                'संस्थापक, सीईओ और सह-संस्थापक के लिए। अपने सत्यापित Google अकाउंट से लॉगिन करें; दो-चरण सत्यापन ज़रूरी है।',
              )}
            </p>
            <GoogleButton
              next="/leadership/go"
              errorText={{
                off: L('Google sign-in is not switched on yet.', 'Google लॉगिन अभी चालू नहीं है।'),
                failed: L('Google sign-in did not work. Please try again.', 'Google लॉगिन नहीं हो पाया। फिर कोशिश करें।'),
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
