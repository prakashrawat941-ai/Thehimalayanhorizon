'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { browserDb } from '@/lib/supabase/client';

const PAGES = [['our-story', 'Our Story'], ['about', 'About Us'], ['our-office', 'Our Office'], ['privacy', 'Privacy'], ['terms', 'Terms']];

async function saveKey(key, value) {
  return browserDb().from('site_settings').upsert({ key, value }, { onConflict: 'key' });
}

function Group({ lang, k, title, fields, initial }) {
  const L = (en, hi) => (lang === 'hi' ? hi : en);
  const router = useRouter();
  const [v, setV] = useState(initial || {});
  const [msg, setMsg] = useState(null);
  return (
    <section className="ds-panel stack">
      <h2>{title}</h2>
      <div className="form-grid">{fields.map(([name, label, type = 'text', hint]) => (
        <label key={name} className="field"><span className="field-label">{label}</span>
          <input className="input" type={type} step="any" value={v[name] ?? ''} onChange={(e) => setV({ ...v, [name]: type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value })} />
          {hint ? <small className="muted">{hint}</small> : null}</label>
      ))}</div>
      {msg ? <p className={msg.err ? 'form-err' : 'form-ok'}>{msg.text}</p> : null}
      <button type="button" className="btn" onClick={async () => {
        const clean = Object.fromEntries(Object.entries(v).filter(([, x]) => x !== '' && x != null));
        const { error } = await saveKey(k, { ...(initial || {}), ...clean });
        setMsg(error ? { err: true, text: error.message } : { err: false, text: L('Saved', 'सेव हो गया') }); if (!error) router.refresh();
      }}>{L('Save', 'सेव करें')}</button>
    </section>
  );
}

