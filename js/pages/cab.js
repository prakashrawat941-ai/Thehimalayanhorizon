// Instant Book Cab — customer side: entry choice, search, results, ride details,
// seat choice, confirmation, booking page, my bookings and the customer dashboard.
// Rides are real journeys published by drivers (cost sharing, pay the driver directly).
import { h, clear, toast, modal, busy, inr, todayISO, empty, loading, icon, lazy, whatsappLink } from '../ui.js';
import { getLang } from '../i18n.js';
import { sb, q } from '../sb.js';
import { state, user, loadProfile, settings } from '../store.js';
import { allPlaces, placeInput, placeName, placeById, placesCached } from '../places.js';

export const L = (en, hi) => (getLang() === 'hi' ? hi : en);
const back = (href) => h('a', { class: 'app-back', href, 'aria-label': L('Back', 'पीछे') }, h('span', { 'aria-hidden': 'true' }, '←'));
export const initials = (name = '') => String(name).split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '•';
export function avatar(url, name, cls = 'av') {
  if (url) {
    const img = h('img', { class: cls, src: url, alt: '', referrerpolicy: 'no-referrer', loading: 'lazy' });
    img.addEventListener('error', () => img.replaceWith(h('span', { class: `${cls} av-txt` }, initials(name))));
    return img;
  }
  return h('span', { class: `${cls} av-txt`, 'aria-hidden': 'true' }, initials(name));
}

