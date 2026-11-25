// Instant Book Cab — customer side: entry choice, search, results, ride details,
// seat choice, confirmation, booking page, my bookings and the customer dashboard.
// Rides are real journeys published by drivers (cost sharing, pay the driver directly).
import { h, clear, toast, modal, busy, inr, todayISO, empty, loading, icon, lazy, whatsappLink } from '../ui.js';
import { getLang } from '../i18n.js';
import { sb, q } from '../sb.js';
import { state, user, loadProfile, settings } from '../store.js';
import { allPlaces, placeInput, placeName, placeById, placesCached } from '../places.js';
import { vehicleVisual, catalog, rideVehicleVariants } from '../cab/vehicles.js';
import { illustrativeSeatRows, seatLayoutFor } from '../cab/seat-layouts.js';

// Places in links: listed places by id (?from=…), any other village by position (?fromg=lat,lng|name).
const placeKey = (p) => p?.id || (p ? `${(+p.lat).toFixed(4)},${(+p.lng).toFixed(4)}` : '');
function putPlace(qs, k, p) { if (p.id) qs.set(k, p.id); else qs.set(`${k}g`, `${(+p.lat).toFixed(5)},${(+p.lng).toFixed(5)}|${placeName(p) || p.name}`); }
function readPlace(query, k, places) {
  const byId = places.find((p) => p.id === query[k]) || places.find((p) => query[`${k}_loc`] && p.location_id === query[`${k}_loc`]);
  if (byId) return byId;
  const g = String(query[`${k}g`] || ''); const m = g.match(/^(-?[\d.]+),(-?[\d.]+)\|(.{1,200})$/);
  return m ? { id: null, ext: true, name: m[3], lat: +m[1], lng: +m[2], district: null } : null;
}

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
const travellerCount = (value) => Math.min(10, Math.max(1, Math.trunc(Number(value) || 1)));
const searchDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value)) && Number.isFinite(Date.parse(value)) && value >= todayISO() ? value : todayISO();

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
  const id = r[`${which}_place_id`];
  const location = r[`${which}_location_id`];
  const savedPlace = id ? placeById(id) : location ? placesCached().find((p) => p.location_id === location) : null;
  return placeName(savedPlace) || r[`${which}_geo`]?.name || (which === 'from' ? r.pickup_point : r.drop_point) || '?';
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
  const stop = () => { try { sb.removeChannel(ch); } catch { /* ignore */ } window.removeEventListener('cabviewleave', stop); };
  window.addEventListener('cabviewleave', stop);
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
export function celebrate({ title, message, rows = [], actions = [], wait = false, cabBooking = false }) {
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
  if (cabBooking) dlg.el.classList.add('cab-booking-success');
  dlg.el.setAttribute('aria-label', title);
  // Leaving the page (back button, bottom menu, a link in the popup) closes the popup too.
  const onNav = () => { window.removeEventListener('cabviewleave', onNav); if (dlg.el.isConnected) dlg.close(); };
  window.addEventListener('cabviewleave', onNav);
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

// ---------- Search form (used on dashboard and results) ----------
export function searchForm({ from = null, to = null, date = todayISO(), n = 1, onSearch } = {}) {
  const fromI = placeInput({ id: 'cab-from', external: true, label: L('From', 'कहाँ से'), placeholder: L('Pickup location', 'पिकअप की जगह'), value: from });
  const toI = placeInput({ id: 'cab-to', external: true, label: L('To', 'कहाँ तक'), placeholder: L('Drop-off location', 'मंज़िल'), value: to });
  const dateI = h('input', { class: 'input', type: 'date', id: 'cab-date', min: todayISO(), value: date, required: true });
  let count = travellerCount(n);
  const countEl = h('output', { class: 'stepper-n', id: 'cab-n', 'aria-live': 'polite' }, String(count));
  const step = (d) => { count = Math.min(10, Math.max(1, count + d)); countEl.textContent = String(count); };
  const err = h('p', { class: 'form-err', role: 'alert' });
  const form = h('form', { class: 'cab-search-card', novalidate: true, onsubmit: (e) => {
    e.preventDefault();
    clear(err);
    const okFrom = fromI.validate(); const okTo = toI.validate();
    if (!okFrom || !okTo) { err.textContent = L('Please choose both places from the suggestions.', 'दोनों जगह सुझावों में से चुनें।'); return; }
    if (placeKey(fromI.get()) === placeKey(toI.get())) { err.textContent = L('Start and destination cannot be the same.', 'शुरुआत और मंज़िल एक नहीं हो सकतीं।'); return; }
    if (!dateI.value || dateI.value < todayISO()) { err.textContent = L('Choose today or a future date.', 'आज या आगे की तारीख़ चुनें।'); dateI.focus(); return; }
    const qs = new URLSearchParams({ date: dateI.value, n: String(count) });
    putPlace(qs, 'from', fromI.get()); putPlace(qs, 'to', toI.get());
    if (onSearch) onSearch(qs); else location.href = `/cab/find?${qs}`;
  } },
    h('div', { class: 'cab-search-route' }, fromI.el,
      h('button', { type: 'button', class: 'swap-btn', 'aria-label': L('Swap from and to', 'कहाँ से / कहाँ तक बदलें'), onclick: () => { const a = fromI.get(); const b = toI.get(); fromI.set(b); toI.set(a); } }, '⇅'),
      toI.el),
    h('div', { class: 'row2' },
      h('label', { class: 'field', for: 'cab-date' }, h('span', { class: 'field-label' }, L('Journey date', 'यात्रा की तारीख़')), dateI),
      h('div', { class: 'field' }, h('span', { class: 'field-label', id: 'cab-n-label' }, L('Travellers', 'यात्री')),
        h('div', { class: 'stepper', role: 'group', 'aria-labelledby': 'cab-n-label' },
          h('button', { type: 'button', 'aria-label': L('Fewer travellers', 'कम यात्री'), onclick: () => step(-1) }, '−'), countEl,
          h('button', { type: 'button', 'aria-label': L('More travellers', 'ज़्यादा यात्री'), onclick: () => step(1) }, '+')))),
    err,
    h('button', { class: 'btn btn-block btn-lg', type: 'submit' }, L('Search cabs', 'कैब खोजें'), icon('arrow', 16)));
  return form;
}

export function search() {
  return searchForm();
}

async function discoveryRatings(rides) {
  if (!rides.length) return {};
  const rows = await q(sb.rpc('cab_discovery_driver_ratings', { p_ride_ids: rides.map((ride) => ride.id) })).catch(() => []);
  return Object.fromEntries((rows || []).map((row) => [row.driver_id, row]));
}

// ---------- 2. Results ----------
export async function find({ query }) {
  const places = await allPlaces();
  const from = readPlace(query, 'from', places);
  const to = readPlace(query, 'to', places);
  const date = searchDate(query.date);
  const n = travellerCount(query.n);
  const page = h('div', { class: 'app-page cab-discovery cab-discovery-results' });

  if (!from || !to) {
    page.append(h('div', { class: 'app-head' }, back('/cab'), h('h1', {}, L('Find a ride', 'राइड खोजें'))), searchForm({ from, to, date, n }));
    return page;
  }

  const searchHref = (day = date) => {
    const qs = new URLSearchParams({ date: day, n: String(n) });
    putPlace(qs, 'from', from); putPlace(qs, 'to', to);
    return `/cab/find?${qs}`;
  };
  const editBox = h('div', { class: 'collapse', id: 'cab-edit-search', hidden: true }, searchForm({ from, to, date, n }));
  const editButton = h('button', { class: 'icon-btn', type: 'button', 'aria-label': L('Edit search', 'खोज बदलें'),
    'aria-expanded': 'false', 'aria-controls': 'cab-edit-search', onclick: () => {
      editBox.hidden = !editBox.hidden;
      editButton.setAttribute('aria-expanded', String(!editBox.hidden));
      if (!editBox.hidden) editBox.querySelector('input:not([hidden])')?.focus();
    } }, icon('settings', 20));
  page.append(
    h('div', { class: 'app-head cab-results-head' }, back('/cab'),
      h('div', { class: 'grow' }, h('h1', {}, L('Available cabs', 'उपलब्ध कैब')),
        h('strong', { class: 'cab-results-route' }, `${placeName(from) || from.name} → ${placeName(to) || to.name}`),
        h('p', { class: 'muted' }, `${dateOf(`${date}T12:00:00+05:30`)} · ${n} ${L(n > 1 ? 'travellers' : 'traveller', 'यात्री')}`)),
      editButton),
    editBox);

  const [startIso, endIso] = istDayRange(date);
  // 1) Road-route matching in the database: pickup and drop within the corridor (50 km) of the route, in the right direction.
  const [rides, matchedRoutes] = await Promise.all([
    q(sb.from('cab_rides').select('*').in('status', ['open', 'full'])
      .gte('departure_at', startIso).lt('departure_at', endIso).gt('departure_at', new Date().toISOString()).order('departure_at').limit(200)),
    from.lat != null && to.lat != null ? q(sb.rpc('match_cab_rides', { p_pick_lat: +from.lat, p_pick_lng: +from.lng, p_drop_lat: +to.lat, p_drop_lng: +to.lng, p_date: date, p_seats: n })).catch(() => []) : [],
  ]);
  const meta = Object.fromEntries((matchedRoutes || []).map((route, rank) => [route.ride_id, { ...route, rank }]));
  // 2) Rides that list both places on their way (older rides and full rides still shown).
  const onPath = (r) => { const path = ridePath(r, places); const a = from.id ? path.indexOf(from.id) : -1; const b = to.id ? path.indexOf(to.id) : -1; return a >= 0 && b > a; };
  const matches = rides.filter((r) => meta[r.id] || onPath(r))
    .sort((a, b) => (meta[a.id]?.rank ?? 999) - (meta[b.id]?.rank ?? 999) || new Date(a.departure_at) - new Date(b.departure_at));
  const list = h('div', { class: 'ride-cards cab-discovery-card-grid' });
  if (!matches.length) {
    const shift = (d) => { const x = new Date(`${date}T12:00:00+05:30`); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10); };
    list.append(h('div', { class: 'empty-state' },
      h('span', { class: 'empty-ico' }, icon('car', 34)),
      h('h2', {}, L('No rides on this route yet', 'इस रूट पर अभी कोई राइड नहीं')),
      h('p', { class: 'muted' }, L('Drivers add new journeys every day. Try another date, or check back later.', 'ड्राइवर रोज़ नई यात्राएँ जोड़ते हैं। दूसरी तारीख़ देखें या बाद में फिर देखें।')),
      h('div', { class: 'row-actions' },
        shift(-1) >= todayISO() ? h('a', { class: 'btn btn-ghost btn-sm', href: searchHref(shift(-1)) }, L('Previous day', 'पिछला दिन')) : null,
        h('a', { class: 'btn btn-ghost btn-sm', href: searchHref(shift(1)) }, L('Next day', 'अगला दिन'))),
      h('p', { class: 'small muted' }, L('Driving this route? ', 'इस रूट पर जा रहे हैं? '), h('a', { href: user() ? '/drive/publish' : '/login?next=/drive/publish' }, L('Publish your ride', 'अपनी राइड डालें')))));
  } else {
    const [card, variants, ratings] = await Promise.all([driverCards(matches), rideVehicleVariants(matches), discoveryRatings(matches), catalog()]);
    const cards = new Map();
    matches.forEach((ride) => {
      const view = rideCard(ride, card(ride), { n, match: meta[ride.id], pickup: from, variantId: variants[ride.id],
        rating: ratings[ride.driver_id], returnTo: searchHref() });
      cards.set(ride.id, view); list.append(view.el);
    });
    for (let offset = 0; offset < matches.length; offset += 100) {
      watchRides(matches.slice(offset, offset + 100).map((ride) => ride.id), (row) => cards.get(row.id)?.update(row));
    }
  }
  page.append(list);
  return page;
}

