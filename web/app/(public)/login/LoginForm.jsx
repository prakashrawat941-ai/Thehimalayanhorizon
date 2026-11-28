'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { browserDb } from '@/lib/supabase/client';
import { GoogleButton } from '@/components/GoogleButton';
export function LoginForm({ next, text, initialMode, heading }) {
    const router = useRouter();
    const [mode, setMode] = useState(initialMode);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const [ok, setOk] = useState('');
    async function onSubmit(e) {
        e.preventDefault();
        setErr('');
        setOk('');
        setBusy(true);
        const fd = new FormData(e.currentTarget);
        const email = String(fd.get('email') || '').trim();
        const password = String(fd.get('password') || '');
        const db = browserDb();
        const callback = `${location.origin}/auth/callback?next=`;
        try {
            if (mode === 'forgot') {
                const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo: callback + encodeURIComponent('/auth/reset') });
                if (error)
                    throw error;
                setOk(text.reset_sent);
            }
            else if (mode === 'signup') {
                const full_name = String(fd.get('full_name') || '').trim().slice(0, 120);
                const phone = String(fd.get('phone') || '').trim().slice(0, 20) || null;
                const { data, error } = await db.auth.signUp({
                    email, password,
                    options: { data: { full_name, phone }, emailRedirectTo: callback + encodeURIComponent(next) },
                });
                if (error)
                    throw error;
                if (!data.session) {
                    setOk(text.check_email);
                    setMode('signin');
                }
                else {
                    router.replace(next);
                    router.refresh();
                }
            }
            else {
                const { error } = await db.auth.signInWithPassword({ email, password });
                if (error)
                    throw error;
                router.replace(next);
                router.refresh();
            }
        }
        catch (e2) {
            setErr(e2.message || text.error);
        }
        finally {
            setBusy(false);
        }
    }
    const title = heading ? heading[0] : mode === 'signup' ? text.title_signup : mode === 'forgot' ? text.forgot_password : text.title_signin;
    return (<form className="stack" onSubmit={onSubmit} noValidate={false}>
      {mode !== 'forgot' ? (<div className="seg" role="tablist">
          <button type="button" role="tab" aria-selected={mode === 'signin'} className={mode === 'signin' ? 'on' : ''} onClick={() => setMode('signin')}>{text.signin}</button>
          <button type="button" role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? 'on' : ''} onClick={() => setMode('signup')}>{text.signup}</button>
        </div>) : null}
      <h1>{title}</h1>
      <p className="muted">{heading ? heading[1] : text.subtitle}</p>
      {mode !== 'forgot' ? (<>
          <GoogleButton next={next} errorText={{ off: text.google_off, failed: text.google_failed }}/>
          <p className="small muted center gbtn-note">{text.google_note}</p>
          <div className="or-line"><span>{text.or_email}</span></div>
        </>) : null}
      {mode === 'signup' ? (<label className="field"><span className="field-label">{text.name}</span>
          <input className="input" name="full_name" required minLength={2} maxLength={120} autoComplete="name"/></label>) : null}
      <label className="field"><span className="field-label">{text.email}</span>
        <input className="input" name="email" type="email" required autoComplete="email" inputMode="email"/></label>
      {mode === 'signup' ? (<label className="field"><span className="field-label">{text.phone}</span>
          <input className="input" name="phone" type="tel" autoComplete="tel" pattern="[0-9+\s-]{7,20}" maxLength={20}/></label>) : null}
      {mode !== 'forgot' ? (<label className="field"><span className="field-label">{text.password}</span>
          <input className="input" name="password" type="password" required minLength={8} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}/>
          {mode === 'signup' ? <small className="muted">{text.min8}</small> : null}</label>) : null}
      {err ? <p className="form-err" role="alert">{err}</p> : null}
      {ok ? <p className="form-ok" role="status">{ok}</p> : null}
      <button className="btn btn-block" type="submit" disabled={busy}>
        {busy ? text.loading : mode === 'signup' ? text.signup : mode === 'forgot' ? text.send_link : text.signin}
      </button>
      {mode === 'signin' ? <button type="button" className="link" onClick={() => setMode('forgot')}>{text.forgot_password}</button> : null}
      {mode === 'forgot' ? <button type="button" className="link" onClick={() => setMode('signin')}>{text.back_signin}</button> : null}
      <p className="muted small center">{text.partner_q} <Link href="/partner/join">{text.become_partner}</Link></p>
    </form>);
}