export const timeOf = (d) => new Date(d).toLocaleTimeString(getLang() === 'hi' ? 'hi-IN' : 'en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
export const dateOf = (d) => new Date(d).toLocaleDateString(getLang() === 'hi' ? 'hi-IN' : 'en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
const istDayRange = (ymd) => { const s = new Date(`${ymd}T00:00:00+05:30`); return [s.toISOString(), new Date(s.getTime() + 864e5).toISOString()]; };

export const VEHICLES = {
  swift: { label: 'Swift', model: 'Maruti Swift', seats: 4 },
  wagonr: { label: 'WagonR', model: 'Maruti WagonR', seats: 4 },
  ertiga: { label: 'Ertiga', model: 'Maruti Ertiga', seats: 6 },
  bolero: { label: 'Bolero', model: 'Mahindra Bolero', seats: 7 },
  eeco: { label: 'Eco Van', model: 'Maruti Eeco', seats: 6 },
  other: { label: L('Other', 'अन्य'), model: '', seats: 4 },
};

export function statusPill(status, departure) {
  const past = departure && new Date(departure) < new Date();
  const map = {
    pending: ['warn', L('Waiting for driver', 'ड्राइवर के जवाब का इंतज़ार')],
    confirmed: past ? ['done', L('Completed', 'पूरी हुई')] : ['ok', L('Confirmed', 'कन्फ़र्म')],
    completed: ['done', L('Completed', 'पूरी हुई')],
    declined: ['bad', L('Declined', 'मना किया')],
    expired: ['bad', L('Request expired', 'रिक्वेस्ट की समय-सीमा ख़त्म')],
    started: ['ok', L('On the way', 'रास्ते में')],
    cancelled: ['bad', L('Cancelled', 'रद्द')],
    open: past ? ['done', L('Done', 'पूरी')] : ['ok', L('Published', 'पब्लिश')],
    full: past ? ['done', L('Done', 'पूरी')] : ['ok', L('Full', 'भरी हुई')],
  };
  const [k, label] = map[status] || ['done', status];
  return h('span', { class: `pill pill-${k}` }, label);
}

// Route of a ride as place ids: [from, ...stops, to]. Older partner rides use locations.
export function ridePath(r, places) {
  const viaLoc = (locId) => places.find((p) => p.location_id === locId)?.id || null;
  const from = r.from_place_id || viaLoc(r.from_location_id);
  const to = r.to_place_id || viaLoc(r.to_location_id);
  const stops = (r.stops || []).map((s) => s.place_id).filter(Boolean);
  return [from, ...stops, to].filter(Boolean);
}
// Start / end name: listed place, or (rides from any village) the saved name.
export function endName(r, which) {
  const path = ridePath(r, placesCached());
  const id = which === 'from' ? path[0] : path[path.length - 1];
  return placeName(placeById(id)) || r[`${which}_geo`]?.name || (which === 'from' ? r.pickup_point : r.drop_point) || '?';
}
export const routeLabel = (r) => `${endName(r, 'from')} → ${endName(r, 'to')}`;

// IDs: new format first (THH-DDMMYYYY-NNNN), older random codes still shown.
export const refOf = (b) => b.booking_ref || b.booking_code || b.id.slice(0, 8).toUpperCase();
// The Ride ID starts with the state + district code of the car (e.g. UK07); the full number stays private.
export const regionOf = (r) => { const p = (r?.ride_ref || '').slice(0, 4); return p && p !== 'THHX' ? p : ''; };
export const seatsLeftText = (left) => (left > 0 ? `${left} ${L(left === 1 ? 'seat left' : 'seats left', 'सीट बाकी')}` : L('Full', 'भरी हुई'));

// Driver record from real rides and reviews (database function). Partner rides have none.
export async function reliability(driverId) {
  if (!driverId) return null;
  return q(sb.rpc('driver_reliability', { p_driver: driverId })).catch(() => null);
}
function withThh(since) {
  if (!since) return '—';
  const months = Math.floor((Date.now() - new Date(since)) / (30.44 * 864e5));
  if (months < 1) return L('New', 'नए');
  if (months < 12) return `${months} ${L(months === 1 ? 'month' : 'months', 'महीने')}`;
  const y = Math.floor(months / 12);
  return `${y}+ ${L(y === 1 ? 'year' : 'years', 'साल')}`;
}
const LEVELS = { excellent: L('Excellent', 'बहुत बढ़िया'), good: L('Good', 'अच्छा'), fair: L('Fair', 'ठीक'), low: L('Needs improvement', 'सुधार चाहिए') };
export function trustPanel(rel) {
  if (!rel) return null;
  const stat = (value, label) => h('div', { class: 'trust-stat' }, h('strong', {}, value), h('span', {}, label));
  return h('section', { class: 'trust', 'aria-label': L('Driver record', 'ड्राइवर का रिकॉर्ड') },
    h('div', { class: 'trust-grid' },
      stat(rel.reviews ? `★ ${Number(rel.avg_rating).toFixed(1)}` : '—', rel.reviews ? `${rel.reviews} ${L(rel.reviews === 1 ? 'review' : 'reviews', 'रिव्यू')}` : L('No reviews yet', 'अभी कोई रिव्यू नहीं')),
      stat(String(rel.completed_rides), L('Rides completed', 'पूरी राइड')),
      stat(String(rel.passengers_served), L('Passengers served', 'यात्री पहुँचाए')),
      stat(withThh(rel.member_since), L('With The Himalayan Horizon', 'द हिमालयन होराइज़न के साथ'))),
    rel.enough_history
      ? h('p', { class: 'trust-note' }, h('span', { class: `rel-chip rel-${rel.level}` }, `${L('Reliability', 'भरोसा')}: ${LEVELS[rel.level] || rel.level} · ${rel.score}/100`),
        rel.cancellation_rate != null ? h('span', { class: 'small muted' }, ` ${L('Cancelled', 'रद्द')} ${Math.round(rel.cancellation_rate * 100)}% ${L('of rides', 'राइड')}`) : null)
      : h('p', { class: 'trust-note small muted' }, L('New driver: not enough completed rides and reviews yet for a reliability score.', 'नए ड्राइवर: भरोसे का स्कोर बनाने लायक राइड और रिव्यू अभी नहीं हैं।')));
}

// Live seat counts: other people's bookings update this screen without refreshing.
export function watchRides(ids, onRow) {
  const list = [...new Set(ids)].filter(Boolean).slice(0, 100);
  if (!list.length || typeof sb.channel !== 'function') return () => {};
  let ch = null;
  try {
    ch = sb.channel(`rides-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'cab_rides', filter: list.length === 1 ? `id=eq.${list[0]}` : `id=in.(${list.join(',')})` },
        (p) => { if (p?.new?.id) onRow(p.new); })
      .subscribe();
  } catch { return () => {}; }
  const stop = () => { try { sb.removeChannel(ch); } catch { /* ignore */ } window.removeEventListener('hashchange', stop); };
  window.addEventListener('hashchange', stop);
  return stop;
}

// Countdown for a request waiting for the driver (15-minute hold).
export function holdTimer(until, prefix) {
  const el = h('span', { class: 'hold', role: 'timer' });
  let t = null; let shown = false;
  const tick = () => {
    if (shown && !el.isConnected) { clearInterval(t); return; }
    if (el.isConnected) shown = true;
    const ms = new Date(until) - Date.now();
    if (ms <= 0) { el.textContent = L('Time is up. The seats are being released.', 'समय ख़त्म। सीटें छोड़ी जा रही हैं।'); el.classList.add('over'); clearInterval(t); return; }
    const m = Math.floor(ms / 60000); const sec = Math.floor(ms / 1000) % 60;
    el.textContent = `${prefix} ${m}:${String(sec).padStart(2, '0')}`;
  };
  tick(); t = setInterval(tick, 1000);
  return el;
}

// Success popup (booking and ride published). Rows are [label, value].
export function celebrate({ title, message, rows = [], actions = [], wait = false }) {
  const mark = h('div', { class: `cele-mark${wait ? ' wait' : ''}`, 'aria-hidden': 'true' });
  mark.innerHTML = wait
    ? '<svg viewBox="0 0 52 52"><circle class="c" cx="26" cy="26" r="24"/><path class="k" d="M26 14v13l8 5"/></svg>'
    : '<svg viewBox="0 0 52 52"><circle class="c" cx="26" cy="26" r="24"/><path class="k" d="M15 27l7 7 15-16"/></svg>';
  const body = h('div', { class: 'cele' }, mark,
    h('h2', { class: 'cele-title' }, title),
    message ? h('p', { class: 'cele-msg' }, message) : null,
    h('dl', { class: 'cele-rows' }, rows.filter((x) => x && x[1]).map(([k, v]) => h('div', { class: 'cele-row' }, h('dt', {}, k), h('dd', {}, v)))),
    h('div', { class: 'cele-actions' }, actions.filter(Boolean)));
  const dlg = modal('', body);
  dlg.el.classList.add('modal-cele');
  // Leaving the page (back button, bottom menu, a link in the popup) closes the popup too.
  const onNav = () => { window.removeEventListener('hashchange', onNav); if (dlg.el.isConnected) dlg.close(); };
  window.addEventListener('hashchange', onNav);
  return dlg;
}

// THH support contact from Admin → Settings (WhatsApp first, then phone). Null when not set.
export async function supportLink(text) {
  const c = (await settings().catch(() => ({})))?.contact || {};
  if (c.whatsapp) return { href: whatsappLink(c.whatsapp, text), label: L('Contact THH support', 'THH सपोर्ट से बात करें'), external: true };
  if (c.phone) return { href: `tel:${String(c.phone).replace(/\s/g, '')}`, label: L('Call THH support', 'THH सपोर्ट को कॉल करें'), number: c.phone };
  return null;
}

export async function driverCards(rides) {
  const ids = [...new Set(rides.map((r) => r.driver_id).filter(Boolean))];
  const pids = [...new Set(rides.map((r) => r.partner_id).filter(Boolean))];
  const [d, p] = await Promise.all([
    ids.length ? q(sb.rpc('cab_driver_cards', { p_ids: ids })).catch(() => []) : [],
    pids.length ? q(sb.rpc('partner_cards', { p_ids: pids })).catch(() => []) : [],
  ]);
  const byId = {};
  (d || []).forEach((x) => { byId[x.user_id] = x; });
  (p || []).forEach((x) => { byId[x.id] = { full_name: x.business_name, photo_url: '', is_verified: true, trips: 0 }; });
  return (r) => byId[r.driver_id || r.partner_id] || { full_name: L('Driver', 'ड्राइवर'), photo_url: '', is_verified: false, trips: 0 };
}

const driverBadge = (c) => c.is_verified
  ? h('span', { class: 'badge-verified' }, '✓ ', L('Verified driver', 'वेरिफ़ाइड ड्राइवर'))
  : h('span', { class: 'badge-new' }, L('New driver', 'नए ड्राइवर'));

// ---------- 1. Entry: Customer or Driver ----------
export async function entry() {
  const choice = (href, ic, title, sub, points) => h('a', { class: 'choice-card', href },
    h('span', { class: 'choice-ico' }, icon(ic, 30)),
    h('span', { class: 'choice-text' }, h('strong', {}, title), h('span', { class: 'muted' }, sub),
      h('ul', {}, points.map((p) => h('li', {}, p)))),
    h('span', { class: 'arrow-c' }, icon('arrow', 14)));
  return h('div', { class: 'cab-entry' },
    h('section', { class: 'cab-entry-hero' },
      h('img', { src: 'img/home/q-cab.jpg', alt: '' }),
      h('div', { class: 'wrap' },
        h('p', { class: 'eyebrow' }, L('Instant Book Cab', 'इंस्टेंट बुक कैब')),
        h('h1', {}, L('Share a ride in the hills', 'पहाड़ों में राइड शेयर करें')),
        h('p', {}, L('Drivers publish journeys they are already making. Travellers book a seat and share the cost.',
          'ड्राइवर वो यात्राएँ डालते हैं जो वे पहले से कर रहे हैं। यात्री सीट बुक करके ख़र्च बाँटते हैं।')))),
    h('div', { class: 'wrap choice-grid' },
      choice(user() ? '#/cab/me' : '#/login?next=cab/me', 'user', L('I am a traveller', 'मैं यात्री हूँ'), L('Find a ride', 'राइड खोजें'),
        [L('Search available journeys', 'उपलब्ध यात्राएँ खोजें'), L('Choose your seat', 'अपनी सीट चुनें'), L('Request to join a ride', 'राइड में जुड़ने की रिक्वेस्ट भेजें')]),
      choice(user() ? '#/drive' : '#/login?next=drive', 'car', L('I am a driver', 'मैं ड्राइवर हूँ'), L('Publish a ride', 'राइड पब्लिश करें'),
        [L('Add a journey you already plan', 'पहले से तय यात्रा जोड़ें'), L('Accept or decline requests', 'रिक्वेस्ट मंज़ूर या मना करें'), L('Manage your journeys', 'अपनी यात्राएँ सँभालें')])),
    h('div', { class: 'wrap cab-entry-note' },
      h('a', { class: 'link-more', href: '#/cab/find' }, L('Just looking? Search rides without signing in', 'सिर्फ़ देखना है? बिना लॉगिन राइड खोजें'), icon('arrow', 14))));
}

// ---------- Search form (used on dashboard and results) ----------
export function searchForm({ from = null, to = null, date = todayISO(), n = 1, onSearch } = {}) {
  const fromI = placeInput({ id: 'cab-from', label: L('From', 'कहाँ से'), placeholder: L('Pickup town or village', 'पिकअप शहर या गाँव'), value: from });
  const toI = placeInput({ id: 'cab-to', label: L('To', 'कहाँ तक'), placeholder: L('Destination', 'मंज़िल'), value: to });
  const dateI = h('input', { class: 'input', type: 'date', id: 'cab-date', min: todayISO(), value: date, required: true });
  let count = Math.max(1, Number(n) || 1);
  const countEl = h('output', { class: 'stepper-n', id: 'cab-n', 'aria-live': 'polite' }, String(count));
  const step = (d) => { count = Math.min(10, Math.max(1, count + d)); countEl.textContent = String(count); };
  const err = h('p', { class: 'form-err', role: 'alert' });
  const form = h('form', { class: 'cab-search-card', novalidate: true, onsubmit: (e) => {
    e.preventDefault();
    clear(err);
    const okFrom = fromI.validate(); const okTo = toI.validate();
    if (!okFrom || !okTo) { err.textContent = L('Please choose both places from the list.', 'दोनों जगह सूची से चुनें।'); return; }
    if (fromI.get().id === toI.get().id) { err.textContent = L('Start and destination cannot be the same.', 'शुरुआत और मंज़िल एक नहीं हो सकतीं।'); return; }
    if (!dateI.value || dateI.value < todayISO()) { err.textContent = L('Choose today or a future date.', 'आज या आगे की तारीख़ चुनें।'); dateI.focus(); return; }
    const qs = new URLSearchParams({ from: fromI.get().id, to: toI.get().id, date: dateI.value, n: String(count) });
    if (onSearch) onSearch(qs); else location.hash = `#/cab/find?${qs}`;
  } },
    h('div', { class: 'cab-tabs', role: 'tablist' }, h('span', { class: 'cab-tab on', role: 'tab', 'aria-selected': 'true' }, icon('car', 17), L('Shared cab', 'शेयर कैब'))),
    fromI.el,
    h('button', { type: 'button', class: 'swap-btn', 'aria-label': L('Swap from and to', 'कहाँ से / कहाँ तक बदलें'), onclick: () => { const a = fromI.get(); const b = toI.get(); fromI.set(b); toI.set(a); } }, '⇅'),
    toI.el,
    h('div', { class: 'row2' },
      h('label', { class: 'field', for: 'cab-date' }, h('span', { class: 'field-label' }, L('Journey date', 'यात्रा की तारीख़')), dateI),
      h('div', { class: 'field' }, h('span', { class: 'field-label', id: 'cab-n-label' }, L('Travellers', 'यात्री')),
        h('div', { class: 'stepper', role: 'group', 'aria-labelledby': 'cab-n-label' },
          h('button', { type: 'button', 'aria-label': L('Fewer travellers', 'कम यात्री'), onclick: () => step(-1) }, '−'), countEl,
          h('button', { type: 'button', 'aria-label': L('More travellers', 'ज़्यादा यात्री'), onclick: () => step(1) }, '+')))),
    err,
    h('button', { class: 'btn btn-block btn-lg', type: 'submit' }, L('Search rides', 'राइड खोजें'), icon('arrow', 16)));
  return form;
}

// ---------- 2. Results ----------
export async function find({ query }) {
  const places = await allPlaces();
  const from = places.find((p) => p.id === query.from) || places.find((p) => query.from_loc && p.location_id === query.from_loc) || null;
  const to = places.find((p) => p.id === query.to) || places.find((p) => query.to_loc && p.location_id === query.to_loc) || null;
  const date = query.date && query.date >= todayISO() ? query.date : todayISO();
  const n = Math.max(1, Number(query.n) || 1);
  const page = h('div', { class: 'app-page' });

  if (!from || !to) {
    page.append(h('div', { class: 'app-head' }, back('#/cab'), h('h1', {}, L('Find a ride', 'राइड खोजें'))), searchForm({ from, to, date, n }));
    return page;
  }

  const editBox = h('div', { class: 'collapse', hidden: true }, searchForm({ from, to, date, n }));
  page.append(
    h('div', { class: 'app-head' }, back('#/cab'),
      h('div', { class: 'grow' }, h('h1', {}, L('Available cabs', 'उपलब्ध कैब')),
        h('p', { class: 'muted' }, `${placeName(from)} → ${placeName(to)} · ${dateOf(`${date}T12:00:00+05:30`)} · ${n} ${L(n > 1 ? 'travellers' : 'traveller', 'यात्री')}`)),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': L('Change search', 'खोज बदलें'), onclick: () => { editBox.hidden = !editBox.hidden; } }, icon('search', 20))),
    editBox);

  const [startIso, endIso] = istDayRange(date);
  const rides = await q(sb.from('cab_rides').select('*').in('status', ['open', 'full'])
    .gte('departure_at', startIso).lt('departure_at', endIso).gt('departure_at', new Date().toISOString()).order('departure_at').limit(200));
  const matches = rides.filter((r) => {
    const path = ridePath(r, places);
    const a = path.indexOf(from.id); const b = path.indexOf(to.id);
    return a >= 0 && b > a;
  });
  const card = await driverCards(matches);
  const list = h('div', { class: 'ride-cards' });
  if (!matches.length) {
    const shift = (d) => { const x = new Date(`${date}T12:00:00+05:30`); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10); };
    const link = (d) => `#/cab/find?${new URLSearchParams({ from: from.id, to: to.id, date: d, n: String(n) })}`;
    list.append(h('div', { class: 'empty-state' },
      h('span', { class: 'empty-ico' }, icon('car', 34)),
      h('h2', {}, L('No rides on this route yet', 'इस रूट पर अभी कोई राइड नहीं')),
      h('p', { class: 'muted' }, L('Drivers add new journeys every day. Try another date, or check back later.', 'ड्राइवर रोज़ नई यात्राएँ जोड़ते हैं। दूसरी तारीख़ देखें या बाद में फिर देखें।')),
      h('div', { class: 'row-actions' },
        shift(-1) >= todayISO() ? h('a', { class: 'btn btn-ghost btn-sm', href: link(shift(-1)) }, L('Previous day', 'पिछला दिन')) : null,
        h('a', { class: 'btn btn-ghost btn-sm', href: link(shift(1)) }, L('Next day', 'अगला दिन'))),
      h('p', { class: 'small muted' }, L('Driving this route? ', 'इस रूट पर जा रहे हैं? '), h('a', { href: user() ? '#/drive/publish' : '#/login?next=drive/publish' }, L('Publish your ride', 'अपनी राइड डालें')))));
  }
  const pills = {};
  matches.forEach((r) => { const el = rideCard(r, card(r), n, places); pills[r.id] = el; list.append(el); });
  watchRides(matches.map((r) => r.id), (row) => {
    const el = pills[row.id]; if (!el) return;
    const left = row.seats_total - row.seats_booked;
    const pill = el.querySelector('.seat-pill');
    pill.textContent = seatsLeftText(left); pill.classList.toggle('low', left <= 2); pill.classList.add('flash');
    setTimeout(() => pill.classList.remove('flash'), 1200);
    const enough = left >= n && row.status === 'open';
    el.classList.toggle('is-off', !enough);
    const cta = el.querySelector('.rc-foot .btn');
    if (cta && !enough) cta.replaceWith(h('span', { class: 'muted small' }, L('Not enough seats', 'सीटें कम हैं')));
  });
  page.append(list);
  return page;
}

function rideCard(r, d, n, places) {
  const left = r.seats_total - r.seats_booked;
  const enough = left >= n && r.status === 'open';
  const v = VEHICLES[r.vehicle_type];
  return h('article', { class: `ride-card${enough ? '' : ' is-off'}` },
    h('div', { class: 'rc-top' },
      avatar(d.photo_url, d.full_name),
      h('div', { class: 'grow' },
        h('strong', { class: 'rc-name' }, d.full_name),
        h('div', { class: 'rc-sub' }, driverBadge(d), d.trips ? h('span', { class: 'muted' }, ` · ${d.trips} ${L('trips', 'ट्रिप')}`) : null)),
      h('span', { class: `seat-pill${left <= 2 ? ' low' : ''}`, 'aria-live': 'polite' }, seatsLeftText(left))),
    h('div', { class: 'rc-route' },
      h('div', { class: 'tl' },
        h('div', { class: 'tl-row' }, h('span', { class: 'tl-dot' }), h('strong', {}, timeOf(r.departure_at)), h('span', {}, endName(r, 'from'))),
        (r.stops || []).length ? h('div', { class: 'tl-row tl-via' }, h('span', { class: 'tl-dot small' }), h('span', { class: 'muted' }, L('via ', 'होकर ') + r.stops.map((s) => placeName(placeById(s.place_id)) || s.name).join(', '))) : null,
        h('div', { class: 'tl-row' }, h('span', { class: 'tl-dot end' }), h('span', {}, endName(r, 'to'))))),
    h('div', { class: 'rc-meta' }, icon('car', 16), h('span', {}, r.vehicle_model), v ? h('span', { class: 'muted' }, `· ${v.label}`) : null),
    h('div', { class: 'rc-foot' },
      h('div', {}, h('span', { class: 'price' }, inr(r.price_per_seat)), h('span', { class: 'muted small' }, ` / ${L('seat', 'सीट')}`),
        n > 1 ? h('div', { class: 'small muted' }, `${inr(r.price_per_seat * n)} ${L('for', 'कुल')} ${n}`) : null),
      enough ? h('a', { class: 'btn', href: `#/cab/ride/${r.id}?n=${n}` }, L('Book now', 'बुक करें'))
        : h('span', { class: 'muted small' }, L('Not enough seats', 'सीटें कम हैं'))));
}

// ---------- 3–7. Ride details → seats → confirm ----------
export async function ride({ params, query }) {
  const places = await allPlaces();
  const r = await q(sb.from('cab_rides').select('*').eq('id', params.id).maybeSingle());
  if (!r) return h('div', { class: 'app-page' }, h('div', { class: 'app-head' }, back('#/cab/find'), h('h1', {}, L('Ride not found', 'राइड नहीं मिली'))), empty());
  const [cards, rel] = await Promise.all([driverCards([r]), reliability(r.driver_id)]);
  const d = cards(r);
  const path = ridePath(r, places);
  const n = Math.max(1, Number(query.n) || 1);
  const seatsLive = h('span', { 'aria-live': 'polite' }, seatsLeftText(r.seats_total - r.seats_booked));
  watchRides([r.id], (row) => {
    Object.assign(r, row);
    seatsLive.textContent = seatsLeftText(r.seats_total - r.seats_booked);
    seatsLive.parentElement?.classList.add('flash'); setTimeout(() => seatsLive.parentElement?.classList.remove('flash'), 1200);
    if (st.step === 'seats') loadTaken().then(paint);
  });
  const saved = (() => { try { return JSON.parse(sessionStorage.getItem(`hh_seats_${r.id}`) || 'null'); } catch { return null; } })();
  const st = { step: query.step === 'confirm' && saved?.length ? 'confirm' : (query.step === 'seats' ? 'seats' : 'details'), seats: saved || [], taken: [] };
  const root = h('div', { class: 'app-page ride-page' });
  const isOwn = user() && r.driver_id === user().id;
  const closed = r.status !== 'open' || new Date(r.departure_at) <= new Date();

  async function loadTaken() { st.taken = await q(sb.rpc('cab_ride_taken_seats', { p_ride: r.id })).catch(() => []); st.seats = st.seats.filter((s) => !st.taken.includes(s)); }
  await loadTaken();

  const paint = () => {
    clear(root);
    if (st.step === 'details') root.append(details());
    if (st.step === 'seats') root.append(seatsStep());
    if (st.step === 'confirm') root.append(confirmStep());
    window.scrollTo({ top: 0 });
  };

  const v = VEHICLES[r.vehicle_type];
  const timeline = () => h('div', { class: 'tl tl-lg' },
    h('div', { class: 'tl-row' }, h('span', { class: 'tl-dot' }), h('strong', {}, endName(r, 'from')), h('span', { class: 'tl-time' }, timeOf(r.departure_at))),
    r.pickup_point ? h('div', { class: 'tl-note' }, L('Pickup: ', 'पिकअप: ') + r.pickup_point) : null,
    ...(r.stops || []).map((s) => h('div', { class: 'tl-row tl-via' }, h('span', { class: 'tl-dot small' }), h('span', {}, placeName(placeById(s.place_id)) || s.name))),
    h('div', { class: 'tl-row' }, h('span', { class: 'tl-dot end' }), h('strong', {}, endName(r, 'to'))),
    r.drop_point ? h('div', { class: 'tl-note' }, L('Drop: ', 'ड्रॉप: ') + r.drop_point) : null);

  function details() {
    return h('div', {},
      h('div', { class: 'ride-hero' }, h('img', { src: 'img/home/hero.jpg', alt: '' }), back(`#/cab/find`)),
      h('div', { class: 'ride-sheet' },
        h('div', { class: 'driver-head' }, avatar(d.photo_url, d.full_name, 'av av-lg'),
          h('div', {}, h('h1', {}, d.full_name), driverBadge(d))),
        trustPanel(rel),
        h('div', { class: 'feature-row' },
          h('div', {}, icon('car', 22), h('span', {}, r.vehicle_model, regionOf(r) ? h('small', { class: 'muted' }, ` · ${L('Registered', 'रजिस्टर्ड')} ${regionOf(r)}`) : null)),
          h('div', { class: 'seats-live' }, icon('people', 22), seatsLive),
          h('div', {}, icon('shield', 22), h('span', {}, r.auto_confirm ? L('Instant book', 'तुरंत बुकिंग') : L('Driver confirms', 'ड्राइवर मंज़ूर करेगा'))),
          v ? h('div', {}, icon('mountain', 22), h('span', {}, v.label)) : null),
        d.about ? h('section', {}, h('h2', {}, L('About driver', 'ड्राइवर के बारे में')), h('p', {}, d.about)) : null,
        h('section', {}, h('h2', {}, L('Route & timing', 'रूट और समय')), h('p', { class: 'muted small' }, dateOf(r.departure_at),
          r.distance_km ? ` · ${Math.round(r.distance_km)} km` : '', r.duration_min ? ` · ${L('about', 'लगभग')} ${Math.floor(r.duration_min / 60)} h ${r.duration_min % 60} min ${L('driving (estimate)', 'ड्राइविंग (अनुमान)')}` : ''), timeline()),
        r.ride_ref ? h('p', { class: 'small muted' }, L('Ride ID ', 'राइड आईडी '), h('span', { class: 'mono' }, r.ride_ref)) : null,
        r.notes ? h('section', {}, h('h2', {}, L('Notes from the driver', 'ड्राइवर की बात')), h('p', {}, r.notes)) : null,
        h('div', { class: 'sticky-cta' },
          h('div', {}, h('span', { class: 'price' }, inr(r.price_per_seat * n)), h('div', { class: 'small muted' }, `${inr(r.price_per_seat)} × ${n} ${L('seat(s)', 'सीट')}`)),
          isOwn ? h('a', { class: 'btn', href: `#/drive/trip/${r.id}` }, L('This is your ride', 'यह आपकी राइड है'))
            : closed ? h('span', { class: 'muted' }, L('This ride is closed', 'यह राइड बंद है'))
            : h('button', { class: 'btn', type: 'button', onclick: () => { st.step = 'seats'; paint(); } }, L('Select seats', 'सीट चुनें')))));
  }

  function seatsStep() {
    const max = n;
    const total = h('strong', { class: 'price' });
    const chosenEl = h('span', {});
    const cont = h('button', { class: 'btn', type: 'button' }, L('Continue', 'आगे बढ़ें'), icon('arrow', 16));
    const upd = () => {
      chosenEl.textContent = st.seats.length ? st.seats.sort((a, b) => a - b).join(', ') : '—';
      total.textContent = inr(r.price_per_seat * Math.max(st.seats.length, 0));
      cont.disabled = st.seats.length !== max;
    };
    const seatBtn = (no) => {
      const taken = st.taken.includes(no);
      const b = h('button', { type: 'button', class: `seat${taken ? ' taken' : ''}${st.seats.includes(no) ? ' sel' : ''}`, disabled: taken,
        'aria-pressed': String(st.seats.includes(no)), 'aria-label': `${L('Seat', 'सीट')} ${no}${taken ? ' ' + L('booked', 'बुक') : ''}` },
        taken ? '✕' : String(no));
      b.addEventListener('click', () => {
        if (st.seats.includes(no)) st.seats = st.seats.filter((s) => s !== no);
        else if (st.seats.length < max) st.seats.push(no);
        else { st.seats.shift(); st.seats.push(no); }
        b.parentElement.closest('.car').querySelectorAll('.seat').forEach((x) => x.classList.toggle('sel', st.seats.includes(Number(x.textContent))));
        b.parentElement.closest('.car').querySelectorAll('.seat').forEach((x) => x.setAttribute('aria-pressed', String(st.seats.includes(Number(x.textContent)))));
        upd();
      });
      return b;
    };
    // Layout: front passenger seat next to the driver, then rows of 2–3.
    const seats = Array.from({ length: r.seats_total }, (_, i) => i + 1);
    const rows = [[seats[0]]];
    const rest = seats.slice(1);
    const per = r.seats_total >= 7 ? 3 : 2;
    for (let i = 0; i < rest.length; i += per) rows.push(rest.slice(i, i + per));
    const car = h('div', { class: 'car' },
      h('div', { class: 'car-row' }, h('span', { class: 'seat driver', 'aria-hidden': 'true' }, '◎'), seatBtn(rows[0][0])),
      ...rows.slice(1).map((row) => h('div', { class: 'car-row' }, row.map(seatBtn))));
    cont.addEventListener('click', () => {
      try { sessionStorage.setItem(`hh_seats_${r.id}`, JSON.stringify(st.seats)); } catch { /* ignore */ }
      if (!user()) { location.hash = `#/login?next=${encodeURIComponent(`cab/ride/${r.id}?n=${n}&step=confirm`)}`; return; }
      st.step = 'confirm'; paint();
    });
    const node = h('div', {},
      h('div', { class: 'app-head' }, h('button', { class: 'app-back', type: 'button', 'aria-label': L('Back', 'पीछे'), onclick: () => { st.step = 'details'; paint(); } }, '←'),
        h('div', { class: 'grow' }, h('h1', {}, L('Select seats', 'सीट चुनें')), h('p', { class: 'muted' }, `${r.vehicle_model} · ${L('choose', 'चुनें')} ${max}`))),
      h('div', { class: 'legend' }, h('span', { class: 'lg lg-free' }, L('Available', 'खाली')), h('span', { class: 'lg lg-sel' }, L('Selected', 'चुनी हुई')), h('span', { class: 'lg lg-taken' }, L('Booked', 'बुक'))),
      car,
      h('div', { class: 'sticky-cta' },
        h('div', {}, h('div', { class: 'small muted' }, L('Selected seats: ', 'चुनी सीटें: '), chosenEl), h('div', {}, h('span', { class: 'small muted' }, L('Total fare ', 'कुल किराया ')), total)),
        cont));
    upd();
    return node;
  }

  function confirmStep() {
    const p = state.profile || {};
    const nameI = h('input', { class: 'input', id: 'bk-name', required: true, minlength: 2, value: p.full_name || '', autocomplete: 'name' });
    const phoneI = h('input', { class: 'input', id: 'bk-phone', type: 'tel', required: true, inputmode: 'tel', value: p.phone || '', autocomplete: 'tel', placeholder: '98xxxxxxxx' });
    const noteI = h('textarea', { class: 'input', id: 'bk-note', rows: 2, maxlength: 300, placeholder: L('Luggage, pickup landmark… (optional)', 'सामान, पिकअप की जगह… (वैकल्पिक)') });
    const err = h('p', { class: 'form-err', role: 'alert' });
    const btn = h('button', { class: 'btn btn-block btn-lg', type: 'submit' }, r.auto_confirm ? L('Confirm booking', 'बुकिंग कन्फ़र्म करें') : L('Send ride request', 'राइड रिक्वेस्ट भेजें'));
    const form = h('form', { class: 'stack', novalidate: true, onsubmit: async (e) => {
      e.preventDefault(); clear(err);
      if (nameI.value.trim().length < 2) { err.textContent = L('Please enter your name.', 'अपना नाम लिखें।'); nameI.focus(); return; }
      if (phoneI.value.replace(/\D/g, '').length < 10) { err.textContent = L('Please enter a 10-digit mobile number.', '10 अंकों का मोबाइल नंबर लिखें।'); phoneI.focus(); return; }
      await busy(btn, async () => {
        const b = await q(sb.rpc('request_cab_ride', { p_ride: r.id, p_seat_numbers: st.seats, p_name: nameI.value.trim(), p_phone: phoneI.value.trim(), p_note: noteI.value.trim(), p_from_place: null, p_to_place: null }))
          .catch(async (ex) => { err.textContent = ex.message; await loadTaken(); throw ex; });
        try { sessionStorage.removeItem(`hh_seats_${r.id}`); } catch { /* ignore */ }
        if (!p.phone) sb.from('profiles').update({ phone: phoneI.value.trim() }).eq('id', user().id).then(() => loadProfile());
        location.hash = `#/cab/booking/${b.id}?new=1`;
        return;
      });
    } },
      h('div', { class: 'confirm-card' },
        h('div', { class: 'driver-head' }, avatar(d.photo_url, d.full_name), h('div', {}, h('strong', {}, d.full_name), h('div', { class: 'small muted' }, r.vehicle_model))),
        timeline(),
        h('div', { class: 'confirm-meta' }, h('span', {}, '🗓 ', dateOf(r.departure_at)), h('span', {}, L('Seats ', 'सीट ') + st.seats.join(', ')))),
      h('div', { class: 'fare' },
        h('h2', {}, L('Fare details', 'किराए का हिसाब')),
        h('div', { class: 'fare-row' }, h('span', {}, `${inr(r.price_per_seat)} × ${st.seats.length}`), h('span', {}, inr(r.price_per_seat * st.seats.length))),
        h('div', { class: 'fare-row total' }, h('span', {}, L('Total amount', 'कुल रकम')), h('strong', {}, inr(r.price_per_seat * st.seats.length))),
        h('p', { class: 'small muted' }, L('No online payment. You pay the driver directly for your share of the trip.', 'कोई ऑनलाइन पेमेंट नहीं। अपने हिस्से का किराया सीधे ड्राइवर को दें।'))),
      h('label', { class: 'field', for: 'bk-name' }, h('span', { class: 'field-label' }, L('Your name', 'आपका नाम')), nameI),
      h('label', { class: 'field', for: 'bk-phone' }, h('span', { class: 'field-label' }, L('Mobile number', 'मोबाइल नंबर')), phoneI),
      h('label', { class: 'field', for: 'bk-note' }, h('span', { class: 'field-label' }, L('Message to driver', 'ड्राइवर के लिए संदेश')), noteI),
      err, btn,
      !r.auto_confirm ? h('p', { class: 'small muted center' }, L('The driver has 15 minutes to accept. Your seats are held until then; if there is no answer, they are released automatically.', 'ड्राइवर के पास मंज़ूर करने के लिए 15 मिनट हैं। तब तक सीटें आपके लिए रुकी रहेंगी; जवाब न आए तो अपने आप छूट जाएँगी।')) : null);
    return h('div', {},
      h('div', { class: 'app-head' }, h('button', { class: 'app-back', type: 'button', 'aria-label': L('Back', 'पीछे'), onclick: () => { st.step = 'seats'; paint(); } }, '←'),
        h('h1', {}, L('Confirm your booking', 'बुकिंग कन्फ़र्म करें'))),
      form);
  }

  if (st.step === 'confirm' && !user()) st.step = 'seats';
  paint();
  return root;
}

// ---------- 8. Booking page (+ confirmation popup right after booking) ----------
export async function booking({ params, query }) {
  if (!user()) { location.hash = `#/login?next=${encodeURIComponent(`cab/booking/${params.id}`)}`; return h('div'); }
  await allPlaces();
  const b = await q(sb.from('cab_bookings').select('*, cab_rides(*)').eq('id', params.id).maybeSingle());
  if (!b) return h('div', { class: 'app-page' }, h('div', { class: 'app-head' }, back('#/cab/bookings'), h('h1', {}, L('Booking not found', 'बुकिंग नहीं मिली'))));
  const r = b.cab_rides;
  const [cards, contact, support] = await Promise.all([
    driverCards([r]),
    b.status === 'confirmed' || b.status === 'completed' ? q(sb.rpc('cab_booking_contact', { p_booking: b.id })).catch(() => null) : null,
    supportLink(`${L('Booking', 'बुकिंग')} ${refOf(b)}`),
  ]);
  const d = cards(r);
  const canCancel = ['pending', 'confirmed'].includes(b.status) && new Date(r.departure_at) > new Date() && r.status !== 'started';
  const when = `${dateOf(r.departure_at)} · ${timeOf(r.departure_at)}`;
  const seatsTxt = `${b.seats} (${L('seat no.', 'सीट नं.')} ${(b.seat_numbers || []).join(', ') || '—'})`;
  const statusTxt = { pending: L('Waiting for the driver (15 min)', 'ड्राइवर के जवाब का इंतज़ार (15 मिनट)'), confirmed: L('Confirmed', 'कन्फ़र्म') }[b.status] || b.status;

  if (query.new === '1') {
    history.replaceState(null, '', `#/cab/booking/${b.id}`);
    const pending = b.status === 'pending';
    setTimeout(() => {
      const dlg = celebrate({
        wait: pending,
        title: pending ? L('Request sent!', 'रिक्वेस्ट भेज दी!') : L('Your ride is booked!', 'आपकी राइड बुक हो गई!'),
        message: pending
          ? L('Your seats are held for 15 minutes while the driver answers. We will tell you here as soon as they reply.', 'ड्राइवर के जवाब तक आपकी सीटें 15 मिनट रुकी हैं। जवाब आते ही हम आपको यहीं बताएँगे।')
          : L('Your journey with The Himalayan Horizon is one step closer. Sit back and get ready to explore.', 'द हिमालयन होराइज़न के साथ आपकी यात्रा बस एक कदम दूर है। तैयार हो जाइए घूमने के लिए।'),
        rows: [[L('Booking ID', 'बुकिंग आईडी'), refOf(b)], [L('Driver', 'ड्राइवर'), d.full_name], [L('Vehicle', 'गाड़ी'), r.vehicle_model],
          [L('Pickup', 'पिकअप'), r.pickup_point || endName(r, 'from')], [L('Destination', 'मंज़िल'), r.drop_point || endName(r, 'to')],
          [L('Date & time', 'तारीख़ और समय'), when], [L('Seats', 'सीटें'), seatsTxt], [L('Status', 'स्थिति'), statusTxt]],
        actions: [
          h('button', { class: 'btn btn-block', type: 'button', onclick: () => dlg.close() }, L('Open booking details', 'बुकिंग की पूरी जानकारी')),
          h('p', { class: 'cele-wa small muted' }, icon('bell', 15), L('Updates come to your THH notifications. WhatsApp updates will be added soon.', 'अपडेट आपकी THH सूचनाओं में आएँगे। WhatsApp अपडेट जल्द जोड़े जाएँगे।')),
          support ? h('a', { class: 'btn btn-ghost btn-block', href: support.href, target: support.external ? '_blank' : null, rel: 'noopener' }, support.label) : null,
        ],
      });
    }, 60);
  }

  const notes = {
    pending: b.hold_expires_at ? h('div', { class: 'soft-note warn' }, holdTimer(b.hold_expires_at, L('Driver has', 'ड्राइवर के पास')), h('span', { class: 'small' }, ' ', L('to answer. Your seats are held until then.', 'जवाब देने के लिए। तब तक आपकी सीटें रुकी हैं।')))
      : h('p', { class: 'soft-note' }, L('Waiting for the driver to answer.', 'ड्राइवर के जवाब का इंतज़ार।')),
    expired: h('div', { class: 'soft-note warn' }, L('This request expired because the driver did not answer in time. Your seats were released.', 'ड्राइवर ने समय पर जवाब नहीं दिया, इसलिए यह रिक्वेस्ट ख़त्म हो गई। आपकी सीटें छोड़ दी गईं।'),
      h('div', {}, h('a', { class: 'btn btn-sm', href: '#/cab/find' }, L('Find another ride', 'दूसरी राइड खोजें')))),
    declined: h('div', { class: 'soft-note warn' }, L('The driver could not take this request. Please choose another ride.', 'ड्राइवर यह रिक्वेस्ट नहीं ले सके। कृपया दूसरी राइड चुनें।'), h('div', {}, h('a', { class: 'btn btn-sm', href: '#/cab/find' }, L('Find another ride', 'दूसरी राइड खोजें')))),
    started: h('p', { class: 'soft-note ok' }, L('Your ride is on the way. Have a safe journey!', 'आपकी राइड रास्ते में है। शुभ यात्रा!')),
  };

  return h('div', { class: 'app-page' },
    h('div', { class: 'app-head' }, back('#/cab/bookings'), h('h1', {}, L('Booking details', 'बुकिंग की जानकारी'))),
    h('div', { class: 'code-box' },
      h('span', { class: 'small muted' }, L('Booking ID', 'बुकिंग आईडी')), h('strong', { class: 'mono' }, refOf(b)), statusPill(r.status === 'started' && b.status === 'confirmed' ? 'started' : b.status, r.departure_at),
      r.ride_ref ? h('span', { class: 'small muted code-sub' }, L('Ride ID ', 'राइड आईडी '), h('span', { class: 'mono' }, r.ride_ref)) : null),
    r.status === 'started' && b.status === 'confirmed' ? notes.started : notes[b.status] || null,
    h('div', { class: 'confirm-card' },
      h('div', { class: 'tl' },
        h('div', { class: 'tl-row' }, h('span', { class: 'tl-dot' }), h('strong', {}, endName(r, 'from'))),
        r.pickup_point ? h('div', { class: 'tl-note' }, L('Pickup: ', 'पिकअप: ') + r.pickup_point) : null,
        h('div', { class: 'tl-row' }, h('span', { class: 'tl-dot end' }), h('strong', {}, endName(r, 'to'))),
        r.drop_point ? h('div', { class: 'tl-note' }, L('Drop: ', 'ड्रॉप: ') + r.drop_point) : null),
      h('p', { class: 'small muted' }, when),
      h('div', { class: 'driver-head' }, avatar(d.photo_url, d.full_name),
        h('div', {}, h('strong', {}, d.full_name), h('div', { class: 'small muted' }, [contact?.vehicle || r.vehicle_model, contact?.registration].filter(Boolean).join(' · ')),
          h('div', { class: 'small' }, `${L('Seats', 'सीट')} ${(b.seat_numbers || []).join(', ') || b.seats} · ${inr(r.price_per_seat * b.seats)}`))),
      contact?.phone ? h('div', { class: 'row-actions' },
        h('a', { class: 'btn btn-sm', href: `tel:${contact.phone}` }, L('Call driver', 'ड्राइवर को कॉल करें')),
        h('span', { class: 'small muted selectable' }, contact.phone)) : null,
      b.status === 'pending' ? h('p', { class: 'small muted' }, L('Driver phone and car number appear here after the driver confirms.', 'ड्राइवर के कन्फ़र्म करने के बाद फ़ोन और गाड़ी का नंबर यहाँ दिखेगा।')) : null),
    h('div', { class: 'stack' },
      h('a', { class: 'btn btn-block', href: '#/cab/bookings' }, L('My bookings', 'मेरी बुकिंग')),
      support ? h('a', { class: 'btn btn-ghost btn-block', href: support.href, target: support.external ? '_blank' : null, rel: 'noopener' }, support.label) : null,
      canCancel ? h('button', { class: 'btn btn-danger-ghost btn-block', type: 'button', onclick: () => confirmCancel(b) }, L('Cancel booking', 'बुकिंग रद्द करें')) : null));
}

function confirmCancel(b) {
  const yes = h('button', { class: 'btn btn-danger', type: 'button' }, L('Yes, cancel', 'हाँ, रद्द करें'));
  const dlg = modal(L('Cancel this booking?', 'यह बुकिंग रद्द करें?'), h('div', { class: 'stack' },
    h('p', {}, L('Your seats will be released for other travellers.', 'आपकी सीटें दूसरे यात्रियों के लिए खुल जाएँगी।')),
    h('div', { class: 'row-actions' }, h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => dlg.close() }, L('Keep booking', 'बुकिंग रखें')), yes)));
  yes.addEventListener('click', () => busy(yes, async () => {
    await q(sb.rpc('cancel_cab_booking', { p_booking: b.id }));
    dlg.close(); toast(L('Booking cancelled', 'बुकिंग रद्द हो गई'));
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  }));
}

