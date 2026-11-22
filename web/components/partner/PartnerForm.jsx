'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { browserDb } from '@/lib/supabase/client';

const CATS = [['homestay', 'Homestay', 'होमस्टे'], ['cab', 'Cab / taxi (driver)', 'कैब / टैक्सी (ड्राइवर)'], ['workspace', 'Workspace (work from mountain)', 'वर्कस्पेस (पहाड़ से काम)'], ['village_tour', 'Village tour / local guide', 'गाँव का टूर / लोकल गाइड']];
const PHONE = /^[0-9+\s-]{7,20}$/;

/** Partner registration (status starts as pending; admin approves) and business profile edit. */
export function PartnerForm({ lang, initial, locations, partnerId = null }) {
  const L = (en, hi) => (lang === 'hi' ? hi : en);
  const router = useRouter();
  const [v, setV] = useState({ business_name: '', contact_name: '', phone: '', whatsapp: '', email: '', categories: ['homestay'], village: '', location_id: '', address: '', about: '', ...initial });
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });
  async function submit(e) {
    e.preventDefault(); setErr(''); setOk('');
    if (v.business_name.trim().length < 2) return setErr(L('Enter your business name.', 'बिज़नेस का नाम लिखें।'));
    if (v.contact_name.trim().length < 2) return setErr(L('Enter your name.', 'अपना नाम लिखें।'));
    if (!PHONE.test(v.phone.trim())) return setErr(L('Enter a valid phone number.', 'सही फ़ोन नंबर लिखें।'));
    if (v.whatsapp && !PHONE.test(v.whatsapp.trim())) return setErr(L('Check the WhatsApp number.', 'WhatsApp नंबर जाँचें।'));
    if (!v.categories.length) return setErr(L('Pick at least one category.', 'कम से कम एक कैटेगरी चुनें।'));
    setBusy(true);
    const db = browserDb();
    const row = { business_name: v.business_name.trim().slice(0, 120), contact_name: v.contact_name.trim().slice(0, 120), phone: v.phone.trim(), whatsapp: v.whatsapp.trim() || null,
      email: v.email.trim() || null, categories: v.categories, village: v.village.trim().slice(0, 120) || null, location_id: v.location_id || null,
      address: v.address.trim().slice(0, 400) || null, about: v.about.trim().slice(0, 2000) || null };
    let error;
    if (partnerId) ({ error } = await db.from('partners').update(row).eq('id', partnerId));
    else {
      const { data: { user } } = await db.auth.getUser();
      ({ error } = await db.from('partners').insert({ ...row, owner_id: user.id }));
    }
    setBusy(false);
    if (error) return setErr(error.message);
    if (partnerId) { setOk(L('Saved', 'सेव हो गया')); router.refresh(); }
    else { router.push('/partner'); router.refresh(); }
  }
  return (
    <form className="stack" onSubmit={submit}>
      <div className="form-grid">
        <label className="field"><span className="field-label">{L('Business / homestay name', 'बिज़नेस / होमस्टे का नाम')} *</span><input className="input" value={v.business_name} onChange={set('business_name')} required maxLength={120} /></label>
        <label className="field"><span className="field-label">{L('Your name', 'आपका नाम')} *</span><input className="input" value={v.contact_name} onChange={set('contact_name')} required maxLength={120} autoComplete="name" /></label>
        <label className="field"><span className="field-label">{L('Phone', 'फ़ोन')} *</span><input className="input" type="tel" value={v.phone} onChange={set('phone')} required maxLength={20} autoComplete="tel" /></label>
        <label className="field"><span className="field-label">WhatsApp</span><input className="input" type="tel" value={v.whatsapp || ''} onChange={set('whatsapp')} maxLength={20} /></label>
        <label className="field"><span className="field-label">{L('Email', 'ईमेल')}</span><input className="input" type="email" value={v.email || ''} onChange={set('email')} maxLength={254} /></label>
        <label className="field"><span className="field-label">{L('Village / town', 'गाँव / कस्बा')}</span><input className="input" value={v.village || ''} onChange={set('village')} maxLength={120} /></label>
        <label className="field"><span className="field-label">{L('Nearest listed place', 'सूची में पास की जगह')}</span>
          <select className="input" value={v.location_id || ''} onChange={set('location_id')}><option value="">—</option>{locations.map((l) => <option key={l.id} value={l.id}>{lang === 'hi' && l.name_hi ? l.name_hi : l.name}</option>)}</select></label>
        <label className="field"><span className="field-label">{L('Address', 'पता')}</span><input className="input" value={v.address || ''} onChange={set('address')} maxLength={400} /></label>
      </div>
      <div className="field"><span className="field-label">{L('What do you offer?', 'आप क्या देते हैं?')} *</span>
        <div className="chips">{CATS.map(([k, en, hi]) => (
          <button key={k} type="button" className={`chip chip-toggle${v.categories.includes(k) ? ' on' : ''}`} aria-pressed={v.categories.includes(k)}
            onClick={() => setV({ ...v, categories: v.categories.includes(k) ? v.categories.filter((x) => x !== k) : [...v.categories, k] })}>{lang === 'hi' ? hi : en}</button>
        ))}</div></div>
      <label className="field"><span className="field-label">{L('About you', 'अपने बारे में')}</span><textarea className="input" rows={4} maxLength={2000} value={v.about || ''} onChange={set('about')} /></label>
      {err ? <p className="form-err" role="alert">{err}</p> : null}
      {ok ? <p className="form-ok" role="status">{ok}</p> : null}
      <button className="btn" disabled={busy}>{busy ? '…' : partnerId ? L('Save', 'सेव करें') : L('Submit application', 'आवेदन भेजें')}</button>
    </form>
  );
}