function discoveryMap(ride) {
  const coords = Array.isArray(ride.route_line) ? ride.route_line : [];
  if (coords.length < 2 || coords.some((point) => !Array.isArray(point) || point.length !== 2 || !point.every(Number.isFinite))) return null;
  const point = ([lat, lng], which) => ({ lat, lng, name: endName(ride, which) });
  const container = h('div', { class: 'cab-detail-map' });
  const button = h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: async () => {
    button.disabled = true;
    try {
      const { routeMap } = await import('../map');
      const map = routeMap({ start: point(coords[0], 'from'), dests: [point(coords.at(-1), 'to')],
        roundTrip: false, route: { legs: [{ coords, alts: [] }] } }, { height: '240px' });
      clear(container).append(map.el);
    } catch {
      button.disabled = false;
      notice.textContent = L('Map could not load. Try again.', 'मैप लोड नहीं हुआ। फिर कोशिश करें।');
    }
  } }, icon('map', 17), L('Show route map', 'रूट का मैप देखें'));
  const notice = h('p', { class: 'small muted', role: 'status' });
  container.append(button, notice);
  return container;
}

function rideCard(ride, driver, { n, match, pickup, variantId, rating, returnTo }) {
  const seatCount = h('span', { class: 'seat-pill', 'aria-live': 'polite' });
  const availability = h('p', { class: 'cab-card-availability muted small', 'aria-live': 'polite' });
  const params = new URLSearchParams({ n: String(n), back: returnTo });
  if (match && pickup && match.pickup_km > 2) params.set('pn', (placeName(pickup) || pickup.name).slice(0, 80));

  const seatParams = new URLSearchParams(params);
  seatParams.set('step', 'seats');
  const selectSeats = h('a', { class: 'btn', href: `/cab/ride/${ride.id}?${seatParams}` }, L('Select seats', 'सीट चुनें'));
  const article = h('article', { class: 'ride-card cab-trip-card' },
    h('div', { class: 'rc-top' }, avatar(driver.photo_url, driver.full_name),
      h('div', { class: 'grow' }, h('strong', { class: 'rc-name' }, driver.full_name),
        h('div', { class: 'rc-sub' }, driver.is_verified ? driverBadge(driver) : null,
          rating?.reviews > 0 ? h('span', { class: 'cab-driver-rating' }, icon('star', 14), Number(rating.avg_rating).toFixed(1)) : null,
          rating?.completed_rides > 0 ? h('span', { class: 'muted' }, `${rating.completed_rides} ${L('completed trips', 'पूरी राइड')}`) : null)),
      seatCount),
    h('div', { class: 'cab-trip-body' },
      h('div', {}, h('h2', {}, ride.vehicle_model || L('Shared cab', 'शेयर्ड कैब')),
        h('div', { class: 'cab-trip-meta' }, icon('route', 16), routeLabel(ride)),
        h('div', { class: 'cab-trip-meta' }, icon('clock', 16), timeOf(ride.departure_at)),
        h('p', { class: 'cab-trip-mode' }, ride.auto_confirm ? L('Instant Book', 'तुरंत बुकिंग') : L('Request to book', 'बुकिंग रिक्वेस्ट')),
        match && match.pickup_km > 2
          ? h('p', { class: 'rc-near small' }, `${L('Pickup about', 'पिकअप लगभग')} ${Math.round(match.pickup_km)} km ${L('from the route', 'रूट से')}`) : null,
        match && match.drop_km > 2
          ? h('p', { class: 'rc-near small' }, `${L('Drop about', 'ड्रॉप लगभग')} ${Math.round(match.drop_km)} km ${L('from the route', 'रूट से')}`) : null,
        availability),
      vehicleVisual(ride.vehicle_model, { size: 'card', gallery: false, variantId, vehicleId: ride.vehicle_id })),
    h('div', { class: 'rc-foot' },
      h('div', {}, h('strong', { class: 'price' }, inr(ride.price_per_seat)),
        h('span', { class: 'muted small' }, ` / ${L('seat', 'सीट')}`),
        n > 1 ? h('p', { class: 'small muted' }, `${inr(ride.price_per_seat * n)} ${L('for', 'कुल')} ${n}`) : null),
      h('div', { class: 'row-actions' },
        h('a', { class: 'btn btn-ghost', href: `/cab/ride/${ride.id}?${params}` }, L('View ride', 'राइड देखें')),
        selectSeats)));

  function update(row) {
    const left = Math.max(0, row.seats_total - row.seats_booked);
    const open = row.status === 'open' || row.status === 'full';
    selectSeats.hidden = row.status !== 'open' || left < n || Boolean(user()?.id && row.driver_id === user().id);
    selectSeats.style.display = selectSeats.hidden ? 'none' : '';
    seatCount.textContent = open ? seatsLeftText(left) : L('Ride closed', 'राइड बंद');
    seatCount.classList.toggle('low', !open || left <= 2);
    availability.textContent = open && left < n ? L('Fewer seats than requested', 'यात्रियों से कम सीटें उपलब्ध हैं') : '';
  }
  update(ride);
  return { el: article, update };
}