// ---------- 9. My bookings ----------
export async function bookings({ query }) {
  if (!user()) { location.hash = '#/login?next=cab/bookings'; return h('div'); }
  await allPlaces();
  const rows = await q(sb.from('cab_bookings').select('*, cab_rides(*)').eq('user_id', user().id).order('created_at', { ascending: false }));
  const now = new Date();
  const future = (b) => new Date(b.cab_rides?.departure_at) > now;
  const groups = {
    upcoming: rows.filter((b) => b.status === 'confirmed' && (future(b) || b.cab_rides?.status === 'started')),
    requests: rows.filter((b) => b.status === 'pending' && future(b)),
    completed: rows.filter((b) => b.status === 'completed' || (b.status === 'confirmed' && !future(b) && b.cab_rides?.status !== 'started')),
    cancelled: rows.filter((b) => ['cancelled', 'declined', 'expired'].includes(b.status)),
  };
  const tab = groups[query.tab] ? query.tab : (groups.upcoming.length || !groups.requests.length ? 'upcoming' : 'requests');
  const label = { upcoming: L('Upcoming', 'आने वाली'), requests: L('Requests', 'रिक्वेस्ट'), completed: L('Completed', 'पूरी'), cancelled: L('Cancelled', 'रद्द') };
  const cards = await driverCards(rows.map((b) => b.cab_rides).filter(Boolean));
  return h('div', { class: 'app-page' },
    h('div', { class: 'app-head' }, back('#/cab/me'), h('h1', {}, L('My bookings', 'मेरी बुकिंग'))),
    h('nav', { class: 'seg-tabs' }, Object.keys(groups).map((k) => h('a', { href: `#/cab/bookings?tab=${k}`, class: k === tab ? 'on' : '' }, `${label[k]} (${groups[k].length})`))),
    groups[tab].length ? h('div', { class: 'stack' }, groups[tab].map((b) => bookingCard(b, cards(b.cab_rides))))
      : h('div', { class: 'empty-state' }, h('span', { class: 'empty-ico' }, icon('car', 30)), h('p', { class: 'muted' }, L('Nothing here yet.', 'अभी यहाँ कुछ नहीं।')),
        h('a', { class: 'btn btn-sm', href: '#/cab/find' }, L('Find a ride', 'राइड खोजें'))));
}

