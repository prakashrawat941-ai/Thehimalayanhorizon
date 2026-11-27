import { redirect } from 'next/navigation';
import { getT } from '@/lib/i18n/server';
import { getSession } from '@/lib/auth';
import { LeadershipForm } from './LeadershipForm';

export const metadata = { title: 'Leadership sign in', robots: { index: false } };

// One common leadership login. Role and MFA are decided on /leadership/go, never here.
export default async function LeadershipLogin() {
  const session = await getSession();
  if (session.user) redirect('/leadership/go');
  const { L } = await getT();
  const text = {
    title: L('Leadership sign in', 'लीडरशिप लॉगिन'),
    subtitle: L(
      'For the Founder, CEO and Co-Founder. Two-step verification is required.',
      'संस्थापक, सीईओ और सह-संस्थापक के लिए। दो-चरण सत्यापन ज़रूरी है।',
    ),
    google_off: L('Google sign-in is not switched on yet.', 'Google लॉगिन अभी चालू नहीं है।'),
    google_failed: L('Google sign-in did not work. Please try again.', 'Google लॉगिन नहीं हो पाया। फिर कोशिश करें।'),
    or: L('or use email', 'या ईमेल से'),
    email: L('Email', 'ईमेल'),
    password: L('Password', 'पासवर्ड'),
    signin: L('Sign in', 'लॉगिन'),
    loading: L('Signing in…', 'लॉगिन हो रहा है…'),
    failed: L('Sign-in failed. Check your details and try again.', 'लॉगिन नहीं हुआ। जानकारी जाँचकर फिर कोशिश करें।'),
  };
  return (
    <div className="auth-split">
      <div className="auth-form">
        <div style={{ width: '100%', maxWidth: 400 }}>
          <LeadershipForm text={text} />
        </div>
      </div>
    </div>
  );
}