// ---------- 3–7. Ride details → seats → confirm ----------
export async function ride({ params, query }) {
  const [r] = await Promise.all([q(sb.from('cab_rides').select('*').eq('id', params.id).maybeSingle()), allPlaces()]);
  if (!r) return h('div', { class: 'app-page' }, h('div', { class: 'app-head' }, back('/cab/find'), h('h1', {}, L('Ride not found', 'राइड नहीं मिली'))), empty());
  const [cards, rel, variants, catalogue] = await Promise.all([driverCards([r]), reliability(r.driver_id), rideVehicleVariants([r]), catalog()]);
  const d = cards(r);
  const n = travellerCount(query.n);
  const returnTo = typeof query.back === 'string' && query.back.startsWith('/cab/find?') ? query.back : '/cab/find';
  const selectionKey = `hh_seats_${r.id}`;
  const attemptKey = `hh_cab_attempt_${r.id}`;
  const readSession = (key) => {
    try { return JSON.parse(sessionStorage.getItem(key) || 'null'); } catch { return null; }
  };
  const writeSession = (key, value) => {
    try { if (value) sessionStorage.setItem(key, JSON.stringify(value)); else sessionStorage.removeItem(key); } catch { /* optional storage */ }
  };
  const sortedSeats = (seats) => [...seats].sort((a, b) => a - b);
  const saved = readSession(selectionKey);
  const savedSeats = Array.isArray(saved) ? [...new Set(saved)].filter((seat) => Number.isInteger(seat) && seat > 0 && seat <= r.seats_total).slice(0, n) : [];
  const savedAttempt = readSession(attemptKey);
  const attempt = savedAttempt?.user === user()?.id && savedAttempt?.seats === sortedSeats(savedSeats).join(',') ? savedAttempt : null;
  const st = {
    step: (query.step === 'confirm' || attempt) && savedSeats.length === n ? 'confirm' : query.step === 'confirm' || query.step === 'seats' ? 'seats' : 'details',
    seats: savedSeats, taken: [], ready: false, notice: '', attempt, submitting: false,
  };
  const root = h('div', { class: 'app-page ride-page' });
  const isOwn = user() && r.driver_id === user().id;
  const seatsLive = h('span', { 'aria-live': 'polite' }, seatsLeftText(Math.max(0, r.seats_total - r.seats_booked)));
  const isOpen = () => (r.status === 'open' || r.status === 'full') && new Date(r.departure_at) > new Date();
  const canSelect = () => !isOwn && r.status === 'open' && isOpen() && r.seats_total - r.seats_booked >= n;
  let updateDetailsAction;
  let updateSeatStep;
  let availabilityVersion = 0;
  const lostSeat = L('A selected seat is no longer available. Choose another seat.', 'चुनी हुई एक सीट अब उपलब्ध नहीं है। दूसरी सीट चुनें।');
  const availabilityError = L('Live availability could not load. Try again.', 'लाइव सीटें लोड नहीं हुईं। फिर कोशिश करें।');

  function setStep(step) {
    st.step = step;
    clear(root).append(step === 'details' ? details() : step === 'seats' ? seatsStep() : confirmStep());
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  async function loadTaken() {
    const version = ++availabilityVersion;
    try {
      const taken = await q(sb.rpc('cab_ride_taken_seats', { p_ride: r.id }));
      if (version !== availabilityVersion) return;
      st.taken = taken || [];
      st.ready = true;
      if (st.notice === availabilityError) st.notice = '';
      if (!st.attempt && !st.submitting && st.seats.some((seat) => st.taken.includes(seat) || seat > r.seats_total)) {
        st.seats = st.seats.filter((seat) => !st.taken.includes(seat) && seat <= r.seats_total);
        st.notice = lostSeat;
        if (st.step === 'confirm' && root.isConnected) { setStep('seats'); return; }
      }
    } catch {
      if (version !== availabilityVersion) return;
      st.ready = false;
      st.notice = availabilityError;
    }
    if (st.step === 'seats') updateSeatStep?.();
  }

  watchRides([r.id], (row) => {
    const capacityChanged = row.seats_total !== r.seats_total;
    Object.assign(r, row);
    seatsLive.textContent = seatsLeftText(Math.max(0, r.seats_total - r.seats_booked));
    updateDetailsAction?.();
    if (capacityChanged && st.step === 'seats') setStep('seats');
    if (st.step !== 'details') void loadTaken();
  });

  const timeline = () => h('div', { class: 'tl tl-lg' },
    h('div', { class: 'tl-row' }, h('span', { class: 'tl-dot' }), h('strong', {}, endName(r, 'from')), h('span', { class: 'tl-time' }, timeOf(r.departure_at))),
    r.pickup_point ? h('div', { class: 'tl-note' }, L('Pickup: ', 'पिकअप: ') + r.pickup_point) : null,
    ...(r.stops || []).map((s) => h('div', { class: 'tl-row tl-via' }, h('span', { class: 'tl-dot small' }), h('span', {}, placeName(placeById(s.place_id)) || s.name))),
    h('div', { class: 'tl-row' }, h('span', { class: 'tl-dot end' }), h('strong', {}, endName(r, 'to')),
      r.duration_min > 0 ? h('span', { class: 'tl-time' }, `~ ${timeOf(new Date(r.departure_at).getTime() + r.duration_min * 60000)}`) : null),
    r.drop_point ? h('div', { class: 'tl-note' }, L('Drop: ', 'ड्रॉप: ') + r.drop_point) : null);

  function details() {
    const select = h('button', { class: 'btn', type: 'button', onclick: () => { if (canSelect()) { setStep('seats'); void loadTaken(); } } });
    updateDetailsAction = () => {
      select.disabled = !canSelect();
      select.textContent = canSelect() ? L('Select seats', 'सीट चुनें')
        : r.status === 'full' || r.status === 'open' && new Date(r.departure_at) > new Date()
          ? L('Not enough seats', 'सीटें कम हैं') : L('Ride closed', 'राइड बंद');
    };
    updateDetailsAction();
    return h('div', { class: 'cab-discovery cab-trip-detail' },
      h('div', { class: 'cab-discovery-hero cab-detail-hero' },
        h('img', { src: '/img/cab/road-hero-640.webp', srcset: '/img/cab/road-hero-640.webp 640w, /img/cab/road-hero-1200.webp 1200w',
          sizes: '(max-width: 640px) 100vw, 900px', width: 1200, height: 800, alt: '' }),
        back(returnTo)),
      h('div', { class: 'ride-sheet cab-detail-sheet' },
        h('section', { class: 'cab-detail-driver' },
          h('div', { class: 'driver-head' }, avatar(d.photo_url, d.full_name, 'av av-lg'),
            h('div', {}, h('h1', {}, d.full_name), d.is_verified ? driverBadge(d) : null)),
          trustPanel(rel),
          d.about ? h('section', { class: 'cab-detail-about' }, h('h2', {}, L('About driver', 'ड्राइवर के बारे में')), h('p', {}, d.about)) : null),
        h('section', { class: 'cab-detail-vehicle' },
          h('h2', {}, r.vehicle_model || L('Shared cab', 'शेयर्ड कैब')),
          vehicleVisual(r.vehicle_model, { variantId: variants[r.id], vehicleId: r.vehicle_id }),
          h('div', { class: 'cab-detail-meta' },
            h('span', { class: 'seats-live' }, icon('people', 18), seatsLive),
            h('span', {}, icon('shield', 18), r.auto_confirm ? L('Instant Book', 'तुरंत बुकिंग') : L('Driver confirmation', 'ड्राइवर की मंज़ूरी')),
            regionOf(r) ? h('span', {}, icon('car', 18), `${L('Registered', 'रजिस्टर्ड')} ${regionOf(r)}`) : null)),
        h('section', { class: 'cab-detail-route' }, h('h2', {}, L('Route & timing', 'रूट और समय')),
          h('p', { class: 'muted small' }, dateOf(r.departure_at),
            r.distance_km ? ` · ${Math.round(r.distance_km)} km` : '',
            r.duration_min ? ` · ${L('Estimated arrival', 'पहुँचने का अनुमान')}` : ''),
          timeline(), discoveryMap(r),
          r.ride_ref ? h('p', { class: 'small muted' }, L('Ride ID ', 'राइड आईडी '), h('span', { class: 'mono' }, r.ride_ref)) : null,
          r.notes ? h('div', { class: 'cab-detail-about' }, h('h3', {}, L('Notes from the driver', 'ड्राइवर की बात')), h('p', {}, r.notes)) : null),
        h('div', { class: 'sticky-cta cab-detail-action' },
          h('div', {}, h('strong', { class: 'price' }, inr(r.price_per_seat * n)),
            h('div', { class: 'small muted' }, `${inr(r.price_per_seat)} × ${n} ${L('seat(s)', 'सीट')}`)),
          isOwn ? h('a', { class: 'btn', href: `/drive/trip/${r.id}` }, L('This is your ride', 'यह आपकी राइड है')) : select)));
  }

  function seatsStep() {
    const layout = seatLayoutFor(catalogue, variants[r.id], r.seats_total);
    const buttons = new Map();
    const total = h('strong', { class: 'price' });
    const chosen = h('span', {});
    const notice = h('p', { class: 'cab-seat-notice', role: 'status' });
    const retry = h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => void loadTaken() }, L('Retry', 'फिर कोशिश करें'));
    const cont = h('button', { class: 'btn', type: 'button', onclick: () => {
      if (!st.ready || st.seats.length !== n || !canSelect()) return;
      writeSession(selectionKey, st.seats);
      if (!user()) {
        const next = new URLSearchParams({ n: String(n), step: 'confirm', back: returnTo });
        if (query.pn) next.set('pn', String(query.pn).slice(0, 80));
        location.href = `/login?next=${encodeURIComponent(`/cab/ride/${r.id}?${next}`)}`;
        return;
      }
      setStep('confirm');
    } }, L('Continue', 'आगे बढ़ें'), icon('arrow', 16));

    function seatButton(no) {
      const button = h('button', { type: 'button', class: 'cab-seat', onclick: () => {
        if (st.seats.includes(no)) st.seats = st.seats.filter((seat) => seat !== no);
        else if (st.seats.length < n) st.seats.push(no);
        else {
          st.notice = L(`Deselect a seat to choose another. You need ${n}.`, `दूसरी सीट चुनने से पहले एक सीट हटाएँ। आपको ${n} सीटें चाहिए।`);
          updateSeatStep();
          return;
        }
        st.notice = '';
        updateSeatStep();
      } }, String(no));
      buttons.set(no, button);
      return button;
    }
    // The illustration depicts a right-hand-drive cabin with one passenger in
    // front, three in the middle, and two in the rear. Other layouts use their
    // documented grid or numbered seat labels instead of misplacing a marker.
    const passengerRows = layout?.rows.map((row) => row.filter(Number.isInteger));
    const hasCabinImage = passengerRows?.length === 3
      && passengerRows[0].length === 1 && passengerRows[1].length === 3 && passengerRows[2].length === 2
      && layout.rows[0].indexOf('driver') > layout.rows[0].indexOf(passengerRows[0][0]);
    const markerRows = [
      { x: [33], y: 42 },
      { x: [31, 50, 69], y: 60 },
      { x: [33, 66], y: 79 },
    ];
    let cabin;
    if (hasCabinImage) {
      cabin = h('div', { class: 'cab-seat-photo', role: 'group', 'aria-label': L('Vehicle seat map', 'गाड़ी का सीट मैप') },
        h('img', { src: '/img/cab/seat-cabin-132.webp', alt: '', width: 499, height: 1000, decoding: 'async',
          onerror: (event) => event.currentTarget.parentElement.classList.add('cab-seat-photo-missing') }),
        passengerRows.flatMap((row, rowIndex) => row.map((seat, columnIndex) => {
          const marker = seatButton(seat);
          marker.style.setProperty('--seat-x', `${markerRows[rowIndex].x[columnIndex]}%`);
          marker.style.setProperty('--seat-y', `${markerRows[rowIndex].y}%`);
          return marker;
        })));
    } else {
      const rows = layout?.rows || illustrativeSeatRows(r.seats_total);
      const columns = rows[0]?.length || 3;
      const wide = columns > 3;
      cabin = h('div', { class: `cab-seat-cabin cab-seat-schematic${wide ? ' cab-seat-schematic-wide' : ''}`,
        style: { '--cabin-columns': String(columns), '--cabin-tracks': !layout && wide
          ? 'repeat(2, minmax(44px, 1fr)) 8px repeat(2, minmax(44px, 1fr))'
          : `repeat(${columns}, minmax(44px, 1fr))` },
        role: 'group', 'aria-label': layout ? L('Vehicle seat map', 'गाड़ी का सीट मैप') : L('Illustrative numbered seats', 'सीट नंबर का उदाहरण') },
        rows.map((row) => h('div', { class: 'cab-seat-row' }, row.map((seat) => {
          if (seat === 'driver') return h('span', { class: 'cab-seat-driver' }, L('Driver', 'ड्राइवर'));
          if (seat === null) return h('span', { 'aria-hidden': 'true' });
          return seatButton(seat);
        }))));
    }

    updateSeatStep = () => {
      for (const [seat, button] of buttons) {
        const taken = st.taken.includes(seat);
        const selected = st.seats.includes(seat);
        button.disabled = !!isOwn || taken || !st.ready || !isOpen() || seat > r.seats_total;
        button.dataset.state = taken ? 'booked' : selected ? 'selected' : 'available';
        button.setAttribute('aria-pressed', String(selected));
        button.setAttribute('aria-label', `${L('Seat', 'सीट')} ${seat}${taken ? ' ' + L('booked', 'बुक') : ''}`);
      }
      chosen.textContent = sortedSeats(st.seats).join(', ') || '—';
      total.textContent = inr(r.price_per_seat * st.seats.length);
      cont.disabled = !st.ready || !canSelect() || st.seats.length !== n;
      retry.hidden = st.notice !== availabilityError;
      notice.textContent = st.notice || (!st.ready ? L('Checking live availability…', 'लाइव सीटें देख रहे हैं…')
        : !canSelect() ? L('There are not enough available seats for this booking.', 'इस बुकिंग के लिए पर्याप्त सीटें उपलब्ध नहीं हैं।') : '');
    };
    updateSeatStep();

    return h('div', { class: 'cab-discovery cab-booking-flow cab-seat-screen' },
      h('div', { class: 'app-head' },
        h('button', { class: 'app-back', type: 'button', 'aria-label': L('Back', 'पीछे'), onclick: () => setStep('details') }, '←'),
        h('div', { class: 'grow' }, h('h1', {}, L('Select seats', 'सीट चुनें')),
          h('p', { class: 'muted' }, r.vehicle_model, ' · ', L(`Choose ${n}`, `${n} चुनें`)))),
      h('div', { class: 'cab-seat-panel' },
        h('div', { class: 'cab-seat-trip' }, h('strong', {}, routeLabel(r)),
          h('span', { class: 'seats-live' }, icon('people', 15), seatsLive)),
        h('div', { class: 'cab-seat-legend' },
          ['available', 'selected', 'booked'].map((status, i) => h('span', { 'data-state': status },
            [L('Available', 'खाली'), L('Selected', 'चुनी हुई'), L('Booked or held', 'बुक या होल्ड')][i]))),
        h('div', { class: 'cab-seat-front' }, layout ? L('Front of vehicle', 'गाड़ी का अगला हिस्सा')
          : L('Illustrative layout', 'सीट लेआउट का उदाहरण')),
        cabin,
        hasCabinImage ? h('p', { class: 'small muted' }, L('Cabin illustration', 'गाड़ी के अंदर का चित्र')) : null,
        layout ? h('a', { class: 'small cab-seat-source', href: layout.source, target: '_blank', rel: 'noopener noreferrer' }, L('Manufacturer seating layout', 'निर्माता का सीट लेआउट'))
          : h('p', { class: 'small muted' }, L('Seat numbers are for booking. Confirm physical positions with the driver.', 'सीट नंबर बुकिंग के लिए हैं। गाड़ी में सीट की जगह ड्राइवर से पूछें।')),
        notice, retry),
      h('div', { class: 'sticky-cta cab-seat-action' },
        h('div', { class: 'cab-seat-summary' }, h('div', { class: 'small muted', 'aria-live': 'polite' },
          L('Selected seats: ', 'चुनी सीटें: '), h('strong', {}, chosen)),
          h('div', { class: 'small muted' }, L('Total fare', 'कुल किराया')), total), cont));
  }

  function confirmStep() {
    const p = state.profile || {};
    const nameI = h('input', { class: 'input', id: 'bk-name', required: true, minlength: 2, value: p.full_name || '', autocomplete: 'name' });
    const phoneI = h('input', { class: 'input', id: 'bk-phone', type: 'tel', required: true, inputmode: 'tel', value: p.phone || '', autocomplete: 'tel', placeholder: '98xxxxxxxx' });
    const noteI = h('textarea', { class: 'input', id: 'bk-note', rows: 2, maxlength: 300, placeholder: L('Luggage, pickup landmark… (optional)', 'सामान, पिकअप की जगह… (वैकल्पिक)') });
    if (query.pn) noteI.value = `${L('Please pick me up near', 'कृपया मुझे यहाँ के पास से लें:')} ${String(query.pn).slice(0, 80)}`;
    const err = h('p', { class: 'form-err', role: 'alert' });
    const actionLabel = r.auto_confirm ? L('Confirm booking', 'बुकिंग कन्फ़र्म करें') : L('Send ride request', 'राइड रिक्वेस्ट भेजें');
    const backButton = h('button', { class: 'app-back', type: 'button', 'aria-label': L('Back', 'पीछे'),
      disabled: !!st.attempt, onclick: () => { setStep('seats'); void loadTaken(); } }, '←');
    const btn = h('button', { class: 'btn btn-block btn-lg', type: 'submit' }, st.attempt ? L('Retry booking', 'बुकिंग फिर भेजें') : actionLabel);
    const form = h('form', { class: 'stack', novalidate: true, onsubmit: async (e) => {
      e.preventDefault(); clear(err);
      if (nameI.value.trim().length < 2) { err.textContent = L('Please enter your name.', 'अपना नाम लिखें।'); nameI.focus(); return; }
      if (phoneI.value.replace(/\D/g, '').length < 10) { err.textContent = L('Please enter a 10-digit mobile number.', '10 अंकों का मोबाइल नंबर लिखें।'); phoneI.focus(); return; }
      if (st.submitting) return;
      if (!st.attempt && (st.seats.length !== n || !canSelect())) {
        st.notice = lostSeat; setStep('seats'); void loadTaken(); return;
      }
      const seats = sortedSeats(st.seats);
      st.attempt ||= { id: crypto.randomUUID(), user: user().id, seats: seats.join(',') };
      writeSession(selectionKey, seats);
      writeSession(attemptKey, st.attempt);
      st.submitting = true;
      btn.disabled = true;
      backButton.disabled = true;
      btn.textContent = L('Submitting…', 'भेज रहे हैं…');
      try {
        const { data: booking, error } = await sb.rpc('request_cab_ride_idempotent', {
          p_request_id: st.attempt.id, p_ride: r.id, p_seat_numbers: seats, p_name: nameI.value.trim(),
          p_phone: phoneI.value.trim(), p_note: noteI.value.trim(), p_from_place: null, p_to_place: null,
        }).abortSignal(AbortSignal.timeout(18000));
        if (error) {
          if (error.code === 'P0001' || error.code === '23505') {
            st.attempt = null;
            writeSession(attemptKey, null);
            if (error.code === '23505' || /^Seat .*has just been taken/.test(error.message)) {
              st.submitting = false;
              await loadTaken();
              st.notice = lostSeat;
              setStep('seats');
              return;
            }
            err.textContent = error.message;
          } else {
            err.textContent = L('We could not confirm the response. Retry this booking to check its status.', 'बुकिंग का जवाब नहीं मिला। स्टेटस जानने के लिए फिर कोशिश करें।');
          }
          return;
        }
        if (!booking?.id) throw new Error('Missing booking ID');
        writeSession(selectionKey, null);
        writeSession(attemptKey, null);
        if (!p.phone) sb.from('profiles').update({ phone: phoneI.value.trim() }).eq('id', user().id).then(() => loadProfile());
        st.attempt = null;
        const receipt = h('div', { class: 'app-head' },
          h('h1', {}, booking.status === 'confirmed' ? L('Booking confirmed!', 'बुकिंग कन्फ़र्म हो गई!')
            : booking.status === 'pending' ? L('Request sent!', 'रिक्वेस्ट भेज दी!') : L('Booking saved', 'बुकिंग सेव हुई')),
          h('strong', { class: 'mono' }, refOf(booking)),
          h('a', { class: 'btn', href: `/cab/booking/${booking.id}` }, L('View booking', 'बुकिंग देखें')));
        clear(root).append(receipt);
        if (['confirmed', 'pending'].includes(booking.status)) {
          try { showBookingReceipt(booking, r, d); } catch { /* The booking link remains available. */ }
        }
      } catch {
        err.textContent = L('We could not confirm the response. Retry this booking to check its status.', 'बुकिंग का जवाब नहीं मिला। स्टेटस जानने के लिए फिर कोशिश करें।');
      } finally {
        st.submitting = false;
        btn.disabled = false;
        backButton.disabled = !!st.attempt;
        btn.textContent = st.attempt ? L('Retry booking', 'बुकिंग फिर भेजें') : actionLabel;
      }
    } },
      h('div', { class: 'confirm-card' },
        h('div', { class: 'driver-head' }, avatar(d.photo_url, d.full_name), h('div', {}, h('strong', {}, d.full_name), h('div', { class: 'small muted' }, r.vehicle_model))),
        timeline(),
        h('div', { class: 'confirm-meta' }, h('span', {}, icon('clock', 15), dateOf(r.departure_at)), h('span', {}, icon('people', 15), L('Seats ', 'सीट ') + sortedSeats(st.seats).join(', ')))),
      h('div', { class: 'fare' },
        h('h2', {}, L('Fare details', 'किराए का हिसाब')),
        h('div', { class: 'fare-row' }, h('span', {}, `${inr(r.price_per_seat)} × ${st.seats.length}`), h('span', {}, inr(r.price_per_seat * st.seats.length))),
        h('div', { class: 'fare-row total' }, h('span', {}, L('Total amount', 'कुल रकम')), h('strong', {}, inr(r.price_per_seat * st.seats.length))),
        h('p', { class: 'small muted' }, L('Pay the driver directly for your share of the trip.', 'अपने हिस्से का किराया सीधे ड्राइवर को दें।'))),
      h('label', { class: 'field', for: 'bk-name' }, h('span', { class: 'field-label' }, L('Your name', 'आपका नाम')), nameI),
      h('label', { class: 'field', for: 'bk-phone' }, h('span', { class: 'field-label' }, L('Mobile number', 'मोबाइल नंबर')), phoneI),
      h('label', { class: 'field', for: 'bk-note' }, h('span', { class: 'field-label' }, L('Message to driver', 'ड्राइवर के लिए संदेश')), noteI),
      err, btn,
      !r.auto_confirm ? h('p', { class: 'small muted center' }, L('The driver has 15 minutes to accept. Your seats are held until then; if there is no answer, they are released automatically.', 'ड्राइवर के पास मंज़ूर करने के लिए 15 मिनट हैं। तब तक सीटें आपके लिए रुकी रहेंगी; जवाब न आए तो अपने आप छूट जाएँगी।')) : null);
    return h('div', { class: 'cab-discovery cab-booking-flow cab-booking-review' },
      h('div', { class: 'app-head' }, backButton, h('h1', {}, L('Confirm your booking', 'बुकिंग कन्फ़र्म करें'))), form);
  }

  if (st.step !== 'details') await loadTaken();
  if (isOwn) st.step = 'details';
  else if (st.step === 'confirm' && (!user() || st.seats.length !== n)) st.step = 'seats';
  setStep(st.step);
  return root;
}