export function bookingCard(b, d) {
  const r = b.cab_rides;
  const canCancel = ['pending', 'confirmed'].includes(b.status) && new Date(r.departure_at) > new Date() && r.status !== 'started';
  return h('article', { class: 'bk-card' },
    h('div', { class: 'bk-top' }, h('strong', { class: 'mono' }, refOf(b)), statusPill(r.status === 'started' && b.status === 'confirmed' ? 'started' : b.status, r.departure_at)),
    h('div', { class: 'bk-route' }, routeLabel(r)),
    h('div', { class: 'small muted' }, `${dateOf(r.departure_at)} · ${timeOf(r.departure_at)}`),
    h('div', { class: 'driver-head' }, avatar(d.photo_url, d.full_name), h('div', {}, h('strong', {}, d.full_name), h('div', { class: 'small muted' }, r.vehicle_model))),
    h('div', { class: 'small' }, `${L('Seats', 'सीट')}: ${(b.seat_numbers || []).join(', ') || b.seats} · ${b.seats} ${L('passenger(s)', 'यात्री')}`),
    b.status === 'pending' && b.hold_expires_at && new Date(r.departure_at) > new Date() ? holdTimer(b.hold_expires_at, L('Driver has', 'ड्राइवर के पास')) : null,
    h('div', { class: 'row-actions' },
      h('a', { class: 'btn btn-ghost btn-sm', href: `#/cab/booking/${b.id}` }, L('View details', 'पूरी जानकारी')),
      canCancel ? h('button', { class: 'btn btn-danger-ghost btn-sm', type: 'button', onclick: () => confirmCancel(b) }, L('Cancel', 'रद्द करें')) : null));
}

