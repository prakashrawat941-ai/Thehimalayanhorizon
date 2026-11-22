'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { browserDb } from '@/lib/supabase/client';

export function ResetForm({ text }: { text: Record<string, string> }) {
  const router = useRouter();
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <form className="stack" onSubmit={async (e) => {
      e.preventDefault(); setErr(''); setBusy(true);
      const password = String(new FormData(e.currentTarget).get('password') || '');
      const { error } = await browserDb().auth.updateUser({ password });
      setBusy(false);
      if (error) { setErr(error.message); return; }
      setOk(text.password_updated);
      setTimeout(() => { router.replace('/account'); router.refresh(); }, 1200);
    }}>
      <label className="field"><span className="field-label">{text.new_password}</span>
        <input className="input" type="password" name="password" required minLength={8} autoComplete="new-password" /></label>
      {err ? <p className="form-err" role="alert">{err}</p> : null}
      {ok ? <p className="form-ok" role="status">{ok}</p> : null}
      <button className="btn btn-block" disabled={busy}>{text.update_password}</button>
    </form>
  );
}
