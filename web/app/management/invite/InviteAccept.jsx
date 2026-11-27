'use client';
import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { browserDb } from '@/lib/supabase/client';
import { acceptInvite } from '../dashboard-actions';

export default function InviteAccept({ lang }) {
  const L = (en, hi) => lang === 'hi' ? hi : en;
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');
  const [busy, start] = useTransition();
  const router = useRouter();

  useEffect(() => {
    let active = true;
    const url = new URL(window.location.href);
    const fragment = new URLSearchParams(url.hash.slice(1));
    const badLink = url.searchParams.has('error') || fragment.has('error');
    // Supabase Auth initializes from the email link and persists the session in cookies.
    browserDb().auth.getSession().then(({ data, error }) => {
      if (active) setState(badLink || error ? 'invalid' : data.session ? 'ready' : 'signed_out');
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
