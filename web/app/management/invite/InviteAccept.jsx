'use client';
import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { browserDb } from '@/lib/supabase/client';
import { acceptInvite } from '../dashboard-actions';

async function establishInvitationSession() {
  const url = new URL(window.location.href);
  const fragment = new URLSearchParams(url.hash.slice(1));
  const hasError = url.searchParams.has('error') || fragment.has('error');
  const accessToken = fragment.get('access_token');
  const refreshToken = fragment.get('refresh_token');
  if (url.hash && (hasError || accessToken || refreshToken)) {
    window.history.replaceState(window.history.state, '', url.pathname + url.search);
  }
  if (hasError || !!accessToken !== !!refreshToken) return { state: 'invalid' };

  const auth = browserDb().auth;
  // Email invites may deliver implicit tokens to the app's normal PKCE browser client.
  const { data, error } = accessToken
    ? await auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
    : await auth.getSession();
  if (error) return { state: 'invalid' };
  if (!data.session) return { state: 'signed_out' };
  const { data: employeeId, error: lookupError } = await browserDb().rpc('management_pending_employee_id');
  return lookupError ? { state: 'invalid' } : { state: 'ready', employeeId };
}

export default function InviteAccept({ lang }) {
  const L = (en, hi) => lang === 'hi' ? hi : en;
  const [state, setState] = useState('loading');
  const [employeeId, setEmployeeId] = useState(null);
  const [error, setError] = useState('');
  const [busy, start] = useTransition();
  const router = useRouter();

  const sessionCheck = useRef(null);
  useEffect(() => {
    let active = true;
    sessionCheck.current ??= establishInvitationSession();
    sessionCheck.current.then((result) => {
      if (active) {
        setEmployeeId(result.employeeId ?? null);
        setState(result.state);
      }
    }).catch(() => { if (active) setState('invalid'); });
    return () => { active = false; };
  }, []);

  return <section className="dsx-card">
    <h1>{L('Join The Himalayan Horizon team','द हिमालयन होराइजन की टीम में शामिल हों')}</h1>
    <p>{L('Use the email that received this invitation. Your team dashboard requires two-step verification.','आमंत्रण वाले ईमेल का इस्तेमाल करें। आपके टीम डैशबोर्ड के लिए दो-चरण सत्यापन ज़रूरी है।')}</p>
    {state === 'loading' ? <p role="status">{L('Checking invitation…','आमंत्रण की जाँच हो रही है…')}</p> : null}
    {state === 'invalid' ? <p role="alert">{L('This link could not be opened. Ask the Founder to resend it.','यह लिंक नहीं खुल सका। संस्थापक से इसे फिर भेजने के लिए कहें।')}</p> : null}
    {state === 'signed_out' ? <Link className="btn" href="/login?next=%2Fmanagement%2Finvite">{L('Sign in','साइन इन करें')}</Link> : null}
    {state === 'ready' ? <form onSubmit={(event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const password = String(form.get('password') ?? '');
      setError('');
      if (employeeId && (password.length < 12 || password.toUpperCase() === employeeId
        || password !== form.get('confirm_password'))) {
        setError(L('Use a matching password of at least 12 characters that differs from your employee ID.',
          'दोनों जगह एक जैसा, कम से कम 12 अक्षरों का पासवर्ड डालें जो कर्मचारी आईडी से अलग हो।'));
        return;
      }
      start(async () => {
        if (employeeId) {
          const { error: passwordError } = await browserDb().auth.updateUser({ password });
          if (passwordError) {
            setError(passwordError.message);
            return;
          }
        }
        const result = await acceptInvite();
        if (result.ok) router.replace(result.path);
        else setError(result.message);
      });
    }}>
      {employeeId ? <>
        <p>{L('Your employee ID', 'आपकी कर्मचारी आईडी')} <strong>{employeeId}</strong></p>
        <label className="field">{L('New password', 'नया पासवर्ड')}
          <input className="input" type="password" name="password" autoComplete="new-password" minLength={12} maxLength={1024} required />
        </label>
        <label className="field">{L('Confirm password', 'पासवर्ड की पुष्टि')}
          <input className="input" type="password" name="confirm_password" autoComplete="new-password" minLength={12} maxLength={1024} required />
        </label>
      </> : null}
      <button className="btn" disabled={busy}>{employeeId ? L('Set password and accept', 'पासवर्ड सेट करें और स्वीकार करें') : L('Accept invitation','आमंत्रण स्वीकार करें')}</button>
    </form> : null}
    {error ? <p role="alert">{error}</p> : null}
  </section>;
}
