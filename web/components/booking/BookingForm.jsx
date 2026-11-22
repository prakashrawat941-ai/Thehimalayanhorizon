'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { browserDb } from '@/lib/supabase/client';
import { inr } from '@/lib/format';

const addDays = (n) => new Date(Date.now() + 5.5 * 3600e3 + n * 864e5).toISOString().slice(0, 10);

/**
 * Booking request for a homestay (room + dates + live price from the database),
 * village tour or workspace. No online payment: the host confirms.
 */
export function BookingForm({ kind, listing, rooms = [], lang, profile }) {
  const L = (en, hi) => (lang === 'hi' ? hi : en);
  const router = useRouter();
  const path = usePathname();
  const [user, setUser] = useState(undefined);
  const isTour = kind === 'village_tour';
  const isStay = kind === 'homestay';
  const [f, setF] = useState({ name: profile?.full_name || '', phone: profile?.phone || '', start: addDays(7), end: addDays(isTour ? 7 : 9), guests: 2, message: '', room: rooms[0]?.id || null, n: 1 });
  const [quote, setQuote] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const room = rooms.find((r) => r.id === f.room);

  useEffect(() => { browserDb().auth.getUser().then(({ data }) => setUser(data.user || null)); }, []);
  useEffect(() => {
    if (!isStay || !f.room || !f.start || !f.end || f.end <= f.start) { setQuote(null); return; }
    let alive = true;
    const t = setTimeout(async () => {
      const { data, error } = await browserDb().rpc('quote_homestay', { p_room: f.room, p_start: f.start, p_end: f.end, p_rooms: f.n });
      if (alive) setQuote(error ? { error: error.message } : data);
    }, 300);
    return () => { alive = false; clearTimeout(t); };
  }, [isStay, f.room, f.start, f.end, f.n]);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  if (user === undefined) return null;
  if (!user) return <Link className="btn btn-block" href={`/login?next=${encodeURIComponent(path)}`}>{L('Sign in to request a booking', 'बुकिंग रिक्वेस्ट के लिए लॉगिन करें')}</Link>;

  async function submit(e) {
    e.preventDefault(); setErr('');
    const end = isTour ? f.start : f.end;
    if (f.name.trim().length < 2) return setErr(L('Please enter your name.', 'कृपया अपना नाम लिखें।'));
    if (!/^[0-9+\s-]{7,20}$/.test(f.phone.trim())) return setErr(L('Please enter a valid phone number.', 'कृपया सही फ़ोन नंबर लिखें।'));
    if (isStay && end <= f.start) return setErr(L('Check-out must be after check-in.', 'चेक-आउट, चेक-इन के बाद हो।'));
    if (end < f.start) return setErr(L('End date is before start date.', 'आख़िरी तारीख़ शुरुआत से पहले है।'));
    if (isStay && rooms.length && !f.room) return setErr(L('Choose a room.', 'कमरा चुनें।'));
    if (isStay && quote && quote.available === false) return setErr(L('Not enough rooms are free on these dates.', 'इन तारीख़ों पर इतने कमरे खाली नहीं हैं।'));
    setBusy(true);
    const row = {
      kind, user_id: user.id, guest_name: f.name.trim().slice(0, 120), guest_phone: f.phone.trim(), start_date: f.start, end_date: end,
      guests: Math.max(1, Math.min(50, Number(f.guests) || 1)), message: f.message.trim().slice(0, 1000), [`${kind}_id`]: listing.id,
      ...(isStay && f.room ? { room_id: f.room, rooms_booked: f.n } : {}),
    };
    const { error } = await browserDb().from('booking_requests').insert(row);
    setBusy(false);
    if (error) return setErr(error.message);
    router.push('/account/bookings?sent=1');
  }

  return (
    <form className="stack" onSubmit={submit}>
      <label className="field"><span className="field-label">{L('Name', 'नाम')}</span><input className="input" value={f.name} onChange={set('name')} required minLength={2} maxLength={120} autoComplete="name" /></label>
      <label className="field"><span className="field-label">{L('Phone', 'फ़ोन')}</span><input className="input" type="tel" value={f.phone} onChange={set('phone')} required pattern="[0-9+\s-]{7,20}" autoComplete="tel" /></label>
      <div className="form-grid">
        <label className="field"><span className="field-label">{isTour ? L('Date', 'तारीख़') : isStay ? L('Check-in', 'चेक-इन') : L('From', 'से')}</span>
          <input className="input" type="date" min={addDays(0)} value={f.start} onChange={(e) => setF({ ...f, start: e.target.value, end: f.end < e.target.value ? e.target.value : f.end })} required /></label>
        {!isTour ? <label className="field"><span className="field-label">{isStay ? L('Check-out', 'चेक-आउट') : L('To', 'तक')}</span>
          <input className="input" type="date" min={f.start} value={f.end} onChange={set('end')} required /></label> : null}
      </div>
      {isStay && rooms.length ? (
        <div className="field"><span className="field-label">{L('Choose a room', 'कमरा चुनें')}</span>
          {rooms.map((r) => (
            <button key={r.id} type="button" className={`room-opt${f.room === r.id ? ' on' : ''}`} aria-pressed={f.room === r.id} onClick={() => setF({ ...f, room: r.id, n: Math.min(f.n, r.total_inventory) })}>
              <strong>{r.room_type}</strong><span className="small muted">{inr(r.base_price)}/{L('night', 'रात')}{r.weekend_price ? ` · ${L('weekend', 'वीकेंड')} ${inr(r.weekend_price)}` : ''} · {L('up to', 'अधिकतम')} {r.max_guests} {L('guests', 'मेहमान')}</span>
            </button>
          ))}
          {room ? <label className="field"><span className="field-label">{L('Rooms', 'कितने कमरे')}</span>
            <input className="input" type="number" min={1} max={room.total_inventory} value={f.n} onChange={(e) => setF({ ...f, n: Math.max(1, Math.min(room.total_inventory, Number(e.target.value) || 1)) })} /></label> : null}
        </div>
      ) : null}
      <label className="field"><span className="field-label">{L('Guests', 'मेहमान')}</span><input className="input" type="number" min={1} max={50} value={f.guests} onChange={set('guests')} required /></label>
      {isStay && quote ? (
        <p className="quote" aria-live="polite">{quote.error ? quote.error : (
          <><strong>{inr(quote.total)}</strong> · {quote.nights} {L('night(s)', 'रात')} · {quote.rooms} {L('room(s)', 'कमरे')} {quote.available ? <span className="ok-t">· {L('available', 'उपलब्ध')}</span> : <span className="warn-text">· {L('not enough rooms free on these dates', 'इन तारीख़ों पर कमरे खाली नहीं')}</span>}</>
        )}</p>
      ) : null}
      <label className="field"><span className="field-label">{L('Message (optional)', 'मैसेज (वैकल्पिक)')}</span><textarea className="input" rows={3} maxLength={1000} value={f.message} onChange={set('message')} /></label>
      {err ? <p className="form-err" role="alert">{err}</p> : null}
      <button className="btn btn-block" disabled={busy}>{busy ? L('Sending…', 'भेज रहे हैं…') : L('Send booking request', 'बुकिंग रिक्वेस्ट भेजें')}</button>
      <small className="muted">{L('No payment now. The host confirms, then the amount is fixed. Pay the host directly.', 'अभी कोई पेमेंट नहीं। होस्ट कन्फर्म करेंगे, तब रकम तय होगी। भुगतान सीधे होस्ट को।')}</small>
    </form>
  );
}
