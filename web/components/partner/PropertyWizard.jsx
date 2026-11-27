'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { browserDb } from '@/lib/supabase/client';
import { inr } from '@/lib/format';
import { Cover } from '@/components/Cover';

// Policies are kept inside house_rules as labelled lines (the table has no separate columns).
const POL_RE = /^(Check-in|Check-out|Cancellation): (.*)$/;
function splitRules(text = '') {
  const out = { checkin: '12:00', checkout: '11:00', cancellation: '', rules: [] };
  String(text || '').split('\n').forEach((line) => {
    const m = line.match(POL_RE);
    if (m) out[{ 'Check-in': 'checkin', 'Check-out': 'checkout', Cancellation: 'cancellation' }[m[1]]] = m[2];
    else out.rules.push(line);
  });
  return { ...out, rules: out.rules.join('\n').trim() };
}

/** 5-step add/edit: basic info → rooms → photos → policies → review & submit. */
export function PropertyWizard({ lang, partnerId, userId, canSubmit, amenities, property, rooms: initialRooms, locations }) {
  const L = (en, hi) => (lang === 'hi' ? hi : en);
  const router = useRouter();
  const pol = splitRules(property?.house_rules);
  const [step, setStep] = useState(0);
  const [v, setV] = useState({
    name: property?.name || '', village: property?.village || '', district: property?.district || '', state: property?.state || 'Uttarakhand',
    location_id: property?.location_id || '', summary: property?.summary || '', description: property?.description || '', amenities: property?.amenities || [],
    meals: property?.meals || '', images: property?.images || [], checkin: pol.checkin, checkout: pol.checkout, cancellation: pol.cancellation, rules: pol.rules,
  });
  const [rooms, setRooms] = useState(initialRooms.length ? initialRooms.map((r) => ({ ...r })) : [{ room_type: L('Double room', 'डबल रूम'), max_guests: 2, total_inventory: 1, base_price: '', weekend_price: '' }]);
  const [removed, setRemoved] = useState([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });
  const setRoom = (i, k, val) => setRooms(rooms.map((r, j) => (j === i ? { ...r, [k]: val } : r)));
  const STEPS = [L('Basic info', 'जानकारी'), L('Rooms', 'कमरे'), L('Photos', 'फ़ोटो'), L('House rules', 'घर के नियम'), L('Check & send', 'जाँचें और भेजें')];

  function check(s) {
    if (s === 0) {
      if (v.name.trim().length < 3) return L('Enter the homestay name.', 'होमस्टे का नाम लिखें।');
      if (v.village.trim().length < 2) return L('Enter the village or town.', 'गाँव या कस्बा लिखें।');
      if (v.district.trim().length < 2) return L('Enter the district.', 'ज़िला लिखें।');
      if (v.summary.trim().length < 10) return L('Write a one-line summary (at least 10 letters).', 'एक लाइन का परिचय लिखें (कम से कम 10 अक्षर)।');
    }
    if (s === 1) {
      if (!rooms.length) return L('Add at least one room type.', 'कम से कम एक रूम टाइप जोड़ें।');
      if (rooms.some((r) => String(r.room_type || '').trim().length < 2)) return L('Give each room type a name.', 'हर रूम टाइप का नाम लिखें।');
      if (rooms.some((r) => !(Number(r.max_guests) >= 1 && Number(r.max_guests) <= 20) || !(Number(r.total_inventory) >= 1 && Number(r.total_inventory) <= 50))) return L('Guests 1–20 and units 1–50 per room type.', 'हर टाइप में मेहमान 1–20 और कमरे 1–50।');
      if (rooms.some((r) => !(Number(r.base_price) > 0))) return L('Set a base price per night for each room type.', 'हर रूम टाइप का एक रात का बेस किराया लिखें।');
      if (rooms.some((r) => r.weekend_price !== '' && r.weekend_price != null && !(Number(r.weekend_price) > 0))) return L('Weekend price must be a positive amount or empty.', 'वीकेंड किराया सही रकम हो या ख़ाली।');
    }
    return '';
  }
  function next() { const m = check(step); if (m) { setErr(m); return; } setErr(''); setStep(step + 1); }

  async function upload(e) {
    const files = [...(e.target.files || [])]; e.target.value = '';
    if (!files.length) return;
    setBusy('photo'); setErr('');
    const db = browserDb(); const added = [];
    for (const f of files.slice(0, 10 - v.images.length)) {
      if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { setErr(L('Only JPG, PNG or WebP photos.', 'सिर्फ़ JPG, PNG या WebP फ़ोटो।')); continue; }
      if (f.size > 5 * 1024 * 1024) { setErr(L('Each photo must be under 5 MB.', 'हर फ़ोटो 5 MB से कम हो।')); continue; }
      const path = `${userId}/stay-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${f.type.split('/')[1].replace('jpeg', 'jpg')}`;
      const { error } = await db.storage.from('media').upload(path, f, { cacheControl: '31536000', upsert: false, contentType: f.type });
      if (error) { setErr(error.message); continue; }
      added.push(db.storage.from('media').getPublicUrl(path).data.publicUrl);
    }
    setV((cur) => ({ ...cur, images: [...cur.images, ...added] }));
    setBusy('');
  }

  async function save(submit) {
    for (let s = 0; s < 2; s++) { const m = check(s); if (m) { setStep(s); setErr(m); return; } }
    if (submit && !v.images.length) { setStep(2); setErr(L('Add at least one photo before sending for review.', 'जाँच के लिए भेजने से पहले कम से कम एक फ़ोटो जोड़ें।')); return; }
    setBusy(submit ? 'submit' : 'draft'); setErr('');
    const db = browserDb();
    const house_rules = [`Check-in: ${v.checkin}`, `Check-out: ${v.checkout}`, v.cancellation.trim() ? `Cancellation: ${v.cancellation.trim()}` : null, v.rules.trim()].filter(Boolean).join('\n').slice(0, 4000);
    const row = {
      name: v.name.trim().slice(0, 160), village: v.village.trim(), district: v.district.trim(), state: v.state.trim() || 'Uttarakhand', location_id: v.location_id || null,
      summary: v.summary.trim().slice(0, 400), description: (v.description.trim() || v.summary.trim()).slice(0, 6000), amenities: v.amenities, meals: v.meals.trim().slice(0, 400), house_rules,
      images: v.images, rooms: rooms.reduce((s, r) => s + Number(r.total_inventory), 0), max_guests: rooms.reduce((s, r) => s + Number(r.max_guests) * Number(r.total_inventory), 0),
      price_per_night: Math.min(...rooms.map((r) => Number(r.base_price))), status: submit ? 'pending' : 'draft',
    };
    try {
      let hid = property?.id;
      if (hid) { const { error } = await db.from('homestays').update(row).eq('id', hid); if (error) throw error; }
      else { const { data, error } = await db.from('homestays').insert({ ...row, partner_id: partnerId }).select('id').single(); if (error) throw error; hid = data.id; }
      for (const [i, r] of rooms.entries()) {
        const rr = { room_type: String(r.room_type).trim().slice(0, 80), max_guests: Number(r.max_guests), total_inventory: Number(r.total_inventory), base_price: Math.round(Number(r.base_price)),
          weekend_price: r.weekend_price === '' || r.weekend_price == null ? null : Math.round(Number(r.weekend_price)), sort: i, is_active: true };
        const { error } = r.id ? await db.from('homestay_rooms').update(rr).eq('id', r.id) : await db.from('homestay_rooms').insert({ ...rr, homestay_id: hid });
        if (error) throw error;
      }
      // Removed room types are hidden, not deleted, so past bookings keep their room.
      for (const id of removed) await db.from('homestay_rooms').update({ is_active: false }).eq('id', id);
      router.push('/partner/properties'); router.refresh();
    } catch (e) { setErr(e.message); setBusy(''); }
  }

  return (
    <div className="stack">
      <ol className="pp-steps" aria-label={L('Steps', 'कदम')}>{STEPS.map((s, i) => (
        <li key={s} className={i === step ? 'on' : i < step ? 'done' : ''}>
          <button type="button" aria-current={i === step ? 'step' : undefined} onClick={() => (i <= step || !check(step) ? (setErr(''), setStep(i)) : setErr(check(step)))}><i>{i < step ? '✓' : i + 1}</i>{s}</button>
        </li>
      ))}</ol>
      <div className="ds-panel stack">

      {step === 0 ? (
        <div className="stack">
          <label className="field"><span className="field-label">{L('Homestay name', 'होमस्टे का नाम')} *</span><input className="input" value={v.name} onChange={set('name')} maxLength={160} /></label>
          <div className="form-grid">
            <label className="field"><span className="field-label">{L('Village / town', 'गाँव / कस्बा')} *</span><input className="input" value={v.village} onChange={set('village')} maxLength={120} /></label>
            <label className="field"><span className="field-label">{L('District', 'ज़िला')} *</span><input className="input" value={v.district} onChange={set('district')} maxLength={80} placeholder="Almora" /></label>
            <label className="field"><span className="field-label">{L('State', 'राज्य')}</span><input className="input" value={v.state} onChange={set('state')} maxLength={80} /></label>
            <label className="field"><span className="field-label">{L('Nearest listed place (for the map and search)', 'सूची में पास की जगह (नक्शे और खोज के लिए)')}</span>
              <select className="input" value={v.location_id} onChange={set('location_id')}><option value="">—</option>{locations.map((l) => <option key={l.id} value={l.id}>{lang === 'hi' && l.name_hi ? l.name_hi : l.name}{l.district ? ` · ${l.district}` : ''}</option>)}</select></label>
          </div>
          <label className="field"><span className="field-label">{L('One-line summary', 'एक लाइन का परिचय')} *</span><input className="input" value={v.summary} onChange={set('summary')} maxLength={300} /></label>
          <label className="field"><span className="field-label">{L('Description', 'विवरण')}</span><textarea className="input" rows={5} value={v.description} onChange={set('description')} maxLength={4000} /></label>
          <div className="field"><span className="field-label">{L('Amenities', 'सुविधाएँ')}</span>
            <div className="chips">{[...new Set([...amenities, ...v.amenities])].map((a) => (
              <button key={a} type="button" className={`chip chip-toggle${v.amenities.includes(a) ? ' on' : ''}`} aria-pressed={v.amenities.includes(a)}
                onClick={() => setV({ ...v, amenities: v.amenities.includes(a) ? v.amenities.filter((x) => x !== a) : [...v.amenities, a] })}>{a}</button>
            ))}</div></div>
          <label className="field"><span className="field-label">{L('Meals', 'खाना')}</span><input className="input" value={v.meals} onChange={set('meals')} maxLength={400} placeholder={L('e.g. Breakfast included, dinner on request', 'जैसे नाश्ता शामिल, रात का खाना माँगने पर')} /></label>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="stack">
          {rooms.map((r, i) => (
            <div key={r.id || `n${i}`} className="pp-room">
              <div className="pp-room-h"><strong>{String(r.room_type || '').trim() || L(`Room type ${i + 1}`, `रूम टाइप ${i + 1}`)}</strong>
                {rooms.length > 1 ? <button type="button" className="btn btn-danger-ghost btn-sm" onClick={() => { if (r.id) setRemoved([...removed, r.id]); setRooms(rooms.filter((_, j) => j !== i)); }}>{L('Remove', 'हटाएँ')}</button> : null}</div>
              <div className="form-grid">
                <label className="field"><span className="field-label">{L('Room type name', 'रूम टाइप का नाम')}</span><input className="input" value={r.room_type} onChange={(e) => setRoom(i, 'room_type', e.target.value)} maxLength={80} /></label>
                <label className="field"><span className="field-label">{L('Number of such rooms (units)', 'ऐसे कितने कमरे')}</span><input className="input" type="number" min={1} max={50} value={r.total_inventory} onChange={(e) => setRoom(i, 'total_inventory', e.target.value)} /></label>
                <label className="field"><span className="field-label">{L('Max guests per room', 'प्रति कमरा अधिकतम मेहमान')}</span><input className="input" type="number" min={1} max={20} value={r.max_guests} onChange={(e) => setRoom(i, 'max_guests', e.target.value)} /></label>
                <label className="field"><span className="field-label">{L('Base price per night (₹)', 'एक रात का बेस किराया (₹)')}</span><input className="input" type="number" min={1} value={r.base_price} onChange={(e) => setRoom(i, 'base_price', e.target.value)} /></label>
                <label className="field"><span className="field-label">{L('Weekend price (Fri & Sat nights, optional)', 'वीकेंड किराया (शुक्र और शनि की रात, वैकल्पिक)')}</span><input className="input" type="number" min={1} value={r.weekend_price ?? ''} onChange={(e) => setRoom(i, 'weekend_price', e.target.value)} /></label>
              </div>
            </div>
          ))}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRooms([...rooms, { room_type: '', max_guests: 2, total_inventory: 1, base_price: '', weekend_price: '' }])}>+ {L('Add room type', 'रूम टाइप जोड़ें')}</button>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="stack">
          <p className="small muted">{L('Real photos of your home only (JPG, PNG or WebP, up to 5 MB each, max 10). The first photo is the cover.', 'सिर्फ़ अपने घर की असली फ़ोटो (JPG, PNG या WebP, हर एक 5 MB तक, अधिकतम 10)। पहली फ़ोटो कवर बनेगी।')}</p>
          <div className="pp-photos">
            {v.images.map((u, i) => (
              <div key={u} className="pp-ph">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u} alt={L(`Photo ${i + 1}`, `फ़ोटो ${i + 1}`)} />
                {i > 0 ? <button type="button" className="badge badge-full pp-ph-cv" onClick={() => setV({ ...v, images: [u, ...v.images.filter((x) => x !== u)] })}>{L('Make cover', 'कवर बनाएँ')}</button>
                  : <span className="badge badge-approved pp-ph-cv">{L('Cover', 'कवर')}</span>}
                <button type="button" className="pp-ph-x" aria-label={L('Remove photo', 'फ़ोटो हटाएँ')} onClick={() => setV({ ...v, images: v.images.filter((x) => x !== u) })}>✕</button>
              </div>
            ))}
            {v.images.length < 10 ? <label className="pp-ph-add"><span aria-hidden="true" style={{ fontSize: 24 }}>📷</span>{busy === 'photo' ? L('Uploading…', 'अपलोड हो रहा है…') : L('Add photos', 'फ़ोटो जोड़ें')}
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={upload} disabled={busy === 'photo'} /></label> : null}
          </div>
          <p className="small muted">{L('Tip: bedroom, bathroom, view, outside of the house and a meal. Guests trust real photos.', 'सुझाव: बेडरूम, बाथरूम, नज़ारा, घर का बाहर और खाना। मेहमान असली फ़ोटो पर भरोसा करते हैं।')}</p>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="stack">
          <div className="form-grid">
            <label className="field"><span className="field-label">{L('Check-in time', 'चेक-इन समय')}</span><input className="input" type="time" value={v.checkin} onChange={set('checkin')} /></label>
            <label className="field"><span className="field-label">{L('Check-out time', 'चेक-आउट समय')}</span><input className="input" type="time" value={v.checkout} onChange={set('checkout')} /></label>
          </div>
          <label className="field"><span className="field-label">{L('Cancellation policy', 'रद्द करने की नीति')}</span><input className="input" value={v.cancellation} onChange={set('cancellation')} maxLength={400} placeholder={L('e.g. Free cancellation up to 3 days before check-in', 'जैसे चेक-इन से 3 दिन पहले तक मुफ़्त रद्द')} /></label>
          <label className="field"><span className="field-label">{L('House rules', 'घर के नियम')}</span><textarea className="input" rows={4} value={v.rules} onChange={set('rules')} maxLength={2000} /></label>
        </div>
      ) : null}

      {step === 4 ? (
        <div className="pp-cols">
          <div className="stack">
            <dl className="kv-rows">
              <div className="kv-row"><dt>{L('Name', 'नाम')}</dt><dd>{v.name}</dd></div>
              <div className="kv-row"><dt>{L('Place', 'जगह')}</dt><dd>{[v.village, v.district, v.state].filter(Boolean).join(', ')}</dd></div>
              <div className="kv-row"><dt>{L('Rooms', 'कमरे')}</dt><dd>{rooms.map((r) => `${r.room_type} × ${r.total_inventory} (${inr(Number(r.base_price))}${r.weekend_price ? ` / ${inr(Number(r.weekend_price))}` : ''})`).join(', ')}</dd></div>
              <div className="kv-row"><dt>{L('Photos', 'फ़ोटो')}</dt><dd>{v.images.length}{v.images.length && v.images.length < 5 ? ` · ${L('add more for best results', 'बेहतर नतीजे के लिए और जोड़ें')}` : ''}</dd></div>
              <div className="kv-row"><dt>{L('Check-in / out', 'चेक-इन / आउट')}</dt><dd>{v.checkin} / {v.checkout}</dd></div>
            </dl>
            <p className="small muted">{L('After you send it, the admin reviews it and sets the commission. You will see the status and any remarks here.', 'भेजने के बाद एडमिन जाँच करेंगे और कमीशन तय करेंगे। स्थिति और टिप्पणी आपको यहीं दिखेगी।')}</p>
            {!canSubmit ? <p className="soft-note">{L('You can send for review once your partner account is approved. Save as draft for now.', 'पार्टनर अकाउंट मंज़ूर होने पर जाँच के लिए भेज सकेंगे। अभी ड्राफ़्ट सेव करें।')}</p> : null}
          </div>
          <div>
            <p className="small muted" style={{ margin: '0 0 6px' }}>{L('How guests will see it', 'मेहमानों को ऐसा दिखेगा')}</p>
            <div className="pp-preview">
              <Cover url={v.images[0]} seed={property?.id || v.name} className="pp-cover" />
              <div><b>{v.name || '—'}</b><small>{[v.village, v.district].filter(Boolean).join(' · ')}</small>
                {v.summary ? <p className="small" style={{ margin: '6px 0 0' }}>{v.summary}</p> : null}
                {rooms.some((r) => Number(r.base_price) > 0) ? <p style={{ margin: '6px 0 0' }}><strong>{L('From', 'से')} {inr(Math.min(...rooms.filter((r) => Number(r.base_price) > 0).map((r) => Number(r.base_price))))}</strong> <small>/ {L('night', 'रात')}</small></p> : null}</div>
            </div>
          </div>
        </div>
      ) : null}

      {err ? <p className="form-err" role="alert">{err}</p> : null}
      </div>
      <div className="pp-sticky">
        {step > 0 ? <button type="button" className="btn btn-ghost" onClick={() => { setErr(''); setStep(step - 1); }}>← {L('Back', 'पीछे')}</button> : null}
        <button type="button" className="btn btn-ghost" disabled={!!busy} onClick={() => save(false)}>{busy === 'draft' ? L('Saving…', 'सेव हो रहा है…') : L('Save draft', 'ड्राफ़्ट सेव करें')}</button>
        {step < 4 ? <button type="button" className="btn grow-btn" onClick={next}>{L('Next', 'आगे')} →</button> : null}
        {step === 4 && canSubmit ? <button type="button" className="btn grow-btn" disabled={!!busy} onClick={() => save(true)}>{busy === 'submit' ? L('Sending…', 'भेजा जा रहा है…') : L('Send for review', 'जाँच के लिए भेजें')}</button> : null}
      </div>
    </div>
  );
}
