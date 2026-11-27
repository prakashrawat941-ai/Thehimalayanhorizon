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
  if (hasError || !!accessToken !== !!refreshToken) return 'invalid';

  const auth = browserDb().auth;
  // Email invites may deliver implicit tokens to the app's normal PKCE browser client.
  const { data, error } = accessToken
    ? await auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
    : await auth.getSession();
  return error ? 'invalid' : data.session ? 'ready' : 'signed_out';
}

export default function InviteAccept({ lang }) {
  const L = (en, hi) => lang === 'hi' ? hi : en;
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');
  const [busy, start] = useTransition();
  const router = useRouter();

  const sessionCheck = useRef(null);
  useEffect(() => {
    let active = true;
    sessionCheck.current ??= establishInvitationSession();
    sessionCheck.current.then((status) => {
      if (active) setState(status);
    }).catch(() => { if (active) setState('invalid'); });
    return () => { active = false; };
  }, []);

  return <section className="dsx-card">
    <h1>{L('Join The Himalayan Horizon team','द हिमालयन होराइजन की टीम में शामिल हों')}</h1>
    <p>{L('Use the email that received this invitation. Your team dashboard requires two-step verification.','आमंत्रण वाले ईमेल का इस्तेमाल करें। आपके टीम डैशबोर्ड के लिए दो-चरण सत्यापन ज़रूरी है।')}</p>
    {state === 'loading' ? <p role="status">{L('Checking invitation…','आमंत्रण की जाँच हो रही है…')}</p> : null}
    {state === 'invalid' ? <p role="alert">{L('This link could not be opened. Ask the Founder to resend it.','यह लिंक नहीं खुल सका। संस्थापक से इसे फिर भेजने के लिए कहें।')}</p> : null}
    {state === 'signed_out' ? <Link className="btn" href="/login?next=%2Fmanagement%2Finvite">{L('Sign in','साइन इन करें')}</Link> : null}
    {state === 'ready' ? <button className="btn" disabled={busy} onClick={() => start(async () => {
      setError('');
      const result = await acceptInvite();
      if (result.ok) router.replace(result.path);
      else setError(result.message);
    })}>{L('Accept invitation','आमंत्रण स्वीकार करें')}</button> : null}
    {error ? <p role="alert">{error}</p> : null}
  </section>;
}
