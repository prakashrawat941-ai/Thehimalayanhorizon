'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { browserDb } from '@/lib/supabase/client';
import { inr } from '@/lib/format';

const shift = (month, n) => { const [y, m] = month.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1)); return d.toISOString().slice(0, 7); };

export function RateCalendar({ lang, room, month, rates, booked = {} }) {
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
  // Tap one date, then a second date to select the whole range. A third tap starts again.
  const [anchor, setAnchor] = useState(null);
  function pick(iso) {
    setMsg(null);
    if (anchor && iso !== anchor && sel.length === 1) {
      const [a, z] = anchor < iso ? [anchor, iso] : [iso, anchor];
      const out = [];
      for (let d = a; d <= z; d = new Date(Date.parse(`${d}T12:00:00Z`) + 864e5).toISOString().slice(0, 10)) if (d >= today) out.push(d);
      setSel(out); setAnchor(null);
    } else if (sel.length === 1 && sel[0] === iso) { setSel([]); setAnchor(null); }
    else { setSel([iso]); setAnchor(iso); }
  }
  async function apply(clear = false, closeAll = false) {
    if (!sel.length) return;
    const b = closeAll ? room.total_inventory : blocked === '' ? 0 : Number(blocked);
    if (!clear && (b < 0 || b > room.total_inventory)) { setMsg({ err: true, text: L(`You can block 0–${room.total_inventory} rooms.`, `आप 0–${room.total_inventory} कमरे बंद कर सकते हैं।`) }); return; }
    if (!clear && price !== '' && !(Number(price) > 0)) { setMsg({ err: true, text: L('Price must be a positive amount.', 'किराया सही रकम हो।') }); return; }
    setBusy(true);
    const db = browserDb();
    const { error } = clear
      ? await db.from('room_rates').delete().eq('room_id', room.id).in('date', sel)
      : await db.from('room_rates').upsert(sel.map((date) => ({ room_id: room.id, date, custom_price: price === '' ? (closeAll ? byDate[date]?.custom_price ?? null : null) : Math.round(Number(price)), blocked_units: b })), { onConflict: 'room_id,date' });
    setBusy(false);
    if (error) { setMsg({ err: true, text: error.message }); return; }
    setMsg({ err: false, text: L('Saved', 'सेव हो गया') }); setSel([]); setAnchor(null); setPrice(''); setBlocked(''); router.refresh();
  }
  const fmtMonth = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return (
    <section className="pp-card stack">
      <div className="pp-cal-nav">
        <Link className="btn btn-ghost btn-sm" href={`/partner/calendar?room=${room.id}&month=${shift(month, -1)}`} aria-label={L('Previous month', 'पिछला महीना')}>←</Link>
        <strong>{fmtMonth} · {room.room_type}<small className="muted"> · {L('prices in ₹ per night', 'किराया ₹ प्रति रात')}</small></strong>
        <Link className="btn btn-ghost btn-sm" href={`/partner/calendar?room=${room.id}&month=${shift(month, 1)}`} aria-label={L('Next month', 'अगला महीना')}>→</Link>
      </div>
      <div className="pp-cal">
        {(lang === 'hi' ? ['सोम', 'मंगल', 'बुध', 'गुरु', 'शुक्र', 'शनि', 'रवि'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']).map((d) => <div key={d} className="dw">{d}</div>)}
        {Array.from({ length: lead }, (_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: days }, (_, i) => {
          const iso = `${month}-${String(i + 1).padStart(2, '0')}`;
          const r = byDate[iso];
          const dow = new Date(`${iso}T12:00:00Z`).getUTCDay();
          const we = (dow === 5 || dow === 6) && !!room.weekend_price;
          const nb = booked[iso] || 0;
          const closed = r?.blocked_units || 0;
          const full = nb + closed >= room.total_inventory;
          const on = sel.includes(iso);
          // Short cell note; colour shows booked (green) or closed (striped). The full text is in aria-label.
          const note = closed >= room.total_inventory ? L('closed', 'बंद') : nb || closed ? `${nb + closed}/${room.total_inventory}` : null;
          const full_note = closed >= room.total_inventory ? L('all rooms closed', 'सभी कमरे बंद') : [nb ? L(`${nb} of ${room.total_inventory} rooms booked`, `${room.total_inventory} में से ${nb} कमरे बुक`) : null, closed ? L(`${closed} closed`, `${closed} बंद`) : null].filter(Boolean).join(', ');
          const cls = [we ? 'we' : '', r?.custom_price ? 'sp' : '', nb ? 'bk' : '', closed ? 'bl' : '', on ? 'sel' : '', iso === today ? 'today' : ''].filter(Boolean).join(' ');
          return (
            <button key={iso} type="button" disabled={iso < today} className={cls} aria-pressed={on}
              aria-label={`${i + 1} · ${inr(priceFor(iso))}${full_note ? ` · ${full_note}` : ''}${full ? ` · ${L('no rooms free', 'कोई कमरा ख़ाली नहीं')}` : ''}`} onClick={() => pick(iso)}>
              <b>{i + 1}</b>
              <small>{Number(priceFor(iso)).toLocaleString('en-IN')}{r?.custom_price ? '★' : ''}</small>
              {note ? <small>{note}</small> : null}
            </button>
          );
        })}
      </div>
      <div className="pp-legend"><span><i style={{ background: '#fbf8f1' }} />{L('Weekend price', 'वीकेंड किराया')}</span><span><i style={{ background: '#e3f1e8' }} />{L('Has bookings (1/2 = 1 of 2 rooms taken)', 'बुकिंग है (1/2 = 2 में से 1 कमरा भरा)')}</span>
        <span><i style={{ background: 'repeating-linear-gradient(45deg,#f3eee3 0 3px,#fff 3px 6px)' }} />{L('Rooms closed', 'कमरे बंद')}</span><span>★ {L('Special price', 'ख़ास किराया')}</span></div>
      {sel.length ? (
        <div className="pp-sheet stack">
          <strong>{sel.length === 1 ? sel[0] : `${sel[0]} → ${sel[sel.length - 1]}`} · {L(`${sel.length} date(s)`, `${sel.length} तारीख़`)}</strong>
          {sel.length === 1 ? <small className="muted">{L('Tap another date to select a range.', 'रेंज चुनने के लिए दूसरी तारीख़ दबाएँ।')}</small> : null}
          <div className="pp-two wrap">
            <label className="field"><span className="field-label">{L('Price per night (₹, empty = normal)', 'एक रात का किराया (₹, ख़ाली = सामान्य)')}</span><input className="input" type="number" min={1} inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} /></label>
            <label className="field"><span className="field-label">{L(`Rooms to close (0–${room.total_inventory})`, `बंद करने वाले कमरे (0–${room.total_inventory})`)}</span><input className="input" type="number" min={0} max={room.total_inventory} inputMode="numeric" value={blocked} onChange={(e) => setBlocked(e.target.value)} /></label>
          </div>
          {msg ? <p className={msg.err ? 'form-err' : 'form-ok'} role="status">{msg.text}</p> : null}
          <div className="pp-acts">
            <button type="button" className="btn" disabled={busy} onClick={() => apply(false)}>{busy ? L('Saving…', 'सेव हो रहा है…') : L('Save', 'सेव करें')}</button>
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => apply(false, true)}>{L('Close all rooms', 'सभी कमरे बंद करें')}</button>
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => apply(true)}>{L('Reset to normal', 'सामान्य करें')}</button>
          </div>
          <small className="muted">{L('Closing rooms does not cancel bookings you already have. Guests see exactly the prices you set.', 'कमरे बंद करने से पहले की बुकिंग रद्द नहीं होती। मेहमानों को वही किराया दिखेगा जो आप रखेंगे।')}</small>
        </div>
      ) : (msg ? <p className={msg.err ? 'form-err' : 'form-ok'} role="status">{msg.text}</p> : <p className="small muted" style={{ margin: 0 }}>{L('Tap a date, or two dates for a range, to change the price or close rooms.', 'किराया बदलने या कमरे बंद करने के लिए एक तारीख़ या रेंज के लिए दो तारीख़ें दबाएँ।')}</p>)}
    </section>
  );
}
