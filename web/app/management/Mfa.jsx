'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { browserDb } from '@/lib/supabase/client';
export default function Mfa({ lang }) {
  const L = (en, hi) => (lang === 'hi' ? hi : en);
  const [factor, setFactor] = useState(null),
    [secret, setSecret] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const router = useRouter();
  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    const code = new FormData(e.currentTarget).get('code');
    setBusy(true);
    setError('');
    try {
      const mfa = browserDb().auth.mfa;
      if (factor) {
        const result = await mfa.challengeAndVerify({ factorId: factor, code });
        if (result.error) throw result.error;
        setSecret('');
        router.refresh();
      } else {
        const listed = await mfa.listFactors();
        if (listed.error) throw listed.error;
        const existing = listed.data.totp.find((item) => item.status === 'verified');
        if (existing) setFactor(existing.id);
        else {
          // A pending enrollment has no recoverable secret after a reload. Remove only
          // the current user's unverified TOTP factor before starting setup again.
          for (const pending of listed.data.totp.filter((item) => item.status !== 'verified')) {
            const removed = await mfa.unenroll({ factorId: pending.id });
            if (removed.error) throw removed.error;
          }
          const result = await mfa.enroll({ factorType: 'totp' });
          if (result.error) throw result.error;
          setFactor(result.data.id);
          setSecret(result.data.totp.secret);
        }
      }
    } catch (cause) {
      setError(
        cause?.message || L('Verification failed. Please retry.', 'सत्यापन विफल। फिर प्रयास करें।'),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="container">
      <form className="ds-panel" onSubmit={submit}>
        <h1>{L('Verify your identity', 'अपनी पहचान सत्यापित करें')}</h1>
        {secret && (
          <p>
            {L(
              'Enter this setup key in your authenticator',
              'अपने ऑथेंटिकेटर में यह कुंजी दर्ज करें',
            )}{' '}
            <code>{secret}</code>
          </p>
        )}
        {factor && (
          <label>
            {L('Six-digit code', 'छह अंकों का कोड')}{' '}
            <input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              required
            />
          </label>
        )}
        <button className="btn" disabled={busy}>
          {factor
            ? L('Verify', 'सत्यापित करें')
            : L('Set up or verify authenticator', 'ऑथेंटिकेटर खोलें')}
        </button>
        <p role="alert">{error}</p>
      </form>
    </div>
  );
}