function showBookingReceipt(booking, ride, driver, { alreadyOnBooking = false } = {}) {
  const pending = booking.status === 'pending';
  const label = L('View booking', 'बुकिंग देखें');
  const dialog = celebrate({
    cabBooking: true,
    wait: pending,
    title: pending ? L('Request sent!', 'रिक्वेस्ट भेज दी!') : L('Booking confirmed!', 'बुकिंग कन्फ़र्म हो गई!'),
    message: pending
      ? L('Your seats are held while the driver responds.', 'ड्राइवर के जवाब तक आपकी सीटें होल्ड पर हैं।')
      : L('Your shared cab is booked. Pay the driver directly for your seat.', 'आपकी शेयर्ड कैब बुक है। अपनी सीट का किराया सीधे ड्राइवर को दें।'),
    rows: [
      [L('Booking ID', 'बुकिंग आईडी'), refOf(booking)],
      [L('Route', 'रूट'), routeLabel(ride)],
      [L('Date & time', 'तारीख़ और समय'), `${dateOf(ride.departure_at)} · ${timeOf(ride.departure_at)}`],
      [L('Driver & vehicle', 'ड्राइवर और गाड़ी'), [driver.full_name, ride.vehicle_model].filter(Boolean).join(' · ')],
      [L('Seats', 'सीटें'), (booking.seat_numbers || []).join(', ') || String(booking.seats)],
      [L('Total fare', 'कुल किराया'), inr(ride.price_per_seat * booking.seats)],
    ],
    actions: [
      pending && booking.hold_expires_at ? holdTimer(booking.hold_expires_at, L('Driver has', 'ड्राइवर के पास')) : null,
      alreadyOnBooking
        ? h('button', { class: 'btn btn-block', type: 'button', onclick: () => dialog.close() }, label)
        : h('a', { class: 'btn btn-block', href: `/cab/booking/${booking.id}` }, label),
      h('a', { class: 'btn btn-ghost btn-block', href: '/account/cab' }, L('My bookings', 'मेरी बुकिंग')),
    ],
  });
}

