'use client';
import { useState } from 'react';
import { browserDb } from '@/lib/supabase/client';
import { GoogleButton } from '@/components/GoogleButton';

// Email + password and Google both end at /leadership/go, which checks role and MFA on the server.
export function LeadershipForm({ text, initialError = '' }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(initialError);

  async function onSubmit(e) {
    e.preventDefault();
    if (busy) return;
    setErr('');
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    try {
      const { error } = await browserDb().auth.signInWithPassword({
        email: String(fd.get('email') || '').trim(),
        password: String(fd.get('password') || ''),
      });
      if (error) throw error;
      // A document navigation sends the freshly written SSR cookies to /go.
      window.location.assign('/leadership/go');
    } catch (error) {
      setErr(error?.message === 'Invalid login credentials' ? text.failed : (error?.message || text.failed));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={onSubmit}>
      <h1>{text.title}</h1>
      <p className="muted">{text.subtitle}</p>
      <GoogleButton next="/leadership/go" errorText={{ off: text.google_off, failed: text.google_failed }} />
      <div className="or-line"><span>{text.or}</span></div>
      <label className="field"><span className="field-label">{text.email}</span>
        <input className="input" name="email" type="email" required autoComplete="email" inputMode="email" /></label>
      <label className="field"><span className="field-label">{text.password}</span>
        <input className="input" name="password" type="password" required autoComplete="current-password" /></label>
      {err ? <p className="form-err" role="alert">{err}</p> : null}
      <button className="btn btn-block" type="submit" disabled={busy}>{busy ? text.loading : text.signin}</button>
    </form>
  );
}
