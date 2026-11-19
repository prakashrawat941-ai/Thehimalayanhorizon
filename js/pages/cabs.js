// Instant cab: find rides published by drivers on a route and book seats.
import { h, field, input, select, empty, inr, fmtDate, modal, toast, busy, todayISO, badge } from '../ui.js';
import { t, pick, getLang } from '../i18n.js';
import { sb, q } from '../sb.js';
import { locations, locationById, user, state } from '../store.js';

const vehicleLabel = { hatchback: 'Hatchback', sedan: 'Sedan', suv: 'SUV', tempo_traveller: 'Tempo Traveller', other: 'Other' };

export async function cabs({ query }) {
  const locs = (await locations()).filter((l) => l.is_cab_point);
  const opts = [['', '—'], ...locs.map((l) => [l.slug, pick(l, 'name')])];
  const from = select(opts, query.from || '', { name: 'from', 'aria-label': t('from') });
  const to = select(opts, query.to || '', { name: 'to', 'aria-label': t('to') });
  const date = input({ type: 'date', name: 'date', min: todayISO(), value: query.date || '' });
  const hi = getLang() === 'hi';

  const form = h('form', { class: 'cab-search', onsubmit: (e) => {
    e.preventDefault();
    const p = new URLSearchParams();
    if (from.value) p.set('from', from.value);
    if (to.value) p.set('to', to.value);
    if (date.value) p.set('date', date.value);
    location.hash = '#/cabs' + (p.toString() ? '?' + p : '');
  } },
    field(t('from'), from),
    h('button', { type: 'button', class: 'icon-btn swap', 'aria-label': 'Swap', onclick: () => { const v = from.value; from.value = to.value; to.value = v; } }, '⇄'),
    field(t('to'), to),
    field(t('date'), date),
    h('button', { class: 'btn', type: 'submit' }, t('search')));

  let qy = sb.from('cab_rides').select('*').eq('status', 'open').gt('departure_at', new Date().toISOString())
    .order('departure_at').limit(60);
  const fromLoc = locs.find((l) => l.slug === query.from);
  const toLoc = locs.find((l) => l.slug === query.to);
  if (fromLoc) qy = qy.eq('from_location_id', fromLoc.id);
  if (toLoc) qy = qy.eq('to_location_id', toLoc.id);
  if (query.date) {
    const start = new Date(`${query.date}T00:00:00+05:30`);
    qy = qy.gte('departure_at', start.toISOString()).lt('departure_at', new Date(start.getTime() + 864e5).toISOString());
  }
  const rides = await q(qy);

  return h('div', { class: 'page' },
    h('h1', {}, t('cabs')),
    h('p', { class: 'lead' }, hi
      ? 'ड्राइवर अपने रूट पर राइड डालते हैं। अपना रूट चुनिए और जितनी सीटें चाहिए, बुक कीजिए।'
      : 'Drivers publish rides on their route. Pick your route and book the seats you need.'),
    h('div', { class: 'panel' }, form),
    h('div', { class: 'ride-list' }, rides.length ? rides.map(rideCard) : empty(t('no_rides'))),
    h('p', { class: 'muted small center' }, hi ? 'आप ड्राइवर हैं? ' : 'Are you a driver? ', h('a', { href: '#/partner/join' }, t('become_partner'))));
}

function rideCard(r) {
  const fromL = locationById(r.from_location_id);
  const toL = locationById(r.to_location_id);
  const left = r.seats_total - r.seats_booked;
  return h('article', { class: 'ride' },
    h('div', { class: 'ride-route' },
      h('div', { class: 'ride-time' }, fmtDate(r.departure_at, true)),
      h('div', { class: 'ride-places' },
        h('strong', {}, fromL ? pick(fromL, 'name') : '?'), h('span', { class: 'ride-arrow' }, '→'), h('strong', {}, toL ? pick(toL, 'name') : '?')),
      r.pickup_point ? h('div', { class: 'muted small' }, `📍 ${r.pickup_point}`) : null),
    h('div', { class: 'ride-info' },
      h('div', {}, `🚙 ${r.vehicle_model} · ${vehicleLabel[r.vehicle_type] || ''}`),
      h('div', { class: left <= 2 ? 'warn-text' : '' }, `${left} / ${r.seats_total} ${t('seats_left')}`),
      r.notes ? h('div', { class: 'muted small' }, r.notes) : null),
    h('div', { class: 'ride-book' },
      h('div', { class: 'price' }, `${inr(r.price_per_seat)} `, h('small', {}, t('per_seat'))),
      h('button', { class: 'btn', onclick: () => bookModal(r) }, t('book_seats'))));
}

function bookModal(r) {
  if (!user()) { location.hash = `#/login?next=${encodeURIComponent(location.hash.slice(2))}`; return; }
  const left = r.seats_total - r.seats_booked;
  const seats = input({ type: 'number', name: 'seats', min: 1, max: left, value: 1, required: true });
  const price = h('strong', {}, inr(r.price_per_seat));
  seats.addEventListener('input', () => { price.textContent = inr(r.price_per_seat * Math.max(1, Number(seats.value) || 1)); });
  const hi = getLang() === 'hi';
  const form = h('form', { class: 'stack', onsubmit: async (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(form).entries());
    await busy(form.querySelector('button[type=submit]'), async () => {
      const b = await q(sb.rpc('book_cab_seats', { p_ride: r.id, p_seats: Number(fd.seats), p_name: fd.name, p_phone: fd.phone, p_note: fd.note || '' }));
      dlg.close();
      toast(b.status === 'confirmed' ? (hi ? 'सीट कन्फर्म हो गई!' : 'Seats confirmed!') : (hi ? 'रिक्वेस्ट ड्राइवर को भेज दी गई' : 'Request sent to the driver'));
      location.hash = '#/account';
    });
  } },
    field(t('seats'), seats, `${left} ${t('seats_left')}`),
    field(t('name'), input({ name: 'name', required: true, minlength: 2, value: state.profile?.full_name || '' })),
    field(t('phone'), input({ name: 'phone', type: 'tel', required: true, minlength: 7, value: state.profile?.phone || '' })),
    field(hi ? 'पिकअप के लिए नोट (ज़रूरी नहीं)' : 'Pickup note (optional)', input({ name: 'note', maxlength: 300 })),
    h('div', { class: 'kv' }, h('span', {}, hi ? 'कुल किराया (ड्राइवर को सीधे)' : 'Total fare (pay driver directly)'), price),
    r.auto_confirm ? null : h('small', { class: 'muted' }, hi ? 'ड्राइवर की मंज़ूरी के बाद कन्फर्म होगी।' : 'Confirmed after the driver accepts.'),
    h('button', { class: 'btn btn-block', type: 'submit' }, t('book_seats')));
  const dlg = modal(t('book_seats'), form);
}

export { badge };
