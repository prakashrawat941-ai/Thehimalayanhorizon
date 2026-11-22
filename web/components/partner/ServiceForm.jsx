'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { browserDb } from '@/lib/supabase/client';

const list = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean).slice(0, 20);

/** Village tour or workspace: create / edit. Goes to the admin for approval when sent. */
export function ServiceForm({ lang, kind, partnerId, userId, row, locations }) {
  const L = (en, hi) => (lang === 'hi' ? hi : en);
  const router = useRouter();
  const tour = kind === 'village_tour';
  const [v, setV] = useState({
    name: row?.title || row?.name || '', village: row?.village || '', location_id: row?.location_id || '', summary: row?.summary || '', description: row?.description || '',
    price: row?.price_per_person ?? row?.price_per_day ?? '', price_month: row?.price_per_month ?? '', duration: row?.duration_hours ?? 3, max_group: row?.max_group ?? 8,
    includes: (row?.includes || []).join(', '), highlights: (row?.culture_highlights || []).join(', '), languages: (row?.languages || ['Hindi']).join(', '), best_season: row?.best_season || '',
    desks: row?.desks ?? 4, wifi: row?.wifi_mbps ?? '', power: row?.power_backup ?? false, stay: row?.stay_available ?? false, amenities: (row?.amenities || []).join(', '), images: row?.images || [],
  });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setV({ ...v, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  async function upload(e) {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type) || f.size > 5 * 1024 * 1024) return setErr(L('JPG, PNG or WebP under 5 MB.', 'JPG, PNG या WebP, 5 MB से कम।'));
    const db = browserDb();
    const path = `${userId}/svc-${Date.now()}.${f.type.split('/')[1].replace('jpeg', 'jpg')}`;
    const { error } = await db.storage.from('media').upload(path, f, { upsert: false, contentType: f.type, cacheControl: '31536000' });
    if (error) return setErr(error.message);
    setV((c) => ({ ...c, images: [...c.images, db.storage.from('media').getPublicUrl(path).data.publicUrl].slice(0, 10) }));
  }
  async function save(submit) {
    setErr('');
    if (v.name.trim().length < 3) return setErr(L('Enter a name.', 'नाम लिखें।'));
    if (!(Number(v.price) > 0)) return setErr(L('Enter a price.', 'किराया लिखें।'));
    if (submit && !v.images.length) return setErr(L('Add at least one real photo.', 'कम से कम एक असली फ़ोटो जोड़ें।'));
    setBusy(true);
    const common = { village: v.village.trim() || null, location_id: v.location_id || null, summary: v.summary.trim().slice(0, 400), description: v.description.trim().slice(0, 6000), images: v.images, status: submit ? 'pending' : 'draft' };
    const data = tour
      ? { ...common, title: v.name.trim().slice(0, 160), price_per_person: Math.round(Number(v.price)), duration_hours: Number(v.duration) || 2, max_group: Math.max(1, Number(v.max_group) || 1),
        includes: list(v.includes), culture_highlights: list(v.highlights), languages: list(v.languages), best_season: v.best_season.trim() || null }
      : { ...common, name: v.name.trim().slice(0, 160), price_per_day: Math.round(Number(v.price)), price_per_month: v.price_month === '' ? null : Math.round(Number(v.price_month)),
        desks: Math.max(1, Number(v.desks) || 1), wifi_mbps: v.wifi === '' ? null : Math.round(Number(v.wifi)), power_backup: !!v.power, stay_available: !!v.stay, amenities: list(v.amenities) };
    const db = browserDb();
    const table = tour ? 'village_tours' : 'workspaces';
    const { error } = row ? await db.from(table).update(data).eq('id', row.id) : await db.from(table).insert({ ...data, partner_id: partnerId });
    setBusy(false);
    if (error) return setErr(error.message);
    router.push('/partner/services'); router.refresh();
  }
  return (
    <div className="ds-panel stack">
      {row?.admin_note ? <p className="soft-note warn"><strong>{L('Admin remark', 'एडमिन टिप्पणी')}:</strong> {row.admin_note}</p> : null}
      <div className="form-grid">
        <label className="field"><span className="field-label">{tour ? L('Tour title', 'टूर का नाम') : L('Workspace name', 'वर्कस्पेस का नाम')} *</span><input className="input" value={v.name} onChange={set('name')} maxLength={160} /></label>
        <label className="field"><span className="field-label">{L('Village', 'गाँव')}</span><input className="input" value={v.village} onChange={set('village')} maxLength={120} /></label>
        <label className="field"><span className="field-label">{L('Nearest listed place', 'सूची में पास की जगह')}</span><select className="input" value={v.location_id} onChange={set('location_id')}><option value="">—</option>{locations.map((l) => <option key={l.id} value={l.id}>{lang === 'hi' && l.name_hi ? l.name_hi : l.name}</option>)}</select></label>
        <label className="field"><span className="field-label">{tour ? L('Price per person (₹)', 'प्रति व्यक्ति (₹)') : L('Price per day (₹)', 'प्रति दिन (₹)')} *</span><input className="input" type="number" min={1} value={v.price} onChange={set('price')} /></label>
        {tour ? <>
          <label className="field"><span className="field-label">{L('Duration (hours)', 'अवधि (घंटे)')}</span><input className="input" type="number" min={0.5} max={72} step={0.5} value={v.duration} onChange={set('duration')} /></label>
          <label className="field"><span className="field-label">{L('Max group size', 'अधिकतम समूह')}</span><input className="input" type="number" min={1} max={100} value={v.max_group} onChange={set('max_group')} /></label>
          <label className="field"><span className="field-label">{L('Includes (comma separated)', 'शामिल (कॉमा से अलग)')}</span><input className="input" value={v.includes} onChange={set('includes')} /></label>
          <label className="field"><span className="field-label">{L('Culture highlights', 'संस्कृति की ख़ास बातें')}</span><input className="input" value={v.highlights} onChange={set('highlights')} /></label>
          <label className="field"><span className="field-label">{L('Languages', 'भाषाएँ')}</span><input className="input" value={v.languages} onChange={set('languages')} /></label>
          <label className="field"><span className="field-label">{L('Schedule / best season', 'समय / सबसे अच्छा मौसम')}</span><input className="input" value={v.best_season} onChange={set('best_season')} maxLength={120} /></label>
        </> : <>
          <label className="field"><span className="field-label">{L('Price per month (₹, optional)', 'प्रति माह (₹, वैकल्पिक)')}</span><input className="input" type="number" min={1} value={v.price_month} onChange={set('price_month')} /></label>
          <label className="field"><span className="field-label">{L('Desks / rooms', 'डेस्क / कमरे')}</span><input className="input" type="number" min={1} max={200} value={v.desks} onChange={set('desks')} /></label>
          <label className="field"><span className="field-label">{L('Internet speed (Mbps, as tested)', 'इंटरनेट स्पीड (Mbps, जाँची हुई)')}</span><input className="input" type="number" min={1} value={v.wifi} onChange={set('wifi')} /></label>
          <label className="field"><span className="field-label">{L('Amenities (comma separated)', 'सुविधाएँ (कॉमा से अलग)')}</span><input className="input" value={v.amenities} onChange={set('amenities')} /></label>
          <label className="check"><input type="checkbox" checked={v.power} onChange={set('power')} /> {L('Power backup', 'पावर बैकअप')}</label>
          <label className="check"><input type="checkbox" checked={v.stay} onChange={set('stay')} /> {L('Stay available', 'रहने की सुविधा')}</label>
        </>}
      </div>
      <label className="field"><span className="field-label">{L('One-line summary', 'एक लाइन का परिचय')}</span><input className="input" value={v.summary} onChange={set('summary')} maxLength={400} /></label>
      <label className="field"><span className="field-label">{L('Description', 'विवरण')}</span><textarea className="input" rows={4} value={v.description} onChange={set('description')} maxLength={6000} /></label>
      <div className="gallery-grid">{v.images.map((u) => (
        <div key={u} className="photo-tile">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={u} alt="" /><button type="button" className="btn btn-ghost btn-sm" onClick={() => setV({ ...v, images: v.images.filter((x) => x !== u) })}>✕</button>
        </div>
      ))}</div>
      <label className="btn btn-ghost">{L('Add photo', 'फ़ोटो जोड़ें')}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={upload} /></label>
      {err ? <p className="form-err" role="alert">{err}</p> : null}
      <div className="row-actions">
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => save(false)}>{L('Save draft', 'ड्राफ़्ट सेव करें')}</button>
        <button type="button" className="btn" disabled={busy} onClick={() => save(true)}>{L('Send for review', 'जाँच के लिए भेजें')}</button>
      </div>
    </div>
  );
}