// ---------- 8. Booking page ----------
export async function booking({ params, query }) {
  if (!user()) { location.href = `/login?next=${encodeURIComponent(`/cab/booking/${params.id}`)}`; return h('div'); }
  await allPlaces();
  const b = await q(sb.from('cab_bookings').select('*, cab_rides(*)').eq('id', params.id).maybeSingle());
  if (!b) return h('div', { class: 'app-page' }, h('div', { class: 'app-head' }, back('/cab/bookings'), h('h1', {}, L('Booking not found', 'बुकिंग नहीं मिली'))));
  const r = b.cab_rides;
  const [cards, contact, support, trust] = await Promise.all([
    driverCards([r]),
    b.status === 'confirmed' || b.status === 'completed' ? q(sb.rpc('cab_booking_contact', { p_booking: b.id })).catch(() => null) : null,
    supportLink(`${L('Booking', 'बुकिंग')} ${refOf(b)}`),
    reliability(r.driver_id),
  ]);
  const driver = cards(r);
  const d = { ...driver, full_name: contact?.name || driver.full_name };
  const canCancel = ['pending', 'confirmed'].includes(b.status) && new Date(r.departure_at) > new Date() && r.status !== 'started';
  const when = `${dateOf(r.departure_at)} · ${timeOf(r.departure_at)}`;
  if (query.new === '1' && ['pending', 'confirmed'].includes(b.status)) {
    setTimeout(() => {
      if (location.pathname !== `/cab/booking/${b.id}`) return;
      history.replaceState(history.state, '', `/cab/booking/${b.id}`);
      showBookingReceipt(b, r, d, { alreadyOnBooking: true });
    }, 60);
  }

  const notes = {
    pending: b.hold_expires_at ? h('div', { class: 'soft-note warn' }, holdTimer(b.hold_expires_at, L('Driver has', 'ड्राइवर के पास')), h('span', { class: 'small' }, ' ', L('to answer. Your seats are held until then.', 'जवाब देने के लिए। तब तक आपकी सीटें रुकी हैं।')))
      : h('p', { class: 'soft-note' }, L('Waiting for the driver to answer.', 'ड्राइवर के जवाब का इंतज़ार।')),
    expired: h('div', { class: 'soft-note warn' }, L('This request expired because the driver did not answer in time. Your seats were released.', 'ड्राइवर ने समय पर जवाब नहीं दिया, इसलिए यह रिक्वेस्ट ख़त्म हो गई। आपकी सीटें छोड़ दी गईं।'),
      h('div', {}, h('a', { class: 'btn btn-sm', href: '/cab/find' }, L('Find another ride', 'दूसरी राइड खोजें')))),
    declined: h('div', { class: 'soft-note warn' }, L('The driver could not take this request. Please choose another ride.', 'ड्राइवर यह रिक्वेस्ट नहीं ले सके। कृपया दूसरी राइड चुनें।'), h('div', {}, h('a', { class: 'btn btn-sm', href: '/cab/find' }, L('Find another ride', 'दूसरी राइड खोजें')))),
    started: h('p', { class: 'soft-note ok' }, L('Your ride is on the way. Have a safe journey!', 'आपकी राइड रास्ते में है। शुभ यात्रा!')),
  };

  return h('div', { class: 'app-page' }, h('div', { class: 'cab-discovery cab-booking-flow cab-booking-record' },
    h('div', { class: 'app-head' }, back('/cab/bookings'), h('h1', {}, L('Booking details', 'बुकिंग की जानकारी'))),
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
      h('p', { class: 'small' }, `${L('Seats', 'सीट')} ${(b.seat_numbers || []).join(', ') || b.seats} · ${inr(r.price_per_seat * b.seats)}`)),
    h('section', { class: 'confirm-card stack' },
      h('h2', {}, L('Driver details', 'ड्राइवर की जानकारी')),
      h('div', { class: 'driver-head' }, avatar(d.photo_url, d.full_name),
        h('div', {}, h('strong', {}, d.full_name), d.is_verified ? driverBadge(d) : null,
          h('div', { class: 'small muted' }, [contact?.vehicle || r.vehicle_model, contact?.registration].filter(Boolean).join(' · ')))),
      d.about ? h('p', { class: 'small' }, d.about) : null,
      trust ? trustPanel(trust) : null,
      d.trips > 0 ? h('p', { class: 'small muted' }, `${d.trips} ${L('completed trips', 'पूरी राइड')}`) : null,
      d.member_since ? h('p', { class: 'small muted' }, `${L('With THH since', 'THH से जुड़े')} ${dateOf(d.member_since)}`) : null,
      contact?.phone ? h('div', { class: 'row-actions' },
        h('a', { class: 'btn btn-sm', href: `tel:${contact.phone}` }, L('Call driver', 'ड्राइवर को कॉल करें')),
        h('span', { class: 'small muted selectable' }, contact.phone)) : null,
      b.status === 'pending' ? h('p', { class: 'small muted' }, L('Driver phone and car number appear here after the driver confirms.', 'ड्राइवर के कन्फ़र्म करने के बाद फ़ोन और गाड़ी का नंबर यहाँ दिखेगा।')) : null),
    h('div', { class: 'stack' },
      h('a', { class: 'btn btn-block', href: '/cab/bookings' }, L('My bookings', 'मेरी बुकिंग')),
      support ? h('a', { class: 'btn btn-ghost btn-block', href: support.href, target: support.external ? '_blank' : null, rel: 'noopener' }, support.label) : null,
      canCancel ? h('button', { class: 'btn btn-danger-ghost btn-block', type: 'button', onclick: () => confirmCancel(b) }, L('Cancel booking', 'बुकिंग रद्द करें')) : null)));
}

