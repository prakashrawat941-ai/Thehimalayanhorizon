'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { browserDb } from '@/lib/supabase/client';
import { inr } from '@/lib/format';
import { istDay, nightsBetween } from '@/lib/stay';

const EVT = 'thh:stay-room';
const pickRoom = (id) => window.dispatchEvent(new CustomEvent(EVT, { detail: id }));

/** Room cards on the homestay page. Tapping one selects it in the booking card (and the other way round). */
export function RoomCards({ rooms, lang }) {
  const L = (en, hi) => (lang === 'hi' ? hi : en);
  const [sel, setSel] = useState(rooms[0]?.id || null);
  useEffect(() => { const on = (e) => setSel(e.detail); window.addEventListener(EVT, on); return () => window.removeEventListener(EVT, on); }, []);
  return (
    <div className="st-rooms">
      {rooms.map((r) => (
        <button key={r.id} type="button" className={`st-room${sel === r.id ? ' on' : ''}`} aria-pressed={sel === r.id} onClick={() => pickRoom(r.id)}>
          <span className="st-room-t"><b>{r.room_type}</b>
            <small>{L(`Up to ${r.max_guests} guests`, `अधिकतम ${r.max_guests} मेहमान`)} · {L(`${r.total_inventory} room(s) of this type`, `इस तरह के ${r.total_inventory} कमरे`)}</small></span>
          <span className="st-room-p"><b>{inr(r.base_price)}</b><small>/ {L('night', 'रात')}{r.weekend_price ? ` · ${L('weekend', 'वीकेंड')} ${inr(r.weekend_price)}` : ''}</small></span>
        </button>
      ))}
    </div>
  );
}

/**
 * Booking request for a homestay. The price comes from quote_homestay; the request is saved in booking_requests
 * (the database re-checks rooms, guests and the amount). The "request sent" screen only appears after the insert succeeds.
 */