// ---------- Customer dashboard ----------
export async function me() {
  if (!user()) { location.hash = '#/login?next=cab/me'; return h('div'); }
  await allPlaces();
  const p = state.profile || {};
  const name = p.full_name || user().email;
  const photo = p.avatar_url || user().user_metadata?.avatar_url || user().user_metadata?.picture || '';
  const rows = await q(sb.from('cab_bookings').select('*, cab_rides(*)').eq('user_id', user().id).order('created_at', { ascending: false }).limit(50));
  const now = new Date();
  const upcoming = rows.filter((b) => b.status === 'confirmed' && new Date(b.cab_rides?.departure_at) > now)
    .sort((a, b) => new Date(a.cab_rides.departure_at) - new Date(b.cab_rides.departure_at));
  const requests = rows.filter((b) => b.status === 'pending' && new Date(b.cab_rides?.departure_at) > now);
  const cards = await driverCards(rows.map((b) => b.cab_rides).filter(Boolean));
  const hasDriver = await q(sb.from('driver_profiles').select('user_id').eq('user_id', user().id).maybeSingle()).catch(() => null);

  return h('div', { class: 'app-page dash' },
    h('div', { class: 'welcome' }, avatar(photo, name, 'av av-lg'),
      h('div', { class: 'grow' }, h('p', { class: 'muted small' }, L('Welcome back', 'फिर से स्वागत है')), h('h1', {}, name)),
      h('a', { class: 'mode-switch', href: hasDriver ? '#/drive' : '#/drive' }, icon('car', 16), L('Driver mode', 'ड्राइवर मोड'))),
    h('section', {}, h('h2', {}, L('Search your ride', 'अपनी राइड खोजें')), searchForm()),
    h('section', {}, h('div', { class: 'sec-head' }, h('h2', {}, L('Upcoming journeys', 'आने वाली यात्राएँ')), h('a', { class: 'link-more', href: '#/cab/bookings' }, L('All bookings', 'सभी बुकिंग'))),
      upcoming.length ? h('div', { class: 'stack' }, upcoming.slice(0, 3).map((b) => bookingCard(b, cards(b.cab_rides))))
        : h('p', { class: 'soft-note' }, L('No confirmed journeys yet.', 'अभी कोई कन्फ़र्म यात्रा नहीं।'))),
    h('section', {}, h('h2', {}, L('My ride requests', 'मेरी राइड रिक्वेस्ट')),
      requests.length ? h('div', { class: 'stack' }, requests.map((b) => bookingCard(b, cards(b.cab_rides))))
        : h('p', { class: 'soft-note' }, L('No requests waiting for a driver.', 'कोई रिक्वेस्ट ड्राइवर के जवाब का इंतज़ार नहीं कर रही।'))),
    h('section', {}, h('h2', {}, L('Notifications', 'सूचनाएँ')), lazy(() => notifications(5))),
    h('section', {}, h('h2', {}, L('Profile and settings', 'प्रोफ़ाइल और सेटिंग')), profileBox()));
}

