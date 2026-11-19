// Instant Book Cab — customer side: entry choice, search, results, ride details,
// seat choice, confirmation, booking page, my bookings and the customer dashboard.
// Rides are real journeys published by drivers (cost sharing, pay the driver directly).
import { h, clear, toast, modal, busy, inr, todayISO, empty, loading, icon, lazy } from '../ui.js';
import { getLang } from '../i18n.js';
import { sb, q } from '../sb.js';
import { state, user, loadProfile } from '../store.js';
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
export const routeLabel = (r) => {
  const path = ridePath(r, placesCached());
  const p = (id) => placeName(placeById(id)) || '?';
  return `${p(path[0])} → ${p(path[path.length - 1])}`;
};

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
  matches.forEach((r) => list.append(rideCard(r, card(r), n, places)));
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
      h('span', { class: `seat-pill${left <= 2 ? ' low' : ''}` }, left > 0 ? `${left} ${L(left === 1 ? 'seat left' : 'seats left', 'सीट बाकी')}` : L('Full', 'भरी हुई'))),
    h('div', { class: 'rc-route' },
      h('div', { class: 'tl' },
        h('div', { class: 'tl-row' }, h('span', { class: 'tl-dot' }), h('strong', {}, timeOf(r.departure_at)), h('span', {}, placeName(placeById(ridePath(r, places)[0])))),
        (r.stops || []).length ? h('div', { class: 'tl-row tl-via' }, h('span', { class: 'tl-dot small' }), h('span', { class: 'muted' }, L('via ', 'होकर ') + r.stops.map((s) => placeName(placeById(s.place_id)) || s.name).join(', '))) : null,
        h('div', { class: 'tl-row' }, h('span', { class: 'tl-dot end' }), h('span', {}, placeName(placeById(ridePath(r, places).slice(-1)[0])))))),
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
  const d = (await driverCards([r]))(r);
  const path = ridePath(r, places);
  const n = Math.max(1, Number(query.n) || 1);
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
    h('div', { class: 'tl-row' }, h('span', { class: 'tl-dot' }), h('strong', {}, placeName(placeById(path[0]))), h('span', { class: 'tl-time' }, timeOf(r.departure_at))),
    r.pickup_point ? h('div', { class: 'tl-note' }, L('Pickup: ', 'पिकअप: ') + r.pickup_point) : null,
    ...(r.stops || []).map((s) => h('div', { class: 'tl-row tl-via' }, h('span', { class: 'tl-dot small' }), h('span', {}, placeName(placeById(s.place_id)) || s.name))),
    h('div', { class: 'tl-row' }, h('span', { class: 'tl-dot end' }), h('strong', {}, placeName(placeById(path[path.length - 1])))),
    r.drop_point ? h('div', { class: 'tl-note' }, L('Drop: ', 'ड्रॉप: ') + r.drop_point) : null);

  function details() {
    return h('div', {},
      h('div', { class: 'ride-hero' }, h('img', { src: 'img/home/hero.jpg', alt: '' }), back(`#/cab/find`)),
      h('div', { class: 'ride-sheet' },
        h('div', { class: 'driver-head' }, avatar(d.photo_url, d.full_name, 'av av-lg'),
          h('div', {}, h('h1', {}, d.full_name), driverBadge(d), d.trips ? h('p', { class: 'muted small' }, `${d.trips} ${L('trips completed', 'ट्रिप पूरी')}`) : null)),
        h('div', { class: 'feature-row' },
          h('div', {}, icon('car', 22), h('span', {}, r.vehicle_model)),
          h('div', {}, icon('people', 22), h('span', {}, `${r.seats_total} ${L('seats', 'सीट')}`)),
          h('div', {}, icon('shield', 22), h('span', {}, r.auto_confirm ? L('Instant book', 'तुरंत बुकिंग') : L('Driver confirms', 'ड्राइवर मंज़ूर करेगा'))),
          v ? h('div', {}, icon('mountain', 22), h('span', {}, v.label)) : null),
        d.about ? h('section', {}, h('h2', {}, L('About driver', 'ड्राइवर के बारे में')), h('p', {}, d.about)) : null,
        h('section', {}, h('h2', {}, L('Route & timing', 'रूट और समय')), h('p', { class: 'muted small' }, dateOf(r.departure_at)), timeline()),
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
      !r.auto_confirm ? h('p', { class: 'small muted center' }, L('The driver will accept or decline your request. Your seats are held until then.', 'ड्राइवर आपकी रिक्वेस्ट मंज़ूर या मना करेगा। तब तक आपकी सीटें रोकी रहेंगी।')) : null);
    return h('div', {},
      h('div', { class: 'app-head' }, h('button', { class: 'app-back', type: 'button', 'aria-label': L('Back', 'पीछे'), onclick: () => { st.step = 'seats'; paint(); } }, '←'),
        h('h1', {}, L('Confirm your booking', 'बुकिंग कन्फ़र्म करें'))),
      form);
  }

  if (st.step === 'confirm' && !user()) st.step = 'seats';
  paint();
  return root;
}

