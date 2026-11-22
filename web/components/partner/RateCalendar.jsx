'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { browserDb } from '@/lib/supabase/client';
import { inr } from '@/lib/format';

const shift = (month, n) => { const [y, m] = month.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1)); return d.toISOString().slice(0, 7); };

export function RateCalendar({ lang, room, month, rates }) {
  const L = (en, hi) => (lang === 'hi' ? hi : en);
  const router = useRouter();
  const [sel, setSel] = useState([]);
  const [price, setPrice] = useState('');
  const [blocked, setBlocked] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [y, m] = month.split('-').map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7; // Monday first
  const byDate = Object.fromEntries(rates.map((r) => [r.date, r]));
  const today = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
  const priceFor = (iso) => {
    const r = byDate[iso];
    if (r?.custom_price) return r.custom_price;
    const dow = new Date(`${iso}T12:00:00Z`).getUTCDay();
    return (dow === 5 || dow === 6) && room.weekend_price ? room.weekend_price : room.base_price;
  };
  async function apply(clear = false) {
    if (!sel.length) return;
    const b = blocked === '' ? 0 : Number(blocked);
    if (!clear && (b < 0 || b > room.total_inventory)) { setMsg({ err: true, text: L(`You can block 0–${room.total_inventory} rooms.`, `आप 0–${room.total_inventory} कमरे बंद कर सकते हैं।`) }); return; }
    if (!clear && price !== '' && !(Number(price) > 0)) { setMsg({ err: true, text: L('Price must be a positive amount.', 'किराया सही रकम हो।') }); return; }
    setBusy(true);
    const db = browserDb();
    const { error } = clear
      ? await db.from('room_rates').delete().eq('room_id', room.id).in('date', sel)
      : await db.from('room_rates').upsert(sel.map((date) => ({ room_id: room.id, date, custom_price: price === '' ? null : Math.round(Number(price)), blocked_units: b })), { onConflict: 'room_id,date' });
    setBusy(false);
    if (error) { setMsg({ err: true, text: error.message }); return; }
    setMsg({ err: false, text: L('Saved', 'सेव हो गया') }); setSel([]); router.refresh();
  }
  const fmtMonth = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return (
    <section className="ds-panel stack">
      <div className="row-actions" style={{ justifyContent: 'space-between' }}>
        <Link className="btn btn-ghost btn-sm" href={`/partner/calendar?room=${room.id}&month=${shift(month, -1)}`} aria-label={L('Previous month', 'पिछला महीना')}>←</Link>
        <strong>{fmtMonth}</strong>
        <Link className="btn btn-ghost btn-sm" href={`/partner/calendar?room=${room.id}&month=${shift(month, 1)}`} aria-label={L('Next month', 'अगला महीना')}>→</Link>
      </div>
      <div className="cal-grid" role="grid">
        {(lang === 'hi' ? ['सोम', 'मंगल', 'बुध', 'गुरु', 'शुक्र', 'शनि', 'रवि'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']).map((d) => <div key={d} className="cal-dow">{d}</div>)}
        {Array.from({ length: lead }, (_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: days }, (_, i) => {
          const iso = `${month}-${String(i + 1).padStart(2, '0')}`;
          const r = byDate[iso];
          const past = iso < today;
          const on = sel.includes(iso);
          return (
            <button key={iso} type="button" disabled={past} className={`cal-day${on ? ' on' : ''}${r?.custom_price ? ' custom' : ''}${r?.blocked_units ? ' blocked' : ''}`} aria-pressed={on}
              onClick={() => setSel(on ? sel.filter((x) => x !== iso) : [...sel, iso])}>
              <span className="cal-n">{i + 1}</span>
              <span className="cal-p">{inr(priceFor(iso))}</span>
              {r?.blocked_units ? <span className="cal-b">{L('blocked', 'बंद')} {r.blocked_units}/{room.total_inventory}</span> : null}
            </button>
          );
        })}
      </div>
      <div className="form-grid">
        <label className="field"><span className="field-label">{L('Special price for selected dates (₹, empty = normal)', 'चुनी तारीख़ों का ख़ास किराया (₹, ख़ाली = सामान्य)')}</span><input className="input" type="number" min={1} value={price} onChange={(e) => setPrice(e.target.value)} /></label>
        <label className="field"><span className="field-label">{L(`Rooms to block (0–${room.total_inventory})`, `बंद करने वाले कमरे (0–${room.total_inventory})`)}</span><input className="input" type="number" min={0} max={room.total_inventory} value={blocked} onChange={(e) => setBlocked(e.target.value)} /></label>
      </div>
      {msg ? <p className={msg.err ? 'form-err' : 'form-ok'} role="status">{msg.text}</p> : null}
      <div className="row-actions">
        <button type="button" className="btn" disabled={!sel.length || busy} onClick={() => apply(false)}>{L(`Apply to ${sel.length} date(s)`, `${sel.length} तारीख़ों पर लगाएँ`)}</button>
        <button type="button" className="btn btn-ghost" disabled={!sel.length || busy} onClick={() => apply(true)}>{L('Reset to normal', 'सामान्य करें')}</button>
      </div>
    </section>
  );
}
