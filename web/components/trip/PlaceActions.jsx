'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { browserDb } from '@/lib/supabase/client';
import { Icon } from '../Icon';

/** ♥ Save place + write a review (reviews wait for admin approval before they show). */
export function PlaceActions({ locationId, lang }) {
  const L = (en, hi) => (lang === 'hi' ? hi : en);
  const path = usePathname();
  const [user, setUser] = useState(undefined);
  const [saved, setSaved] = useState(false);
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const db = browserDb();
    db.auth.getUser().then(async ({ data }) => {
      setUser(data.user || null);
      if (data.user) {
        const { data: s } = await db.from('saved_destinations').select('location_id').eq('user_id', data.user.id).eq('location_id', locationId).maybeSingle();
        setSaved(!!s);
      }
    });
  }, [locationId]);

  const login = `/login?next=${encodeURIComponent(path)}`;
  async function toggleSave() {
    const db = browserDb();
    setBusy(true);
    const { error } = saved
      ? await db.from('saved_destinations').delete().eq('user_id', user.id).eq('location_id', locationId)
      : await db.from('saved_destinations').insert({ user_id: user.id, location_id: locationId });
    setBusy(false);
    if (!error) setSaved(!saved); else setMsg({ err: true, text: error.message });
  }
  async function sendReview(e) {
    e.preventDefault();
    if (!rating) { setMsg({ err: true, text: L('Please choose a rating.', 'कृपया रेटिंग चुनें।') }); return; }
    setBusy(true);
    const { error } = await browserDb().from('destination_reviews').insert({ user_id: user.id, location_id: locationId, rating, body: body.trim().slice(0, 1000) || null });
    setBusy(false);
    if (error) setMsg({ err: true, text: error.message });
    else { setMsg({ err: false, text: L('Thank you! Your review will appear after the admin checks it.', 'धन्यवाद! एडमिन की जाँच के बाद आपका रिव्यू दिखेगा।') }); setOpen(false); setBody(''); setRating(0); }
  }

  if (user === undefined) return null;
  return (
    <div className="stack">
      <div className="row-actions">
        {user ? (
          <button type="button" className={`btn ${saved ? '' : 'btn-ghost'} btn-sm`} aria-pressed={saved} disabled={busy} onClick={toggleSave}>
            <Icon name="heart" size={16} /> {saved ? L('Saved', 'सेव है') : L('Save place', 'जगह सेव करें')}
          </button>
        ) : <Link className="btn btn-ghost btn-sm" href={login}><Icon name="heart" size={16} /> {L('Save place', 'जगह सेव करें')}</Link>}
        {user ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(!open)}><Icon name="star" size={16} /> {L('Write a review', 'रिव्यू लिखें')}</button>
          : <Link className="btn btn-ghost btn-sm" href={login}><Icon name="star" size={16} /> {L('Write a review', 'रिव्यू लिखें')}</Link>}
      </div>
      {open ? (
        <form className="panel stack" onSubmit={sendReview}>
          <div role="radiogroup" aria-label={L('Rating', 'रेटिंग')} className="stars-input">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n}`} className={n <= rating ? 'on' : ''} onClick={() => setRating(n)}>★</button>
            ))}
          </div>
          <label className="field"><span className="field-label">{L('Your experience (optional)', 'आपका अनुभव (वैकल्पिक)')}</span>
            <textarea className="input" rows={4} maxLength={1000} value={body} onChange={(e) => setBody(e.target.value)} /></label>
          <button className="btn" disabled={busy}>{L('Send review', 'रिव्यू भेजें')}</button>
        </form>
      ) : null}
      {msg ? <p className={msg.err ? 'form-err' : 'form-ok'} role="status">{msg.text}</p> : null}
    </div>
  );
}