export function SettingsEditor({ lang, settings }) {
  const L = (en, hi) => (lang === 'hi' ? hi : en);
  const router = useRouter();
  const [pages, setPages] = useState(settings.pages || {});
  const [faqs, setFaqs] = useState(Array.isArray(settings.faqs) ? settings.faqs : []);
  const [msg, setMsg] = useState(null);
  const savePages = async () => { const { error } = await saveKey('pages', pages); setMsg(error ? { err: true, text: error.message } : { err: false, text: L('Pages saved', 'पेज सेव हुए') }); router.refresh(); };
  const saveFaqs = async () => { const list = faqs.filter((f) => (f.q || '').trim() && (f.a || '').trim()); const { error } = await saveKey('faqs', list); setMsg(error ? { err: true, text: error.message } : { err: false, text: L('FAQ saved', 'FAQ सेव हुए') }); router.refresh(); };
  return (
    <div className="ds-body">
      <Group lang={lang} k="contact" title={L('Contact details', 'संपर्क जानकारी')} initial={settings.contact}
        fields={[['phone', L('Phone', 'फ़ोन'), 'tel'], ['whatsapp', 'WhatsApp', 'tel', L('With country code, e.g. 91XXXXXXXXXX', 'देश कोड के साथ, जैसे 91XXXXXXXXXX')], ['email', L('Email', 'ईमेल'), 'email'], ['address', L('Address', 'पता')]]} />
      <Group lang={lang} k="social" title={L('Social links', 'सोशल लिंक')} initial={settings.social}
        fields={[['instagram', 'Instagram (https://…)', 'url'], ['facebook', 'Facebook (https://…)', 'url'], ['youtube', 'YouTube (https://…)', 'url'], ['x', 'X / Twitter (https://…)', 'url']]} />
      <Group lang={lang} k="cab_rules" title={L('Instant Cab rules', 'इंस्टेंट कैब नियम')} initial={settings.cab_rules}
        fields={[['hold_minutes', L('Seat hold (minutes)', 'सीट होल्ड (मिनट)'), 'number'], ['corridor_km', L('Route match radius (km)', 'रूट मैच दूरी (किमी)'), 'number'], ['min_rides', L('Rides before reliability score shows', 'रिलायबिलिटी स्कोर दिखाने से पहले राइड'), 'number'], ['min_reviews', L('Minimum reviews for score', 'स्कोर के लिए न्यूनतम रिव्यू'), 'number'], ['share_hours', L('Live-share link valid (hours)', 'लाइव-शेयर लिंक (घंटे)'), 'number']]} />
      <Group lang={lang} k="trip_defaults" title={L('Trip Planner cost assumptions', 'ट्रिप प्लानर ख़र्च अनुमान')} initial={settings.trip_defaults}
        fields={[['fuel_price', L('Fuel price ₹/litre', 'पेट्रोल ₹/लीटर'), 'number'], ['diesel_price', L('Diesel price ₹/litre', 'डीज़ल ₹/लीटर'), 'number'], ['updated_on', L('Rates checked on', 'रेट की तारीख़'), 'date'], ['taxi_per_km', L('Taxi ₹/km', 'टैक्सी ₹/किमी'), 'number'], ['food_per_person_day', L('Food ₹/person/day', 'खाना ₹/व्यक्ति/दिन'), 'number'], ['stay_per_night', L('Stay ₹/room/night', 'रुकना ₹/कमरा/रात'), 'number']]} />
      <Group lang={lang} k="brand" title={L('Brand', 'ब्रांड')} initial={settings.brand} fields={[['name', 'Name (English)'], ['name_hi', 'नाम (हिंदी)'], ['tagline', 'Tagline'], ['tagline_hi', 'टैगलाइन']]} />

      <section className="ds-panel stack">
        <h2>{L('Website pages', 'वेबसाइट पेज')}</h2>
        <p className="small muted">{L('Leave a page empty to show "Coming soon". Write only true information.', 'पेज ख़ाली छोड़ने पर "जल्द आ रहा है" दिखेगा। सिर्फ़ सच्ची जानकारी लिखें।')}</p>
        {PAGES.map(([k, name]) => {
          const p = pages[k] || {};
          const set = (f) => (e) => setPages({ ...pages, [k]: { ...p, [f]: e.target.value } });
          return (
            <details key={k} className="panel"><summary><strong>{name}</strong> {p.body ? '✓' : ''}</summary>
              <div className="form-grid">
                <label className="field"><span className="field-label">Title</span><input className="input" value={p.title || ''} onChange={set('title')} /></label>
                <label className="field"><span className="field-label">शीर्षक</span><input className="input" value={p.title_hi || ''} onChange={set('title_hi')} /></label>
                <label className="field span-2"><span className="field-label">Text (English)</span><textarea className="input" rows={8} value={p.body || ''} onChange={set('body')} /></label>
                <label className="field span-2"><span className="field-label">टेक्स्ट (हिंदी)</span><textarea className="input" rows={8} value={p.body_hi || ''} onChange={set('body_hi')} /></label>
              </div>
            </details>
          );
        })}
        <button type="button" className="btn" onClick={savePages}>{L('Save pages', 'पेज सेव करें')}</button>
      </section>

      <section className="ds-panel stack">
        <h2>FAQ</h2>
        {faqs.map((f, i) => (
          <div key={i} className="panel form-grid">
            {['q', 'q_hi', 'a', 'a_hi'].map((k) => (
              <label key={k} className={`field${k.startsWith('a') ? ' span-2' : ''}`}><span className="field-label">{{ q: 'Question', q_hi: 'सवाल', a: 'Answer', a_hi: 'जवाब' }[k]}</span>
                {k.startsWith('a') ? <textarea className="input" rows={3} value={f[k] || ''} onChange={(e) => setFaqs(faqs.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)))} />
                  : <input className="input" value={f[k] || ''} onChange={(e) => setFaqs(faqs.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)))} />}</label>
            ))}
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFaqs(faqs.filter((_, j) => j !== i))}>{L('Remove', 'हटाएँ')}</button>
          </div>
        ))}
        <div className="row-actions">
          <button type="button" className="btn btn-ghost" onClick={() => setFaqs([...faqs, { q: '', q_hi: '', a: '', a_hi: '' }])}>+ {L('Add question', 'सवाल जोड़ें')}</button>
          <button type="button" className="btn" onClick={saveFaqs}>{L('Save FAQ', 'FAQ सेव करें')}</button>
        </div>
      </section>
      {msg ? <p className={msg.err ? 'form-err' : 'form-ok'} role="status">{msg.text}</p> : null}
    </div>
  );
}