export async function notifications(limit = 5) {
  const rows = await q(sb.from('notifications').select('*').eq('user_id', user().id).order('created_at', { ascending: false }).limit(limit));
  if (!rows.length) return h('p', { class: 'soft-note' }, L('No notifications yet.', 'अभी कोई सूचना नहीं।'));
  const unread = rows.filter((r) => !r.read_at).map((r) => r.id);
  if (unread.length) sb.from('notifications').update({ read_at: new Date().toISOString() }).in('id', unread).then(() => {});
  return h('ul', { class: 'note-list' }, rows.map((n) => h('li', { class: n.read_at ? '' : 'unread' },
    h('a', { href: n.link || '#/cab/me' }, h('strong', {}, n.title), h('span', { class: 'small muted' }, n.body)))));
}

export function profileBox() {
  const p = state.profile || {};
  const nameI = h('input', { class: 'input', id: 'pf-name', value: p.full_name || '', minlength: 2, autocomplete: 'name' });
  const phoneI = h('input', { class: 'input', id: 'pf-phone', type: 'tel', value: p.phone || '', autocomplete: 'tel' });
  const save = h('button', { class: 'btn btn-sm', type: 'submit' }, L('Save', 'सेव करें'));
  return h('form', { class: 'panel stack', onsubmit: (e) => { e.preventDefault(); busy(save, async () => {
    await q(sb.from('profiles').update({ full_name: nameI.value.trim(), phone: phoneI.value.trim() || null }).eq('id', user().id));
    await loadProfile(); toast(L('Saved', 'सेव हो गया'));
  }); } },
    h('p', { class: 'small muted' }, user().email),
    h('label', { class: 'field', for: 'pf-name' }, h('span', { class: 'field-label' }, L('Name', 'नाम')), nameI),
    h('label', { class: 'field', for: 'pf-phone' }, h('span', { class: 'field-label' }, L('Mobile number', 'मोबाइल नंबर')), phoneI),
    h('div', { class: 'row-actions' }, save,
      h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: async () => { await sb.auth.signOut(); state.session = null; await loadProfile(); location.hash = '#/cab'; } }, L('Log out', 'लॉग आउट'))));
}

export const appLoading = () => h('div', { class: 'app-page' }, loading());
