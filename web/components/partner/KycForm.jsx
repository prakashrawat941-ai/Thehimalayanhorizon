'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { browserDb } from '@/lib/supabase/client';

const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const UPI = /^[A-Za-z0-9._-]{2,64}@[A-Za-z][A-Za-z0-9.]{1,40}$/;
const PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

export function KycForm({ lang, partnerId, userId, initial }) {
  const L = (en, hi) => (lang === 'hi' ? hi : en);
  const router = useRouter();
  const [v, setV] = useState({ id_type: 'aadhaar', id_number: '', id_file: '', gst_number: '', bank_account_name: '', bank_account_number: '', bank_ifsc: '', upi_id: '', ...(initial || {}) });
  const [file, setFile] = useState(null);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value ?? '' });
  async function view() {
    const { data, error } = await browserDb().storage.from('partner-docs').createSignedUrl(v.id_file, 300);
    if (error) setErr(error.message); else window.open(data.signedUrl, '_blank', 'noopener');
  }
  async function submit(e) {
    e.preventDefault(); setErr(''); setOk('');
    const ifsc = String(v.bank_ifsc || '').trim().toUpperCase();
    const pan = String(v.gst_number || '').trim().toUpperCase();
    if (String(v.id_number || '').trim().length < 4) return setErr(L('Enter your ID number.', 'अपना आईडी नंबर लिखें।'));
    if (v.id_type === 'pan' && !PAN.test(String(v.id_number).trim().toUpperCase())) return setErr(L('PAN looks wrong (e.g. ABCDE1234F).', 'PAN ग़लत लगता है (जैसे ABCDE1234F)।'));
    if (ifsc && !IFSC.test(ifsc)) return setErr(L('IFSC looks wrong (e.g. SBIN0001234).', 'IFSC ग़लत लगता है (जैसे SBIN0001234)।'));
    if (v.bank_account_number && !/^[0-9]{9,18}$/.test(String(v.bank_account_number).trim())) return setErr(L('Bank account number should be 9–18 digits.', 'बैंक खाता नंबर 9–18 अंकों का हो।'));
    if (v.upi_id && !UPI.test(String(v.upi_id).trim())) return setErr(L('UPI ID looks wrong (e.g. name@okbank).', 'UPI आईडी ग़लत लगती है (जैसे name@okbank)।'));
    if (!String(v.upi_id || '').trim() && !(String(v.bank_account_number || '').trim() && ifsc)) return setErr(L('Add a UPI ID or a bank account number with IFSC.', 'UPI आईडी या बैंक खाता नंबर और IFSC जोड़ें।'));
    setBusy(true);
    const db = browserDb();
    let path = v.id_file;
    if (file) {
      if (!/^(image\/(jpeg|png|webp)|application\/pdf)$/.test(file.type)) { setBusy(false); return setErr(L('Upload a JPG, PNG, WebP or PDF file.', 'JPG, PNG, WebP या PDF फ़ाइल अपलोड करें।')); }
      if (file.size > 5 * 1024 * 1024) { setBusy(false); return setErr(L('File must be under 5 MB.', 'फ़ाइल 5 MB से कम हो।')); }
      path = `${userId}/kyc-${Date.now()}.${file.type === 'application/pdf' ? 'pdf' : file.type.split('/')[1].replace('jpeg', 'jpg')}`;
      const { error } = await db.storage.from('partner-docs').upload(path, file, { upsert: false, contentType: file.type });
      if (error) { setBusy(false); return setErr(error.message); }
    }
    if (!path) { setBusy(false); return setErr(L('Please upload your ID proof.', 'अपना आईडी प्रूफ़ अपलोड करें।')); }
    const row = { partner_id: partnerId, id_type: v.id_type, id_number: String(v.id_number).trim(), id_file: path, gst_number: pan || null,
      bank_account_name: String(v.bank_account_name || '').trim() || null, bank_account_number: String(v.bank_account_number || '').trim() || null, bank_ifsc: ifsc || null, upi_id: String(v.upi_id || '').trim() || null };
    const { error } = await db.from('partner_kyc').upsert(row, { onConflict: 'partner_id' });
    setBusy(false);
    if (error) return setErr(error.message);
    setOk(L('Sent for verification', 'वेरिफ़िकेशन के लिए भेजा')); router.refresh();
  }
  return (
    <form className="ds-cols" onSubmit={submit}>
      <section className="ds-panel stack">
        <h2>{L('ID proof', 'आईडी प्रूफ़')}</h2>
        <div className="form-grid">
          <label className="field"><span className="field-label">{L('ID type', 'आईडी का प्रकार')}</span>
            <select className="input" value={v.id_type} onChange={set('id_type')}><option value="aadhaar">Aadhaar</option><option value="pan">PAN</option><option value="voter">Voter ID</option><option value="dl">Driving licence</option><option value="passport">Passport</option></select></label>
          <label className="field"><span className="field-label">{L('ID number', 'आईडी नंबर')}</span><input className="input" value={v.id_number || ''} onChange={set('id_number')} maxLength={30} autoComplete="off" /></label>
        </div>
        <label className="field"><span className="field-label">{L('Upload ID (JPG, PNG, WebP or PDF, up to 5 MB)', 'आईडी अपलोड करें (JPG, PNG, WebP या PDF, 5 MB तक)')}</span>
          <input className="input" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} /></label>
        {v.id_file ? <button type="button" className="btn btn-ghost btn-sm" onClick={view}>{L('View uploaded file', 'अपलोड फ़ाइल देखें')}</button> : null}
        <label className="field"><span className="field-label">{L('PAN / GST number (if any)', 'PAN / GST नंबर (अगर है)')}</span><input className="input" value={v.gst_number || ''} onChange={set('gst_number')} maxLength={20} /></label>
      </section>
      <section className="ds-panel stack">
        <h2>{L('Where to send payouts', 'पेआउट कहाँ भेजें')}</h2>
        <label className="field"><span className="field-label">UPI ID</span><input className="input" value={v.upi_id || ''} onChange={set('upi_id')} maxLength={110} placeholder="name@okbank" /></label>
        <p className="small muted">{L('or bank account', 'या बैंक खाता')}</p>
        <label className="field"><span className="field-label">{L('Account holder name', 'खाताधारक का नाम')}</span><input className="input" value={v.bank_account_name || ''} onChange={set('bank_account_name')} maxLength={120} /></label>
        <label className="field"><span className="field-label">{L('Account number', 'खाता नंबर')}</span><input className="input" inputMode="numeric" value={v.bank_account_number || ''} onChange={set('bank_account_number')} maxLength={18} autoComplete="off" /></label>
        <label className="field"><span className="field-label">IFSC</span><input className="input" value={v.bank_ifsc || ''} onChange={set('bank_ifsc')} maxLength={11} style={{ textTransform: 'uppercase' }} /></label>
        {err ? <p className="form-err" role="alert">{err}</p> : null}
        {ok ? <p className="form-ok" role="status">{ok}</p> : null}
        <button className="btn" disabled={busy}>{busy ? '…' : L('Send for verification', 'वेरिफ़िकेशन के लिए भेजें')}</button>
      </section>
    </form>
  );
}
