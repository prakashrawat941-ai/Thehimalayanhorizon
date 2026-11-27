'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { browserDb } from '@/lib/supabase/client';

/** Cancel a stay/tour booking with a dialog. Uses set_booking_status; the page refreshes only after the server says yes. */
export function CancelBooking({ id, lang, label, title, summary, rule }) {
  const L = (en, hi) => (lang === 'hi' ? hi : en);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const box = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.activeElement;
    box.current?.querySelector('button')?.focus();
    const esc = (e) => { if (e.key === 'Escape' && !busy) setOpen(false); };
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('keydown', esc); prev?.focus?.(); };
  }, [open, busy]);
  async function go() {
    setBusy(true); setErr('');
    const { error } = await browserDb().rpc('set_booking_status', { p_id: id, p_status: 'cancelled', p_note: '' });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setOpen(false);
    router.refresh();
  }
  return (
    <>
      <button type="button" className="btn btn-danger-ghost btn-sm" onClick={() => { setErr(''); setOpen(true); }}>{label}</button>
      {open ? (
        <div className="ac-ov" onClick={(e) => { if (e.target === e.currentTarget && !busy) setOpen(false); }}>
          <div className="ac-md" role="dialog" aria-modal="true" aria-labelledby={`cx-${id}`} ref={box}>
            <h2 id={`cx-${id}`}>{title}</h2>
            <p style={{ margin: 0 }}>{summary}</p>
            <p className="small muted" style={{ margin: '8px 0 0' }}>{L('The host is told right away.', 'होस्ट को तुरंत बताया जाएगा।')}{rule ? <> {L("This homestay's cancellation rule:", 'इस होमस्टे का रद्द करने का नियम:')} <strong>{rule}</strong></> : null}</p>
            {err ? <p className="form-err" role="alert">{err}</p> : null}
            <div className="ac-acts">
              <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setOpen(false)}>{L('Keep booking', 'बुकिंग रखें')}</button>
              <button type="button" className="btn btn-danger" disabled={busy} onClick={go}>{busy ? L('Cancelling…', 'रद्द हो रहा है…') : L('Cancel booking', 'बुकिंग रद्द करें')}</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
