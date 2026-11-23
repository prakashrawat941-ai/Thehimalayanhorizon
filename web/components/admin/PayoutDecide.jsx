'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { browserDb } from '@/lib/supabase/client';

export function PayoutDecide({ lang, id }) {
  const L = (en, hi) => (lang === 'hi' ? hi : en);
  const router = useRouter();
  const [ref, setRef] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  async function act(ok) {
    setErr('');
    if (ok && ref.trim().length < 3) return setErr(L('Enter the UTR / UPI reference.', 'UTR / UPI रेफ़रेंस लिखें।'));
    if (!ok && note.trim().length < 5) return setErr(L('Write a reason for rejecting.', 'मना करने का कारण लिखें।'));
    setBusy(true);
    const { error } = await browserDb().rpc('admin_process_payout', { p_id: id, p_approve: ok, p_ref: ref.trim(), p_note: note.trim() });
    setBusy(false);
    if (error) setErr(error.message); else router.refresh();
  }
  return (
    <div className="stack">
      <div className="form-grid">
        <input className="input" placeholder={L('UTR / UPI reference (required to mark paid)', 'UTR / UPI रेफ़रेंस (भुगतान दर्ज करने के लिए ज़रूरी)')} value={ref} onChange={(e) => setRef(e.target.value)} maxLength={80} />
        <input className="input" placeholder={L('Note (required to reject)', 'नोट (मना करने के लिए ज़रूरी)')} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
      </div>
      <div className="row-actions">
        <button type="button" className="btn btn-sm" disabled={busy} onClick={() => act(true)}>{L('Mark paid', 'भुगतान हुआ')}</button>
        <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => act(false)}>{L('Reject', 'मना करें')}</button>
        {err ? <small className="warn-text" role="alert">{err}</small> : null}
      </div>
    </div>
  );
}