export function StayBooking({ listing, rooms, lang, profile }) {
  const L = (en, hi) => (lang === 'hi' ? hi : en);
  const path = usePathname();
  const [user, setUser] = useState(undefined);
  const [f, setF] = useState({ start: istDay(7), end: istDay(9), room: rooms[0]?.id || null, n: 1, g: 2, name: profile?.full_name || '', phone: profile?.phone || '', message: '' });
  const [quote, setQuote] = useState(null); // null | 'loading' | { error } | { total, nights, rooms, available }
  const [retry, setRetry] = useState(0);
  const [sheet, setSheet] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const box = useRef(null);
  const room = rooms.find((r) => r.id === f.room) || rooms[0];
  const cap = room ? room.max_guests * f.n : 0;
  const nights = nightsBetween(f.start, f.end);
  const lowest = rooms.length ? Math.min(...rooms.map((r) => r.base_price)) : null;

  useEffect(() => {
    browserDb().auth.getUser().then(({ data }) => setUser(data.user || null));
    // Dates kept across sign-in (see the login link below).
    const q = new URLSearchParams(window.location.search);
    const ok = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '') && d >= istDay(0);
    const ci = q.get('ci'), co = q.get('co'), rm = q.get('room');
    if (ok(ci) && ok(co) && co > ci) setF((x) => ({ ...x, start: ci, end: co }));
    if (rm && rooms.some((r) => r.id === rm)) { setF((x) => ({ ...x, room: rm })); pickRoom(rm); }
    const n = Number(q.get('n')), g = Number(q.get('g'));
    if (n >= 1) setF((x) => ({ ...x, n: Math.min(n, (rooms.find((r) => r.id === (rm || x.room)) || rooms[0])?.total_inventory || 1) }));
    if (g >= 1 && g <= 50) setF((x) => ({ ...x, g }));
    const on = (e) => setF((x) => { const r = rooms.find((y) => y.id === e.detail); return r ? { ...x, room: r.id, n: Math.min(x.n, r.total_inventory) } : x; });
    window.addEventListener(EVT, on);
    return () => window.removeEventListener(EVT, on);
  }, [rooms]);

  useEffect(() => {
    if (!f.room || nights < 1) { setQuote(null); return undefined; }
    let alive = true;
    setQuote('loading');
    const t = setTimeout(async () => {
      const { data, error } = await browserDb().rpc('quote_homestay', { p_room: f.room, p_start: f.start, p_end: f.end, p_rooms: f.n });
      if (alive) setQuote(error ? { error: error.message } : data);
    }, 300);
    return () => { alive = false; clearTimeout(t); };
  }, [f.room, f.start, f.end, f.n, nights, retry]);

  useEffect(() => {
    if (!sheet && !done) return undefined;
    const prev = document.activeElement;
    box.current?.querySelector('input, button')?.focus();
    const esc = (e) => { if (e.key === 'Escape' && !busy && !done) setSheet(false); };
    document.addEventListener('keydown', esc);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', esc); document.body.style.overflow = ''; prev?.focus?.(); };
  }, [sheet, done, busy]);

  if (!rooms.length) return <div className="st-card st-inline"><p className="muted" style={{ margin: 0 }}>{L('The host has not added rooms yet.', 'होस्ट ने अभी कमरे नहीं जोड़े हैं।')}</p></div>;

  const set = (k, v) => { setErr(''); setF((x) => ({ ...x, [k]: v })); };
  const notFree = quote && typeof quote === 'object' && !quote.error && quote.available === false;
  const tooMany = f.g > cap;
  const blocked = nights < 1 || tooMany || notFree || quote === 'loading' || (quote && quote.error);
  const loginHref = `/login?next=${encodeURIComponent(`${path}?ci=${f.start}&co=${f.end}&room=${f.room}&n=${f.n}&g=${f.g}`)}`;

  async function submit(e) {
    e.preventDefault(); setErr('');
    if (f.name.trim().length < 2) return setErr(L('Please enter your name.', 'कृपया अपना नाम लिखें।'));
    if (!/^[0-9+\s-]{7,20}$/.test(f.phone.trim())) return setErr(L('Please enter a valid phone number.', 'कृपया सही फ़ोन नंबर लिखें।'));
    if (nights < 1) return setErr(L('Check-out must be after check-in.', 'चेक-आउट, चेक-इन के बाद हो।'));
    if (tooMany) return setErr(L(`Up to ${cap} guests in ${f.n} room(s). Add another room.`, `${f.n} कमरे में ${cap} मेहमान तक। एक और कमरा जोड़ें।`));
    if (notFree) return setErr(L('Not enough rooms are free on these dates.', 'इन तारीख़ों पर इतने कमरे खाली नहीं हैं।'));
    setBusy(true);
    const { data, error } = await browserDb().from('booking_requests').insert({
      kind: 'homestay', user_id: user.id, homestay_id: listing.id, room_id: f.room, rooms_booked: f.n,
      guest_name: f.name.trim().slice(0, 120), guest_phone: f.phone.trim(), start_date: f.start, end_date: f.end,
      guests: Math.max(1, Math.min(50, Number(f.g) || 1)), message: f.message.trim().slice(0, 1000),
    }).select('id, booking_code').single();
    setBusy(false);
    if (error) return setErr(/not enough rooms|free/i.test(error.message) ? L('Not enough rooms are free on these dates.', 'इन तारीख़ों पर इतने कमरे खाली नहीं हैं।') : error.message);
    setSheet(false);
    setDone({ id: data.id, code: data.booking_code });
  }

  const stepper = (label, sub, k, min, max) => (
    <div className="st-step"><span><b>{label}</b><small>{sub}</small></span>
      <span className="st-stp">
        <button type="button" onClick={() => set(k, Math.max(min, f[k] - 1))} disabled={f[k] <= min} aria-label={L(`Fewer: ${label}`, `कम: ${label}`)}>−</button>
        <output aria-live="polite">{f[k]}</output>
        <button type="button" onClick={() => set(k, Math.min(max, f[k] + 1))} disabled={f[k] >= max} aria-label={L(`More: ${label}`, `ज़्यादा: ${label}`)}>+</button>
      </span></div>
  );
  const fields = (
    <>
      <div className="st-dates">
        <label><span>{L('Check-in', 'चेक-इन')}</span><input type="date" min={istDay(0)} value={f.start} onChange={(e) => { const v = e.target.value; setErr(''); setF((x) => ({ ...x, start: v, end: x.end <= v ? new Date(Date.parse(`${v}T12:00:00Z`) + 864e5).toISOString().slice(0, 10) : x.end })); }} required /></label>
        <label><span>{L('Check-out', 'चेक-आउट')}</span><input type="date" min={f.start} value={f.end} onChange={(e) => set('end', e.target.value)} required /></label>
      </div>
      {rooms.length > 1 ? <label className="field"><span className="field-label">{L('Room', 'कमरा')}</span>
        <select className="input" value={f.room} onChange={(e) => { const r = rooms.find((y) => y.id === e.target.value); setF((x) => ({ ...x, room: r.id, n: Math.min(x.n, r.total_inventory) })); pickRoom(r.id); }}>
          {rooms.map((r) => <option key={r.id} value={r.id}>{r.room_type}</option>)}</select></label> : <p className="small" style={{ margin: 0 }}><strong>{room.room_type}</strong></p>}
      {stepper(L('Rooms', 'कमरे'), L(`${room.total_inventory} of this type`, `इस तरह के ${room.total_inventory}`), 'n', 1, room.total_inventory)}
      {stepper(L('Guests', 'मेहमान'), L(`Up to ${cap} in ${f.n} room(s)`, `${f.n} कमरे में ${cap} तक`), 'g', 1, 50)}
      {tooMany ? <p className="form-err" role="alert">{L(`Up to ${cap} guests in ${f.n} room(s). Add another room.`, `${f.n} कमरे में ${cap} मेहमान तक। एक और कमरा जोड़ें।`)}</p> : null}
      {nights < 1 ? <p className="form-err" role="alert">{L('Check-out must be after check-in.', 'चेक-आउट, चेक-इन के बाद हो।')}</p>
        : quote === 'loading' ? <div className="st-quote" aria-busy="true"><span className="st-skel" style={{ width: '70%' }} /><span className="st-skel" /></div>
          : quote?.error ? <div className="st-quote bad" role="alert"><b>{L("Couldn't check the price right now.", 'अभी किराया नहीं देख पाए।')}</b><p>{quote.error} · <button type="button" className="link-btn" onClick={() => setRetry((x) => x + 1)}>{L('Try again', 'फिर कोशिश करें')}</button></p></div>
            : quote ? <div className="st-quote" aria-live="polite">
              <div><span>{L(`${quote.nights} night(s) · ${quote.rooms} × ${room.room_type}`, `${quote.nights} रात · ${quote.rooms} × ${room.room_type}`)}</span><span>{inr(quote.total)}</span></div>
              <div className="tot"><span>{L('Estimated total', 'अनुमानित कुल')}</span><span>{inr(quote.total)}</span></div>
              {quote.available ? <b className="ok">✓ {L('Free on these dates', 'इन तारीख़ों पर ख़ाली')}</b> : <b className="no">✕ {L('Not enough rooms free on these dates. Try other dates or fewer rooms.', 'इन तारीख़ों पर इतने कमरे ख़ाली नहीं। दूसरी तारीख़ या कम कमरे चुनें।')}</b>}
              <p>{L('Approximate. The host confirms and the final amount is fixed then. No payment now — you pay the host directly.', 'अनुमानित। होस्ट कन्फर्म करेंगे, तब अंतिम रकम तय होगी। अभी कोई पेमेंट नहीं — भुगतान सीधे होस्ट को।')}</p>
            </div> : null}
    </>
  );
  const fromLine = lowest ? <div className="st-from"><b>{inr(lowest)}</b><span>/ {L('night, from', 'रात, से')}</span></div> : null;

  return (
    <>
      <div className="st-card st-inline">
        {fromLine}
        {fields}
        {user === null ? <Link className="btn btn-block" href={loginHref}>{L('Sign in to request', 'रिक्वेस्ट के लिए लॉगिन करें')}</Link>
          : <button type="button" className="btn btn-block" disabled={blocked || user === undefined} onClick={() => setSheet(true)}>{L('Continue', 'आगे बढ़ें')}</button>}
        <p className="st-note">🔒 {L("No payment now. You'll get a notification when the host replies.", 'अभी कोई पेमेंट नहीं। होस्ट के जवाब पर आपको सूचना मिलेगी।')}</p>
      </div>

      <div className="st-mbar">
        <span>{lowest ? <b>{inr(lowest)} <small>/ {L('night, from', 'रात, से')}</small></b> : null}{L('Estimate · host confirms', 'अनुमान · होस्ट कन्फर्म करेंगे')}</span>
        <button type="button" className="btn" onClick={() => setSheet(true)}>{L('Check dates', 'तारीख़ देखें')}</button>
      </div>

      {sheet ? (
        <div className="st-ov" onClick={(e) => { if (e.target === e.currentTarget && !busy) setSheet(false); }}>
          <form className="st-sheet" role="dialog" aria-modal="true" aria-labelledby="st-sheet-h" ref={box} onSubmit={submit} noValidate>
            <div className="st-sheet-h"><h2 id="st-sheet-h">{L('Request a booking', 'बुकिंग रिक्वेस्ट')}</h2>
              <button type="button" className="st-x" onClick={() => setSheet(false)} disabled={busy} aria-label={L('Close', 'बंद करें')}>✕</button></div>
            <p className="small muted" style={{ margin: '0 0 8px' }}>{listing.name}</p>
            <div className="st-card">
              {fields}
              {user === null ? <>
                <p className="small" style={{ margin: 0 }}>{L('Sign in to send a booking request. Your dates stay saved.', 'बुकिंग रिक्वेस्ट भेजने के लिए लॉगिन करें। आपकी तारीख़ें सेव रहेंगी।')}</p>
                <Link className="btn btn-block" href={loginHref}>{L('Sign in to continue', 'लॉगिन करके आगे बढ़ें')}</Link>
              </> : <>
                <label className="field"><span className="field-label">{L('Your name', 'आपका नाम')}</span><input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} maxLength={120} autoComplete="name" required /></label>
                <label className="field"><span className="field-label">{L('Phone', 'फ़ोन')}</span><input className="input" type="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} autoComplete="tel" inputMode="tel" required /></label>
                <label className="field"><span className="field-label">{L('Message for the host (optional)', 'होस्ट के लिए मैसेज (वैकल्पिक)')}</span><textarea className="input" rows={2} maxLength={1000} value={f.message} onChange={(e) => set('message', e.target.value)} placeholder={L('e.g. We arrive around 6 pm', 'जैसे हम शाम 6 बजे तक पहुँचेंगे')} /></label>
                {err ? <p className="form-err" role="alert">{err}</p> : null}
                <button type="submit" className="btn btn-block" disabled={busy || blocked || user === undefined}>{busy ? L('Sending…', 'भेज रहे हैं…') : L('Send booking request', 'बुकिंग रिक्वेस्ट भेजें')}</button>
              </>}
              <p className="st-note">🔒 {L('No payment now. The host confirms first.', 'अभी कोई पेमेंट नहीं। पहले होस्ट कन्फर्म करेंगे।')}</p>
            </div>
          </form>
        </div>
      ) : null}

      {done ? (
        <div className="st-ov st-ov-done">
          <div className="st-sheet st-done" role="dialog" aria-modal="true" aria-labelledby="st-done-h" ref={box}>
            <div className="st-big" aria-hidden="true">✓</div>
            <h2 id="st-done-h">{L('Request sent', 'रिक्वेस्ट भेज दी')}</h2>
            <p className="muted" style={{ margin: 0 }}>{listing.name} · {f.start} → {f.end} · {f.n} {L('room(s)', 'कमरे')} · {f.g} {L('guests', 'मेहमान')}</p>
            {done.code ? <span className="st-code">{done.code}</span> : null}
            <ol className="st-next">
              <li className="ok"><i>✓</i><span><b>{L('Request received', 'रिक्वेस्ट मिल गई')}</b><small>{L('The host has been told.', 'होस्ट को बता दिया गया है।')}</small></span></li>
              <li><i>2</i><span><b>{L('Host confirms or declines', 'होस्ट कन्फर्म या मना करेंगे')}</b><small>{L("You'll get a notification when they reply.", 'जवाब आने पर आपको सूचना मिलेगी।')}</small></span></li>
              <li><i>3</i><span><b>{L('Stay and pay the host', 'ठहरें और होस्ट को भुगतान करें')}</b><small>{L('The final amount is fixed when the host confirms. No online payment.', 'होस्ट के कन्फर्म करने पर अंतिम रकम तय होगी। कोई ऑनलाइन पेमेंट नहीं।')}</small></span></li>
            </ol>
            <div className="st-done-acts"><Link className="btn" href="/account/bookings">{L('See my bookings', 'मेरी बुकिंग देखें')}</Link><Link className="btn btn-ghost" href="/homestays">{L('More homestays', 'और होमस्टे')}</Link></div>
          </div>
        </div>
      ) : null}
    </>
  );
}