function confirmCancel(b) {
  const yes = h('button', { class: 'btn btn-danger', type: 'button' }, L('Yes, cancel', 'हाँ, रद्द करें'));
  const dlg = modal(L('Cancel this booking?', 'यह बुकिंग रद्द करें?'), h('div', { class: 'stack' },
    h('p', {}, L('Your seats will be released for other travellers.', 'आपकी सीटें दूसरे यात्रियों के लिए खुल जाएँगी।')),
    h('div', { class: 'row-actions' }, h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => dlg.close() }, L('Keep booking', 'बुकिंग रखें')), yes)));
  yes.addEventListener('click', () => busy(yes, async () => {
    await q(sb.rpc('cancel_cab_booking', { p_booking: b.id }));
    dlg.close(); toast(L('Booking cancelled', 'बुकिंग रद्द हो गई'));
    location.reload();
  }));
}

// ---------- 9. My bookings ----------
export async function bookings({ query }) {
  if (!user()) { location.href = '/login?next=/cab/bookings'; return h('div'); }
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
    h('div', { class: 'app-head' }, back('/cab/me'), h('h1', {}, L('My bookings', 'मेरी बुकिंग'))),
    h('nav', { class: 'seg-tabs' }, Object.keys(groups).map((k) => h('a', { href: `/cab/bookings?tab=${k}`, class: k === tab ? 'on' : '' }, `${label[k]} (${groups[k].length})`))),
    groups[tab].length ? h('div', { class: 'stack' }, groups[tab].map((b) => bookingCard(b, cards(b.cab_rides))))
      : h('div', { class: 'empty-state' }, h('span', { class: 'empty-ico' }, icon('car', 30)), h('p', { class: 'muted' }, L('Nothing here yet.', 'अभी यहाँ कुछ नहीं।')),
        h('a', { class: 'btn btn-sm', href: '/cab/find' }, L('Find a ride', 'राइड खोजें'))));
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
      h('a', { class: 'btn btn-ghost btn-sm', href: `/cab/booking/${b.id}` }, L('View details', 'पूरी जानकारी')),
      canCancel ? h('button', { class: 'btn btn-danger-ghost btn-sm', type: 'button', onclick: () => confirmCancel(b) }, L('Cancel', 'रद्द करें')) : null));
}

// ---------- Customer dashboard ----------
export async function me() {
  if (!user()) { location.href = '/login?next=/cab/me'; return h('div'); }
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
      h('a', { class: 'mode-switch', href: hasDriver ? '/drive' : '/drive' }, icon('car', 16), L('Driver mode', 'ड्राइवर मोड'))),
    h('section', {}, h('h2', {}, L('Search your ride', 'अपनी राइड खोजें')), searchForm()),
    h('section', {}, h('div', { class: 'sec-head' }, h('h2', {}, L('Upcoming journeys', 'आने वाली यात्राएँ')), h('a', { class: 'link-more', href: '/cab/bookings' }, L('All bookings', 'सभी बुकिंग'))),
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
    h('a', { href: n.link || '/cab/me' }, h('strong', {}, n.title), h('span', { class: 'small muted' }, n.body)))));
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
      h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: async () => { await sb.auth.signOut(); state.session = null; await loadProfile(); location.href = '/cab'; } }, L('Log out', 'लॉग आउट'))));
}

export const appLoading = () => h('div', { class: 'app-page' }, loading());