// ---------- 8. Booking page ----------
export async function booking({ params, query }) {
  if (!user()) { location.hash = `#/login?next=${encodeURIComponent(`cab/booking/${params.id}`)}`; return h('div'); }
  const places = await allPlaces();
  const b = await q(sb.from('cab_bookings').select('*, cab_rides(*)').eq('id', params.id).maybeSingle());
  if (!b) return h('div', { class: 'app-page' }, h('div', { class: 'app-head' }, back('#/cab/bookings'), h('h1', {}, L('Booking not found', 'बुकिंग नहीं मिली'))));
  const r = b.cab_rides;
  const d = (await driverCards([r]))(r);
  const contact = b.status === 'confirmed' ? await q(sb.rpc('cab_booking_contact', { p_booking: b.id })).catch(() => null) : null;
  const path = ridePath(r, places);
  const isNew = query.new === '1';
  const canCancel = ['pending', 'confirmed'].includes(b.status) && new Date(r.departure_at) > new Date();
  const head = isNew
    ? h('div', { class: 'success' },
      h('span', { class: `success-ico${b.status === 'pending' ? ' wait' : ''}` }, b.status === 'pending' ? '…' : '✓'),
      h('h1', {}, b.status === 'pending' ? L('Request sent!', 'रिक्वेस्ट भेज दी!') : L('Booking confirmed!', 'बुकिंग कन्फ़र्म!')),
      h('p', { class: 'muted' }, b.status === 'pending'
        ? L('The driver will reply soon. We will notify you here.', 'ड्राइवर जल्द जवाब देंगे। आपको यहीं सूचना मिलेगी।')
        : L('Your seat is booked. Have a good journey!', 'आपकी सीट बुक हो गई। शुभ यात्रा!')))
    : h('div', { class: 'app-head' }, back('#/cab/bookings'), h('h1', {}, L('Booking details', 'बुकिंग की जानकारी')));

  return h('div', { class: 'app-page' }, head,
    h('div', { class: 'code-box' }, h('span', { class: 'small muted' }, L('Booking ID', 'बुकिंग आईडी')), h('strong', {}, b.booking_code || b.id.slice(0, 8).toUpperCase()), statusPill(b.status, r.departure_at)),
    h('div', { class: 'confirm-card' },
      h('div', { class: 'tl' },
        h('div', { class: 'tl-row' }, h('span', { class: 'tl-dot' }), h('strong', {}, placeName(placeById(path[0])))),
        h('div', { class: 'tl-row' }, h('span', { class: 'tl-dot end' }), h('strong', {}, placeName(placeById(path[path.length - 1]))))),
      h('p', { class: 'small muted' }, `${dateOf(r.departure_at)} · ${timeOf(r.departure_at)}`),
      r.pickup_point ? h('p', { class: 'small' }, L('Pickup: ', 'पिकअप: ') + r.pickup_point) : null,
      h('div', { class: 'driver-head' }, avatar(d.photo_url, d.full_name),
        h('div', {}, h('strong', {}, d.full_name), h('div', { class: 'small muted' }, [contact?.vehicle || r.vehicle_model, contact?.registration].filter(Boolean).join(' · ')),
          h('div', { class: 'small' }, `${L('Seats', 'सीट')} ${(b.seat_numbers || []).join(', ') || b.seats} · ${inr(r.price_per_seat * b.seats)}`))),
      contact?.phone ? h('div', { class: 'row-actions' },
        h('a', { class: 'btn btn-sm', href: `tel:${contact.phone}` }, L('Call driver', 'ड्राइवर को कॉल करें')),
        h('span', { class: 'small muted selectable' }, contact.phone)) : null,
      b.status === 'pending' ? h('p', { class: 'small muted' }, L('Driver phone and car number appear here after the driver confirms.', 'ड्राइवर के कन्फ़र्म करने के बाद फ़ोन और गाड़ी का नंबर यहाँ दिखेगा।')) : null),
    h('div', { class: 'stack' },
      h('a', { class: 'btn btn-block', href: '#/cab/bookings' }, L('My bookings', 'मेरी बुकिंग')),
      h('a', { class: 'btn btn-ghost btn-block', href: '#/cab/me' }, L('Go to dashboard', 'डैशबोर्ड पर जाएँ')),
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
  const groups = {
    upcoming: rows.filter((b) => ['pending', 'confirmed'].includes(b.status) && new Date(b.cab_rides?.departure_at) > now),
    completed: rows.filter((b) => ['confirmed', 'completed'].includes(b.status) && new Date(b.cab_rides?.departure_at) <= now),
    cancelled: rows.filter((b) => ['cancelled', 'declined'].includes(b.status)),
  };
  const tab = groups[query.tab] ? query.tab : 'upcoming';
  const label = { upcoming: L('Upcoming', 'आने वाली'), completed: L('Completed', 'पूरी'), cancelled: L('Cancelled', 'रद्द') };
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
  const canCancel = ['pending', 'confirmed'].includes(b.status) && new Date(r.departure_at) > new Date();
  return h('article', { class: 'bk-card' },
    h('div', { class: 'bk-top' }, h('strong', {}, `#${b.booking_code || b.id.slice(0, 8).toUpperCase()}`), statusPill(b.status, r.departure_at)),
    h('div', { class: 'bk-route' }, routeLabel(r)),
    h('div', { class: 'small muted' }, `${dateOf(r.departure_at)} · ${timeOf(r.departure_at)}`),
    h('div', { class: 'driver-head' }, avatar(d.photo_url, d.full_name), h('div', {}, h('strong', {}, d.full_name), h('div', { class: 'small muted' }, r.vehicle_model))),
    h('div', { class: 'small' }, `${L('Seats', 'सीट')}: ${(b.seat_numbers || []).join(', ') || b.seats} · ${b.seats} ${L('passenger(s)', 'यात्री')}`),
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
