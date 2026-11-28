'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { browserDb } from '@/lib/supabase/client';
import { homestayPublicationIssues } from '@/lib/publication';

/**
 * Approve / reject a row. Rejecting always needs a written remark (shown to the partner).
 * Homestays can get a commission % on approval (admin only).
 */
export function Decide({ lang, table, id, idField = 'id', approve = 'approved', reject = 'rejected', remarkField = 'admin_note', commission = null, extraApprove = {}, canApprove = true }) {
  const L = (en, hi) => (lang === 'hi' ? hi : en);
  const router = useRouter();
  const [remark, setRemark] = useState('');
  const [rate, setRate] = useState(commission ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function act(ok) {
    setErr('');
    if (ok && !canApprove) return setErr(L('Complete the missing details before approval.', 'मंज़ूरी से पहले अधूरी जानकारी पूरी करें।'));
    if (!ok && remark.trim().length < 5) return setErr(L('Write a remark (at least 5 letters) — the partner will see it.', 'टिप्पणी लिखें (कम से कम 5 अक्षर) — पार्टनर इसे देखेंगे।'));
    if (ok && commission !== null && !(Number(rate) >= 0 && Number(rate) <= 50)) return setErr(L('Commission must be 0–50%.', 'कमीशन 0–50% हो।'));
    setBusy(true);
    if (ok && table === 'homestays') {
      const { data: current, error: readError } = await browserDb().from('homestays').select('*').eq('id', id).single();
      if (readError || !current || homestayPublicationIssues(current).length) {
        setBusy(false);
        return setErr(readError?.message || L('This homestay still has missing details. Refresh and review it again.', 'इस होमस्टे की जानकारी अभी अधूरी है। पेज रीफ़्रेश करके दोबारा जाँचें।'));
      }
    }
    const patch = { status: ok ? approve : reject, [remarkField]: remark.trim() || null, ...(ok ? extraApprove : {}) };
    if (ok && commission !== null) patch.commission_rate = Number(rate);
    const { error } = await browserDb().from(table).update(patch).eq(idField, id);
    setBusy(false);
    if (error) setErr(error.message); else router.refresh();
  }
  return (
    <div className="stack decide">
      <div className="row-actions">
        {commission !== null ? <label className="field" style={{ maxWidth: 160 }}><span className="field-label">{L('Commission %', 'कमीशन %')}</span><input className="input" type="number" min={0} max={50} step={0.5} value={rate} onChange={(e) => setRate(e.target.value)} /></label> : null}
        <input className="input grow" placeholder={L('Remark (required to reject)', 'टिप्पणी (मना करने के लिए ज़रूरी)')} value={remark} onChange={(e) => setRemark(e.target.value)} maxLength={1000} />
      </div>
      <div className="row-actions">
        <button type="button" className="btn btn-sm" disabled={busy || !canApprove} onClick={() => act(true)}>{L('Approve', 'मंज़ूर करें')}</button>
        <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => act(false)}>{L('Reject', 'मना करें')}</button>
        {err ? <small className="warn-text" role="alert">{err}</small> : null}
      </div>
    </div>
  );
}

/** Open a private file (KYC / driver document) through a 5-minute signed link. */
export function PrivateFile({ bucket, path, label }) {
  const [err, setErr] = useState('');
  if (!path) return null;
  return (
    <>
      <button type="button" className="btn btn-ghost btn-sm" onClick={async () => {
        const { data, error } = await browserDb().storage.from(bucket).createSignedUrl(path, 300);
        if (error) setErr(error.message); else window.open(data.signedUrl, '_blank', 'noopener');
      }}>{label}</button>
      {err ? <small className="warn-text">{err}</small> : null}
    </>
  );
}
