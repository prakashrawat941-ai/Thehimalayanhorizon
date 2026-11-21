// Instant Book Cab — driver side: onboarding, dashboard, publish/edit ride with review,
// my rides, ride requests, trip details and driver/vehicle profile.
import { h, clear, toast, modal, busy, inr, todayISO, icon, lazy } from '../ui.js';
import { sb, q } from '../sb.js';
import { state, user, isAdmin } from '../store.js';
import { allPlaces, placeInput, placeName, placeById } from '../places.js';
import { vehiclePicker, vehicleVisual, catalog } from '../cab/vehicles.js';
import { fetchLeg, fmtKm, fmtDur } from '../trip/engine.js';
import { routeMap } from '../trip/steps.js';
import { getLang } from '../i18n.js';
import { L, avatar, timeOf, dateOf, VEHICLES, statusPill, routeLabel, ridePath, notifications, endName, refOf, holdTimer, celebrate, reliability, trustPanel } from './cab.js';

const back = (href) => h('a', { class: 'app-back', href, 'aria-label': L('Back', 'पीछे') }, h('span', { 'aria-hidden': 'true' }, '←'));
const needLogin = (next) => { location.hash = `#/login?next=${encodeURIComponent(next)}`; return h('div'); };

async function me() {
  const [profile, vehicles] = await Promise.all([
    q(sb.from('driver_profiles').select('*').eq('user_id', user().id).maybeSingle()),
    q(sb.from('vehicles').select('*').eq('owner_id', user().id).eq('is_active', true).order('created_at')),
  ]);
  return { profile, vehicles };
}

const isUpcoming = (r) => new Date(r.departure_at) > new Date();
const isActive = (r) => r.status === 'started' || (['open', 'full'].includes(r.status) && isUpcoming(r));
const canPublish = (profile) => profile?.is_verified || isAdmin();
const verifyNote = () => h('div', { class: 'soft-note warn verify-note' }, icon('shield', 18),
  h('div', {}, h('strong', {}, L('Waiting for verification', 'वेरिफ़िकेशन का इंतज़ार')),
    h('p', { class: 'small' }, L('The Himalayan Horizon team checks every driver before their first ride. You can complete your profile and vehicle now; publishing opens after approval.',
      'हर ड्राइवर की पहली राइड से पहले द हिमालयन होराइज़न टीम जाँच करती है। अभी प्रोफ़ाइल और गाड़ी पूरी कर लें; मंज़ूरी के बाद राइड डाल पाएँगे।'))));

// Start (up to 3 hours before departure, with confirmed passengers) and Complete.
function lifecycle(r, confirmedCount) {
  if (r.status === 'started') {
    const b = h('button', { class: 'btn', type: 'button' }, icon('check', 16), L('Complete ride', 'राइड पूरी करें'));
    b.addEventListener('click', () => askLifecycle(r, 'complete', b));
    return b;
  }
  if (!['open', 'full'].includes(r.status)) return null;
  const opensAt = new Date(new Date(r.departure_at).getTime() - 3 * 3600e3);
  if (new Date() < opensAt || !confirmedCount) return null;
  const b = h('button', { class: 'btn', type: 'button' }, icon('route', 16), L('Start ride', 'राइड शुरू करें'));
  b.addEventListener('click', () => askLifecycle(r, 'start', b));
  return b;
}
function askLifecycle(r, what, btn) {
  const start = what === 'start';
  const yes = h('button', { class: 'btn', type: 'button' }, start ? L('Yes, start now', 'हाँ, अभी शुरू करें') : L('Yes, ride completed', 'हाँ, राइड पूरी हुई'));
  const dlg = modal(start ? L('Start this ride?', 'राइड शुरू करें?') : L('Complete this ride?', 'राइड पूरी करें?'), h('div', { class: 'stack' },
    h('p', {}, start
      ? L('Passengers are told the ride has started. Requests you have not answered will close.', 'यात्रियों को बताया जाएगा कि राइड शुरू हो गई। जिन रिक्वेस्ट का जवाब नहीं दिया, वे बंद हो जाएँगी।')
      : L('Confirmed passengers are marked as dropped. Both sides will be asked for feedback.', 'कन्फ़र्म यात्री पहुँचे हुए माने जाएँगे। दोनों से फ़ीडबैक माँगा जाएगा।')),
    h('div', { class: 'row-actions' }, h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => dlg.close() }, L('Not now', 'अभी नहीं')), yes)));
  yes.addEventListener('click', () => busy(yes, async () => {
    await q(sb.rpc(start ? 'start_cab_ride' : 'complete_cab_ride', { p_ride: r.id }));
    dlg.close(); toast(start ? L('Ride started. Drive safely!', 'राइड शुरू हुई। सुरक्षित चलाएँ!') : L('Ride completed', 'राइड पूरी हुई'));
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  }).catch((ex) => toast(ex.message, 'err')));
}

// ---------- Onboarding (first time) ----------
function onboarding() {
  const p = state.profile || {};
  const meta = user().user_metadata || {};
  const nameI = h('input', { class: 'input', id: 'dr-name', required: true, minlength: 2, value: p.full_name || meta.full_name || meta.name || '', autocomplete: 'name' });
  const phoneI = h('input', { class: 'input', id: 'dr-phone', type: 'tel', required: true, inputmode: 'tel', value: p.phone || '', autocomplete: 'tel', placeholder: '98xxxxxxxx' });
  const aboutI = h('textarea', { class: 'input', id: 'dr-about', rows: 3, maxlength: 500, placeholder: L('Years of driving, routes you know, languages…', 'कितने साल से गाड़ी चला रहे हैं, कौन से रूट जानते हैं, भाषाएँ…') });
  const vf = vehicleFields();
  const err = h('p', { class: 'form-err', role: 'alert' });
  const btn = h('button', { class: 'btn btn-block btn-lg', type: 'submit' }, L('Save and continue', 'सेव करें और आगे बढ़ें'));
  return h('div', { class: 'app-page' },
    h('div', { class: 'app-head' }, back('#/cab'), h('div', { class: 'grow' }, h('h1', {}, L('Become a driver', 'ड्राइवर बनें')),
      h('p', { class: 'muted' }, L('Tell travellers who you are and which car you drive.', 'यात्रियों को बताइए कि आप कौन हैं और कौन सी गाड़ी चलाते हैं।')))),
    h('form', { class: 'stack', novalidate: true, onsubmit: async (e) => {
      e.preventDefault(); clear(err);
      if (nameI.value.trim().length < 2) { err.textContent = L('Please enter your name.', 'अपना नाम लिखें।'); return; }
      if (phoneI.value.replace(/\D/g, '').length < 10) { err.textContent = L('Please enter a 10-digit mobile number.', '10 अंकों का मोबाइल नंबर लिखें।'); return; }
      const v = vf.value(); if (v.error) { err.textContent = v.error; return; }
      await busy(btn, async () => {
        await q(sb.from('driver_profiles').insert({ user_id: user().id, full_name: nameI.value.trim(), phone: phoneI.value.trim(), about: aboutI.value.trim(),
          photo_url: p.avatar_url || meta.avatar_url || meta.picture || '' }));
        await q(sb.from('vehicles').insert({ owner_id: user().id, ...v.row }));
        toast(L('Driver profile saved', 'ड्राइवर प्रोफ़ाइल सेव हो गई'));
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      }).catch((ex) => { err.textContent = ex.message; });
    } },
      h('section', { class: 'panel stack' }, h('h2', {}, L('About you', 'आपके बारे में')),
        h('label', { class: 'field', for: 'dr-name' }, h('span', { class: 'field-label' }, L('Full name', 'पूरा नाम')), nameI),
        h('label', { class: 'field', for: 'dr-phone' }, h('span', { class: 'field-label' }, L('Mobile number (shared only with confirmed passengers)', 'मोबाइल नंबर (सिर्फ़ कन्फ़र्म यात्रियों को दिखेगा)')), phoneI),
        h('label', { class: 'field', for: 'dr-about' }, h('span', { class: 'field-label' }, L('About you (optional)', 'आपके बारे में (वैकल्पिक)')), aboutI)),
      h('section', { class: 'panel stack' }, h('h2', {}, L('Your vehicle', 'आपकी गाड़ी')), vf.el),
      err, btn));
}

function vehicleFields(v = {}) {
  const regI = h('input', { class: 'input', id: 'vh-reg', value: v.registration_no || '', placeholder: 'UK07 AB 1234', autocapitalize: 'characters' });
  const acI = h('input', { type: 'checkbox', id: 'vh-ac' }); acI.checked = v.has_ac ?? true;
  const picker = vehiclePicker(v);
  return {
    el: h('div', { class: 'stack' }, picker.el,
      h('label', { class: 'field', for: 'vh-reg' }, h('span', { class: 'field-label' }, L('Registration number', 'रजिस्ट्रेशन नंबर')), regI),
      h('label', { class: 'check' }, acI, h('span', {}, L('Car has AC', 'गाड़ी में AC है'))),
      h('p', { class: 'small muted' }, L('Travellers see only the state code (e.g. UK07). The full number is shown only to passengers you confirm.', 'यात्रियों को सिर्फ़ राज्य कोड (जैसे UK07) दिखेगा। पूरा नंबर सिर्फ़ कन्फ़र्म यात्रियों को।'))),
    value() {
      const pv = picker.value(); if (pv.error) return pv;
      const reg = regI.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      if (reg.length < 4) return { error: L('Please enter the registration number.', 'रजिस्ट्रेशन नंबर लिखें।') };
      return { row: { ...pv.row, registration_no: reg, has_ac: acI.checked } };
    },
  };
}

// ---------- Dashboard ----------
export async function dashboard() {
  if (!user()) return needLogin('drive');
  const { profile, vehicles } = await me();
  if (!profile) return onboarding();
  await allPlaces();
  const rides = await q(sb.from('cab_rides').select('*').eq('driver_id', user().id).order('departure_at', { ascending: false }).limit(200));
  const ids = rides.map((r) => r.id);
  const books = ids.length ? await q(sb.from('cab_bookings').select('*').in('ride_id', ids)) : [];
  const rideOf = (b) => rides.find((r) => r.id === b.ride_id);
  const active = rides.filter(isActive);
  const pending = books.filter((b) => b.status === 'pending' && isUpcoming(rideOf(b)));
  const accepted = books.filter((b) => b.status === 'confirmed' && isActive(rideOf(b)));
  const history = rides.filter((r) => !isActive(r));
  const rel = await reliability(user().id);
  const shared = books.filter((b) => ['confirmed', 'completed'].includes(b.status) && !isUpcoming(rideOf(b)))
    .reduce((sum, b) => sum + b.seats * (rideOf(b)?.price_per_seat || 0), 0);
  const expected = accepted.reduce((sum, b) => sum + b.seats * (rideOf(b)?.price_per_seat || 0), 0);
  const photo = profile.photo_url || state.profile?.avatar_url || '';

  const stat = (n, label) => h('div', { class: 'stat-tile' }, h('strong', {}, n), h('span', {}, label));
  const item = (href, ic, label, count, alert) => h('a', { class: 'menu-item', href }, h('span', { class: 'menu-ico' }, icon(ic, 20)), h('span', { class: 'grow' }, label),
    count != null ? h('span', { class: `count${alert && count ? ' alert' : ''}` }, String(count)) : null, h('span', { class: 'chev', 'aria-hidden': 'true' }, '›'));

  return h('div', { class: 'app-page dash' },
    h('div', { class: 'welcome' }, avatar(photo, profile.full_name, 'av av-lg'),
      h('div', { class: 'grow' }, h('p', { class: 'muted small' }, L('Driver', 'ड्राइवर')), h('h1', {}, profile.full_name),
        profile.is_verified ? h('span', { class: 'badge-verified' }, '✓ ', L('Verified driver', 'वेरिफ़ाइड ड्राइवर')) : h('span', { class: 'badge-new' }, L('New driver', 'नए ड्राइवर'))),
      h('a', { class: 'mode-switch', href: '#/cab/me' }, icon('user', 16), L('Traveller mode', 'यात्री मोड'))),
    h('div', { class: 'stat-grid' },
      stat(active.length, L('Upcoming rides', 'आने वाली राइड')), stat(pending.length, L('New requests', 'नई रिक्वेस्ट')),
      stat(accepted.reduce((s, b) => s + b.seats, 0), L('Seats confirmed', 'कन्फ़र्म सीटें')), stat(inr(shared), L('Cost shared so far', 'अब तक मिला हिस्सा'))),
    canPublish(profile) ? null : verifyNote(),
    !vehicles.length ? h('a', { class: 'btn btn-block btn-lg', href: '#/drive/profile' }, L('Add your vehicle first', 'पहले अपनी गाड़ी जोड़ें'))
      : canPublish(profile) ? h('a', { class: 'btn btn-block btn-lg publish-btn', href: '#/drive/publish' }, '+ ', L('Publish ride', 'राइड पब्लिश करें'))
      : h('button', { class: 'btn btn-block btn-lg', type: 'button', disabled: true }, L('Publishing opens after verification', 'वेरिफ़िकेशन के बाद राइड डाल पाएँगे')),
    rel ? h('section', {}, h('h2', {}, L('Your record', 'आपका रिकॉर्ड')), trustPanel(rel)) : null,
    h('nav', { class: 'menu' },
      item('#/drive/requests', 'people', L('Ride requests', 'राइड रिक्वेस्ट'), pending.length, true),
      item('#/drive/rides', 'map', L('My published rides', 'मेरी पब्लिश राइड'), active.length),
      item('#/drive/requests?tab=accepted', 'shield', L('Accepted passengers', 'कन्फ़र्म यात्री'), accepted.length),
      item('#/drive/rides?tab=history', 'home', L('Journey history', 'यात्रा का इतिहास'), history.length),
      item('#/drive/profile', 'car', L('Profile and vehicle', 'प्रोफ़ाइल और गाड़ी'))),
    h('section', { class: 'panel' }, h('h2', {}, L('Cost sharing summary', 'ख़र्च बँटवारे का हिसाब')),
      h('div', { class: 'fare-row' }, h('span', {}, L('Received from past trips', 'पिछली ट्रिप से मिला')), h('strong', {}, inr(shared))),
      h('div', { class: 'fare-row' }, h('span', {}, L('Expected from upcoming confirmed seats', 'आने वाली कन्फ़र्म सीटों से')), h('strong', {}, inr(expected))),
      h('p', { class: 'small muted' }, L('Passengers pay you directly. These numbers come from confirmed seats only.', 'यात्री आपको सीधे पैसे देते हैं। ये आँकड़े सिर्फ़ कन्फ़र्म सीटों से हैं।'))),
    h('section', {}, h('h2', {}, L('Notifications', 'सूचनाएँ')), lazy(() => notifications(5))));
}

// ---------- Publish / edit ----------
export async function publish({ params }) {
  if (!user()) return needLogin(params.id ? `drive/ride/${params.id}/edit` : 'drive/publish');
  const { profile, vehicles } = await me();
  if (!profile) return onboarding();
  if (!vehicles.length) { location.hash = '#/drive/profile'; return h('div'); }
  if (!params.id && !canPublish(profile)) return h('div', { class: 'app-page' }, h('div', { class: 'app-head' }, back('#/drive'), h('h1', {}, L('Publish new ride', 'नई राइड पब्लिश करें'))), verifyNote());
  const places = await allPlaces();
  let r = null;
  if (params.id) {
    r = await q(sb.from('cab_rides').select('*').eq('id', params.id).eq('driver_id', user().id).maybeSingle());
    if (!r) return h('div', { class: 'app-page' }, h('div', { class: 'app-head' }, back('#/drive/rides'), h('h1', {}, L('Ride not found', 'राइड नहीं मिली'))));
  }
  const locked = r && r.seats_booked > 0;
  const asPlace = (id, geo) => placeById(id) || (geo ? { id: null, ext: true, name: geo.name || '', lat: geo.lat, lng: geo.lng, district: null } : null);
  const fromI = placeInput({ id: 'pr-from', external: true, label: L('Starting location', 'कहाँ से'), value: r ? asPlace(r.from_place_id, r.from_geo) : null, placeholder: L('Any town or village in India', 'भारत का कोई भी शहर या गाँव') });
  const toI = placeInput({ id: 'pr-to', external: true, label: L('Destination', 'मंज़िल'), value: r ? asPlace(r.to_place_id, r.to_geo) : null, placeholder: L('Any town or village in India', 'भारत का कोई भी शहर या गाँव') });
  const stops = [];
  const stopsBox = h('div', { class: 'stack' });
  const addStop = (place = null) => {
    if (stops.length >= 4) return;
    const idx = stops.length;
    const si = placeInput({ id: `pr-stop-${Date.now()}-${idx}`, external: true, label: `${L('Stop', 'स्टॉप')} ${idx + 1}`, value: place, compact: true });
    const row = h('div', { class: 'stop-row' }, si.el, h('button', { type: 'button', class: 'icon-btn', 'aria-label': L('Remove stop', 'स्टॉप हटाएँ'), onclick: () => { stops.splice(stops.indexOf(si), 1); row.remove(); } }, '✕'));
    stops.push(si); stopsBox.append(row);
  };
  (r?.stops || []).forEach((s) => addStop(asPlace(s.place_id, s.lat != null ? s : null)));
  const dep = r ? new Date(r.departure_at) : null;
  const istParts = (d) => { const x = new Date(d.getTime() + 5.5 * 3600e3); return [x.toISOString().slice(0, 10), x.toISOString().slice(11, 16)]; };
  const [d0, t0] = dep ? istParts(dep) : [todayISO(1), '08:00'];
  const dateI = h('input', { class: 'input', id: 'pr-date', type: 'date', min: todayISO(), value: d0 });
  const timeI = h('input', { class: 'input', id: 'pr-time', type: 'time', value: t0 });
  const vehS = h('select', { class: 'input', id: 'pr-veh' }, vehicles.map((v) => h('option', { value: v.id }, `${v.model} · ${v.registration_no}`)));
  if (r?.vehicle_id) vehS.value = r.vehicle_id;
  const veh = () => vehicles.find((v) => v.id === vehS.value);
  let seats = r ? r.seats_total : veh().seats;
  const seatsOut = h('output', { class: 'stepper-n', id: 'pr-seats' }, String(seats));
  const stepSeats = (d) => { seats = Math.min(veh().seats, Math.max(r ? Math.max(1, r.seats_booked) : 1, seats + d)); seatsOut.textContent = String(seats); };
  const vehPic = h('div', { class: 'pr-vehpic' }, vehicleVisual(veh().model, { variantId: veh().variant_id }));
  vehS.addEventListener('change', () => { seats = Math.min(seats, veh().seats); seatsOut.textContent = String(seats); clear(vehPic).append(vehicleVisual(veh().model, { variantId: veh().variant_id })); });
  const priceI = h('input', { class: 'input', id: 'pr-price', type: 'number', min: 0, max: 100000, step: 10, value: r ? r.price_per_seat : '', placeholder: '500' });
  const pickI = h('input', { class: 'input', id: 'pr-pick', maxlength: 200, value: r?.pickup_point || '', placeholder: L('e.g. Rishikesh bus stand', 'जैसे ऋषिकेश बस स्टैंड') });
  const dropI = h('input', { class: 'input', id: 'pr-drop', maxlength: 200, value: r?.drop_point || '', placeholder: L('e.g. Mussoorie library chowk', 'जैसे मसूरी लाइब्रेरी चौक') });
  const instantI = h('input', { type: 'checkbox', id: 'pr-instant', role: 'switch' }); instantI.checked = r ? r.auto_confirm : false;
  const notesI = h('textarea', { class: 'input', id: 'pr-notes', rows: 3, maxlength: 500, value: r?.notes || '', placeholder: L('Luggage space, breaks, music…', 'सामान की जगह, रुकना, म्यूज़िक…') });
  notesI.value = r?.notes || '';
  if (locked) [dateI, timeI, vehS, priceI].forEach((x) => { x.disabled = true; });
  const err = h('p', { class: 'form-err', role: 'alert' });
  const root = h('div', { class: 'app-page' });

  const geoOf = (p) => ({ name: (placeName(p) || p.name || '').slice(0, 200), lat: +(+p.lat).toFixed(5), lng: +(+p.lng).toFixed(5) });
  const routeCache = {};
  // Road route through all points (free OSRM). Saved so passengers see the same distance and time.
  async function roadRoute(row) {
    const pts = [row.from_geo, ...row.stops, row.to_geo];
    const key = pts.map((p) => `${p.lat},${p.lng}`).join(';');
    if (routeCache[key]) return routeCache[key];
    const legs = [];
    for (let i = 1; i < pts.length; i += 1) legs.push(await fetchLeg(pts[i - 1], pts[i]));
    if (legs.some((l) => l.error)) return (routeCache[key] = { error: true, pts });
    const coords = legs.flatMap((l, i) => (i ? l.coords.slice(1) : l.coords));
    const step = Math.max(1, Math.ceil(coords.length / 450));
    const line = coords.filter((_, i) => i % step === 0 || i === coords.length - 1).map(([a, b]) => [+a.toFixed(4), +b.toFixed(4)]);
    return (routeCache[key] = { legs, pts, line, km: legs.reduce((x, l) => x + l.km, 0), secs: legs.reduce((x, l) => x + l.secs, 0) });
  }

  function collect() {
    if (!fromI.validate() || !toI.validate()) return { error: L('Choose the start and destination from the suggestions.', 'शुरुआत और मंज़िल सुझावों में से चुनें।') };
    if (stops.some((s) => !s.get())) return { error: L('Choose each stop from the suggestions, or remove it.', 'हर स्टॉप सुझावों में से चुनें या हटा दें।') };
    const pts = [fromI.get(), ...stops.map((s) => s.get()), toI.get()];
    const keys = pts.map((p) => p.id || `${(+p.lat).toFixed(3)},${(+p.lng).toFixed(3)}`);
    if (new Set(keys).size !== keys.length) return { error: L('Start, stops and destination must all be different.', 'शुरुआत, स्टॉप और मंज़िल अलग-अलग हों।') };
    if (pts.some((p) => p.lat == null || p.lng == null)) return { error: L('One of the places has no map position. Please choose it again.', 'किसी जगह की मैप पोज़िशन नहीं है। उसे फिर से चुनें।') };
    if (!dateI.value || !timeI.value) return { error: L('Choose the date and time.', 'तारीख़ और समय चुनें।') };
    const when = new Date(`${dateI.value}T${timeI.value}:00+05:30`);
    if (!locked && when <= new Date(Date.now() + 15 * 60e3)) return { error: L('Departure must be at least 15 minutes from now.', 'रवानगी अभी से कम से कम 15 मिनट बाद हो।') };
    const price = Number(priceI.value);
    if (priceI.value === '' || !(price >= 0 && price <= 100000)) return { error: L('Enter the contribution per seat (₹).', 'हर सीट का हिस्सा (₹) लिखें।') };
    const v = veh();
    return { row: {
      driver_id: user().id, vehicle_id: v.id, vehicle_model: v.model, vehicle_type: v.vehicle_type,
      from_place_id: fromI.get().id || null, to_place_id: toI.get().id || null,
      from_geo: geoOf(fromI.get()), to_geo: geoOf(toI.get()),
      stops: stops.map((s) => ({ place_id: s.get().id || null, name: s.get().name, lat: +s.get().lat, lng: +s.get().lng })),
      departure_at: when.toISOString(), seats_total: seats, price_per_seat: price,
      pickup_point: pickI.value.trim(), drop_point: dropI.value.trim(), auto_confirm: instantI.checked, notes: notesI.value.trim(),
    } };
  }

  async function review(row) {
    const pub = h('button', { class: 'btn btn-lg', type: 'button' }, r ? L('Save changes', 'बदलाव सेव करें') : L('Publish ride', 'राइड पब्लिश करें'));
    const rerr = h('p', { class: 'form-err', role: 'alert' });
    const routeBox = h('section', { class: 'panel stack' }, h('h2', {}, L('Route on the map', 'मैप पर रूट')), h('p', { class: 'muted small' }, L('Working out the road route…', 'सड़क का रूट निकाला जा रहा है…')));
    if (!locked) {
      pub.disabled = true;
      roadRoute(row).then((rt) => {
        clear(routeBox).append(h('h2', {}, L('Route on the map', 'मैप पर रूट')));
        const d = { start: { ...rt.pts[0] }, dests: rt.pts.slice(1).map((p) => ({ ...p })), roundTrip: false,
          route: rt.error ? null : { legs: rt.legs.map((l) => ({ ...l, ret: false })) } };
        routeBox.append(routeMap(d, { height: '280px' }).el);
        if (rt.error) {
          routeBox.append(h('p', { class: 'soft-note warn' }, L('The road route could not be worked out right now (map server busy or offline). You can still publish; travellers will see the start and end points.', 'अभी सड़क का रूट नहीं निकल पाया (मैप सर्वर व्यस्त या इंटरनेट नहीं)। फिर भी राइड डाल सकते हैं; यात्रियों को शुरुआत और मंज़िल दिखेगी।')));
        } else {
          row.route_line = rt.line; row.distance_km = Math.round(rt.km * 10) / 10; row.duration_min = Math.round(rt.secs / 60);
          const arrive = new Date(new Date(row.departure_at).getTime() + rt.secs * 1000);
          routeBox.append(h('div', { class: 'review-grid' },
            h('div', {}, h('span', { class: 'small muted' }, L('Distance', 'दूरी')), h('strong', {}, fmtKm(rt.km))),
            h('div', {}, h('span', { class: 'small muted' }, L('Driving time (estimate, no traffic)', 'ड्राइविंग समय (अनुमान, ट्रैफ़िक के बिना)')), h('strong', {}, fmtDur(rt.secs, getLang() === 'hi'))),
            h('div', {}, h('span', { class: 'small muted' }, L('Estimated arrival', 'अनुमानित पहुँच')), h('strong', {}, `${timeOf(arrive)}${dateOf(arrive) !== dateOf(row.departure_at) ? ` (${dateOf(arrive)})` : ''}`))));
        }
        pub.disabled = false;
      });
    }
    pub.addEventListener('click', () => busy(pub, async () => {
      if (r) {
        const { driver_id, ...patch } = row;
        if (locked) ['departure_at', 'price_per_seat', 'vehicle_id', 'from_place_id', 'to_place_id', 'from_geo', 'to_geo', 'stops', 'vehicle_model', 'vehicle_type', 'route_line', 'distance_km', 'duration_min'].forEach((k) => delete patch[k]);
        await q(sb.from('cab_rides').update(patch).eq('id', r.id));
        toast(L('Ride updated', 'राइड अपडेट हो गई'));
        location.hash = `#/drive/trip/${r.id}`;
      } else {
        const saved = await q(sb.from('cab_rides').insert(row).select().single());
        location.hash = `#/drive/trip/${saved.id}?new=1`;
      }
    }).catch((ex) => { rerr.textContent = ex.message; }));
    clear(root).append(
      h('div', { class: 'app-head' }, h('button', { class: 'app-back', type: 'button', 'aria-label': L('Back', 'पीछे'), onclick: () => { clear(root).append(...formView()); } }, '←'),
        h('div', { class: 'grow' }, h('h1', {}, L('Review your journey', 'अपनी यात्रा जाँच लें')), h('p', { class: 'muted' }, L('This is how travellers will see it.', 'यात्री इसे ऐसे देखेंगे।')))),
      h('div', { class: 'confirm-card' },
        h('div', { class: 'tl tl-lg' },
          h('div', { class: 'tl-row' }, h('span', { class: 'tl-dot' }), h('strong', {}, row.from_geo.name), h('span', { class: 'tl-time' }, timeOf(row.departure_at))),
          row.pickup_point ? h('div', { class: 'tl-note' }, L('Pickup: ', 'पिकअप: ') + row.pickup_point) : null,
          ...row.stops.map((s) => h('div', { class: 'tl-row tl-via' }, h('span', { class: 'tl-dot small' }), h('span', {}, s.name))),
          h('div', { class: 'tl-row' }, h('span', { class: 'tl-dot end' }), h('strong', {}, row.to_geo.name)),
          row.drop_point ? h('div', { class: 'tl-note' }, L('Drop: ', 'ड्रॉप: ') + row.drop_point) : null),
        h('div', { class: 'review-grid' },
          h('div', {}, h('span', { class: 'small muted' }, L('Date', 'तारीख़')), h('strong', {}, dateOf(row.departure_at))),
          h('div', {}, h('span', { class: 'small muted' }, L('Vehicle', 'गाड़ी')), h('strong', {}, row.vehicle_model)),
          h('div', {}, h('span', { class: 'small muted' }, L('Seats', 'सीटें')), h('strong', {}, String(row.seats_total))),
          h('div', {}, h('span', { class: 'small muted' }, L('Per seat', 'प्रति सीट')), h('strong', {}, inr(row.price_per_seat))),
          h('div', {}, h('span', { class: 'small muted' }, L('Booking', 'बुकिंग')), h('strong', {}, row.auto_confirm ? L('Instant book', 'तुरंत बुकिंग') : L('You approve each request', 'हर रिक्वेस्ट आप मंज़ूर करेंगे')))),
        row.notes ? h('p', { class: 'small' }, row.notes) : null),
      locked ? null : routeBox,
      rerr,
      h('div', { class: 'row-actions' }, h('button', { class: 'btn btn-ghost btn-lg', type: 'button', onclick: () => { clear(root).append(...formView()); } }, L('Edit', 'बदलें')), pub));
    window.scrollTo({ top: 0 });
  }

  const formView = () => [
    h('div', { class: 'app-head' }, back(r ? `#/drive/trip/${r.id}` : '#/drive'),
      h('h1', {}, r ? L('Edit ride', 'राइड बदलें') : L('Publish new ride', 'नई राइड पब्लिश करें'))),
    locked ? h('p', { class: 'soft-note warn' }, L('Passengers have booked this ride, so route, time, vehicle and price are locked. To change them, cancel the ride.', 'इस राइड पर यात्री बुक कर चुके हैं, इसलिए रूट, समय, गाड़ी और किराया नहीं बदल सकते। बदलने के लिए राइड रद्द करें।')) : null,
    h('form', { class: 'stack', novalidate: true, onsubmit: (e) => { e.preventDefault(); clear(err); const c = collect(); if (c.error) { err.textContent = c.error; return; } review(c.row); } },
      h('section', { class: 'panel stack' }, h('h2', {}, L('Route details', 'रूट')),
        locked ? h('p', {}, routeLabel(r)) : [fromI.el, stopsBox,
          h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => addStop() }, '+ ', L('Add a stop (optional)', 'स्टॉप जोड़ें (वैकल्पिक)')), toI.el],
        h('div', { class: 'row2' },
          h('label', { class: 'field', for: 'pr-pick' }, h('span', { class: 'field-label' }, L('Pickup point', 'पिकअप की जगह')), pickI),
          h('label', { class: 'field', for: 'pr-drop' }, h('span', { class: 'field-label' }, L('Drop point', 'ड्रॉप की जगह')), dropI))),
      h('section', { class: 'panel stack' }, h('h2', {}, L('Date and time', 'तारीख़ और समय')),
        h('div', { class: 'row2' },
          h('label', { class: 'field', for: 'pr-date' }, h('span', { class: 'field-label' }, L('Journey date', 'यात्रा की तारीख़')), dateI),
          h('label', { class: 'field', for: 'pr-time' }, h('span', { class: 'field-label' }, L('Departure time', 'रवानगी का समय')), timeI))),
      h('section', { class: 'panel stack' }, h('h2', {}, L('Vehicle and seats', 'गाड़ी और सीटें')),
        h('label', { class: 'field', for: 'pr-veh' }, h('span', { class: 'field-label' }, L('Vehicle', 'गाड़ी')), vehS), vehPic,
        h('a', { class: 'small', href: '#/drive/profile' }, L('Add another vehicle', 'दूसरी गाड़ी जोड़ें')),
        h('div', { class: 'row2' },
          h('div', { class: 'field' }, h('span', { class: 'field-label', id: 'pr-seats-l' }, L('Available seats', 'खाली सीटें')),
            h('div', { class: 'stepper', role: 'group', 'aria-labelledby': 'pr-seats-l' },
              h('button', { type: 'button', 'aria-label': L('Fewer seats', 'कम सीट'), onclick: () => stepSeats(-1) }, '−'), seatsOut,
              h('button', { type: 'button', 'aria-label': L('More seats', 'ज़्यादा सीट'), onclick: () => stepSeats(1) }, '+'))),
          h('label', { class: 'field', for: 'pr-price' }, h('span', { class: 'field-label' }, L('Contribution per seat (₹)', 'हर सीट का हिस्सा (₹)')), priceI)),
        h('label', { class: 'switch-row', for: 'pr-instant' }, h('span', {}, h('strong', {}, L('Instant book', 'तुरंत बुकिंग')),
          h('span', { class: 'small muted' }, L('Bookings are confirmed at once. Turn off to approve each request yourself.', 'बुकिंग तुरंत कन्फ़र्म होगी। बंद रखें तो हर रिक्वेस्ट आप ख़ुद मंज़ूर करेंगे।'))), instantI)),
      h('section', { class: 'panel stack' }, h('label', { class: 'field', for: 'pr-notes' }, h('span', { class: 'field-label' }, L('Journey notes (optional)', 'यात्रा की बातें (वैकल्पिक)')), notesI)),
      err,
      h('button', { class: 'btn btn-block btn-lg', type: 'submit' }, L('Review journey', 'यात्रा जाँचें'), icon('arrow', 16))),
  ].filter(Boolean);
  root.append(...formView());
  return root;
}

// ---------- My rides ----------
export async function rides({ query }) {
  if (!user()) return needLogin('drive/rides');
  await allPlaces();
  const all = await q(sb.from('cab_rides').select('*').eq('driver_id', user().id).order('departure_at', { ascending: false }).limit(300));
  const groups = {
    active: all.filter(isActive).reverse(),
    history: all.filter((r) => r.status !== 'cancelled' && !isActive(r)),
    cancelled: all.filter((r) => r.status === 'cancelled'),
  };
  const tab = groups[query.tab] ? query.tab : 'active';
  const label = { active: L('Active', 'चालू'), history: L('Completed', 'पूरी'), cancelled: L('Cancelled', 'रद्द') };
  return h('div', { class: 'app-page' },
    h('div', { class: 'app-head' }, back('#/drive'), h('h1', {}, L('My published rides', 'मेरी पब्लिश राइड'))),
    h('nav', { class: 'seg-tabs' }, Object.keys(groups).map((k) => h('a', { href: `#/drive/rides?tab=${k}`, class: k === tab ? 'on' : '' }, `${label[k]} (${groups[k].length})`))),
    groups[tab].length ? h('div', { class: 'stack' }, groups[tab].map(rideRow))
      : h('div', { class: 'empty-state' }, h('span', { class: 'empty-ico' }, icon('car', 30)), h('p', { class: 'muted' }, L('No rides here.', 'यहाँ कोई राइड नहीं।'))),
    h('a', { class: 'btn btn-block btn-lg', href: '#/drive/publish' }, '+ ', L('Publish new ride', 'नई राइड पब्लिश करें')));
}

function rideRow(r) {
  const live = ['open', 'full'].includes(r.status) && isUpcoming(r);
  return h('article', { class: 'bk-card' },
    h('div', { class: 'bk-top' }, h('strong', { class: 'bk-route' }, routeLabel(r)), statusPill(r.status, r.departure_at)),
    r.ride_ref ? h('div', { class: 'small mono muted' }, r.ride_ref) : null,
    h('div', { class: 'small muted' }, `${dateOf(r.departure_at)} · ${timeOf(r.departure_at)}`),
    h('div', { class: 'small' }, `${r.seats_booked}/${r.seats_total} ${L('seats booked', 'सीट बुक')} · ${inr(r.price_per_seat)} / ${L('seat', 'सीट')}`, r.is_test ? h('span', { class: 'pill pill-warn' }, ' TEST') : null),
    h('div', { class: 'row-actions' },
      h('a', { class: r.status === 'started' ? 'btn btn-sm' : 'btn btn-ghost btn-sm', href: `#/drive/trip/${r.id}` }, r.status === 'started' ? L('Open trip', 'ट्रिप खोलें') : L('Trip details', 'ट्रिप की जानकारी')),
      live ? h('a', { class: 'btn btn-ghost btn-sm', href: `#/drive/ride/${r.id}/edit` }, L('Edit', 'बदलें')) : null,
      live ? h('button', { class: 'btn btn-danger-ghost btn-sm', type: 'button', onclick: () => cancelRide(r) }, L('Cancel ride', 'राइड रद्द करें')) : null));
}

function cancelRide(r) {
  const yes = h('button', { class: 'btn btn-danger', type: 'button' }, L('Yes, cancel ride', 'हाँ, राइड रद्द करें'));
  const dlg = modal(L('Cancel this ride?', 'यह राइड रद्द करें?'), h('div', { class: 'stack' },
    h('p', {}, r.seats_booked ? L('All passengers on this ride will be told and their bookings cancelled.', 'इस राइड के सभी यात्रियों को सूचना जाएगी और उनकी बुकिंग रद्द होगी।') : L('Travellers will no longer see this ride.', 'यात्री यह राइड अब नहीं देखेंगे।')),
    h('div', { class: 'row-actions' }, h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => dlg.close() }, L('Keep ride', 'राइड रखें')), yes)));
  yes.addEventListener('click', () => busy(yes, async () => {
    await q(sb.rpc('cancel_cab_ride', { p_ride: r.id }));
    dlg.close(); toast(L('Ride cancelled', 'राइड रद्द हो गई'));
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  }));
}

// ---------- Requests ----------
export async function requests({ query }) {
  if (!user()) return needLogin('drive/requests');
  await allPlaces();
  const myRides = await q(sb.from('cab_rides').select('*').eq('driver_id', user().id).limit(300));
  const ids = myRides.map((r) => r.id);
  const rows = ids.length ? await q(sb.from('cab_bookings').select('*').in('ride_id', ids).order('created_at', { ascending: false })) : [];
  const rideOf = (b) => myRides.find((r) => r.id === b.ride_id);
  const groups = {
    new: rows.filter((b) => b.status === 'pending' && isUpcoming(rideOf(b))),
    accepted: rows.filter((b) => b.status === 'confirmed' && isActive(rideOf(b))),
    closed: rows.filter((b) => ['declined', 'cancelled', 'expired'].includes(b.status)),
  };
  const tab = groups[query.tab] ? query.tab : 'new';
  const label = { new: L('New', 'नई'), accepted: L('Accepted', 'मंज़ूर'), closed: L('Closed', 'बंद') };
  return h('div', { class: 'app-page' },
    h('div', { class: 'app-head' }, back('#/drive'), h('h1', {}, L('Ride requests', 'राइड रिक्वेस्ट'))),
    h('nav', { class: 'seg-tabs' }, Object.keys(groups).map((k) => h('a', { href: `#/drive/requests?tab=${k}`, class: k === tab ? 'on' : '' }, `${label[k]} (${groups[k].length})`))),
    groups[tab].length ? h('div', { class: 'stack' }, groups[tab].map((b) => requestCard(b, rideOf(b))))
      : h('div', { class: 'empty-state' }, h('span', { class: 'empty-ico' }, icon('people', 30)), h('p', { class: 'muted' }, L('No requests here.', 'यहाँ कोई रिक्वेस्ट नहीं।'))));
}

function requestCard(b, r) {
  const actions = b.status === 'pending' && isUpcoming(r);
  const answer = (accept, btn) => busy(btn, async () => {
    await q(sb.rpc('respond_cab_request', { p_booking: b.id, p_accept: accept }));
    toast(accept ? L('Passenger accepted', 'यात्री मंज़ूर') : L('Request declined', 'रिक्वेस्ट मना की'));
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
  const dec = h('button', { class: 'btn btn-danger-ghost btn-sm', type: 'button' }, L('Decline', 'मना करें'));
  const acc = h('button', { class: 'btn btn-sm', type: 'button' }, L('Accept', 'मंज़ूर करें'));
  dec.addEventListener('click', () => answer(false, dec)); acc.addEventListener('click', () => answer(true, acc));
  return h('article', { class: 'bk-card' },
    h('div', { class: 'bk-top' }, h('strong', { class: 'bk-route' }, routeLabel(r)), h('span', { class: 'small muted mono' }, refOf(b))),
    h('div', { class: 'small muted' }, `${dateOf(r.departure_at)} · ${timeOf(r.departure_at)}`),
    h('div', { class: 'driver-head' }, avatar('', b.passenger_name),
      h('div', { class: 'grow' }, h('strong', {}, b.passenger_name),
        h('div', { class: 'small' }, `${b.seats} ${L('seat(s)', 'सीट')} · ${L('Seats', 'सीट')} ${(b.seat_numbers || []).join(', ')} · ${inr(b.seats * r.price_per_seat)}`)),
      b.status === 'pending' ? h('span', { class: 'pill pill-warn' }, L('Needs your answer', 'आपका जवाब चाहिए')) : statusPill(b.status, r.departure_at)),
    b.note ? h('p', { class: 'small' }, `“${b.note}”`) : null,
    actions && b.hold_expires_at ? holdTimer(b.hold_expires_at, L('Answer within', 'इतने समय में जवाब दें:')) : null,
    b.status === 'confirmed' ? h('div', { class: 'row-actions' }, h('a', { class: 'btn btn-ghost btn-sm', href: `tel:${b.phone}` }, L('Call', 'कॉल करें')), h('span', { class: 'small muted selectable' }, b.phone)) : null,
    actions ? h('div', { class: 'row-actions' }, dec, acc) : null);
}

// ---------- Trip details ----------
export async function trip({ params, query }) {
  if (!user()) return needLogin(`drive/trip/${params.id}`);
  const places = await allPlaces();
  const r = await q(sb.from('cab_rides').select('*').eq('id', params.id).eq('driver_id', user().id).maybeSingle());
  if (!r) return h('div', { class: 'app-page' }, h('div', { class: 'app-head' }, back('#/drive/rides'), h('h1', {}, L('Ride not found', 'राइड नहीं मिली'))));
  const books = await q(sb.from('cab_bookings').select('*').eq('ride_id', r.id).order('created_at'));
  const confirmed = books.filter((b) => b.status === 'confirmed');
  const pending = books.filter((b) => b.status === 'pending');
  const path = ridePath(r, places);
  const live = ['open', 'full'].includes(r.status) && isUpcoming(r);
  const total = confirmed.reduce((s, b) => s + b.seats * r.price_per_seat, 0);
  if (query.new === '1') {
    setTimeout(() => {
      if (!location.hash.startsWith(`#/drive/trip/${r.id}`)) return;
      history.replaceState(null, '', `#/drive/trip/${r.id}`);
      const dlg = celebrate({
        title: L('Your ride is published!', 'आपकी राइड पब्लिश हो गई!'),
        message: L('Travellers searching this route can now find and book it.', 'इस रूट को खोजने वाले यात्री अब इसे देखकर बुक कर सकते हैं।'),
        rows: [[L('Ride ID', 'राइड आईडी'), r.ride_ref], [L('Route', 'रूट'), routeLabel(r)], [L('Departure', 'रवानगी'), `${dateOf(r.departure_at)} · ${timeOf(r.departure_at)}`],
          [L('Vehicle', 'गाड़ी'), r.vehicle_model], [L('Seats', 'सीटें'), String(r.seats_total)], [L('Booking', 'बुकिंग'), r.auto_confirm ? L('Instant book', 'तुरंत बुकिंग') : L('You approve each request (15 min to answer)', 'हर रिक्वेस्ट आप मंज़ूर करेंगे (जवाब के लिए 15 मिनट)')]],
        actions: [h('button', { class: 'btn btn-block', type: 'button', onclick: () => dlg.close() }, L('View ride', 'राइड देखें')),
          h('a', { class: 'btn btn-ghost btn-block', href: '#/drive' }, L('Go to dashboard', 'डैशबोर्ड पर जाएँ'))],
      });
    }, 60);
  }
  const lc = lifecycle(r, confirmed.length);
  return h('div', { class: 'app-page' },
    h('div', { class: 'app-head' }, back('#/drive/rides'), h('div', { class: 'grow' }, h('h1', {}, L('Trip details', 'ट्रिप की जानकारी'))), statusPill(r.status, r.departure_at)),
    r.status === 'started' ? h('p', { class: 'soft-note ok' }, L('Ride in progress. Tap “Complete ride” when everyone is dropped.', 'राइड चल रही है। सबको छोड़ने के बाद “राइड पूरी करें” दबाएँ।')) : null,
    lc ? h('div', { class: 'stack' }, lc) : (['open', 'full'].includes(r.status) && confirmed.length && isUpcoming(r)
      ? h('p', { class: 'small muted' }, L('“Start ride” appears 3 hours before departure.', '“राइड शुरू करें” रवानगी से 3 घंटे पहले दिखेगा।')) : null),
    h('div', { class: 'confirm-card' },
      h('strong', {}, routeLabel(r)), r.ride_ref ? h('span', { class: 'small mono muted' }, `${L('Ride ID', 'राइड आईडी')} ${r.ride_ref}`) : null,
      h('p', { class: 'small muted' }, `${dateOf(r.departure_at)} · ${timeOf(r.departure_at)}`),
      h('div', { class: 'tl' },
        h('div', { class: 'tl-row' }, h('span', { class: 'tl-dot' }), h('span', {}, L('Pickup: ', 'पिकअप: ') + (r.pickup_point || endName(r, 'from')))),
        ...(r.stops || []).map((s) => h('div', { class: 'tl-row tl-via' }, h('span', { class: 'tl-dot small' }), h('span', {}, placeName(placeById(s.place_id))))),
        h('div', { class: 'tl-row' }, h('span', { class: 'tl-dot end' }), h('span', {}, L('Drop: ', 'ड्रॉप: ') + (r.drop_point || endName(r, 'to'))))),
      h('div', { class: 'small' }, `${r.vehicle_model} · ${r.seats_booked}/${r.seats_total} ${L('seats booked', 'सीट बुक')} · ${r.auto_confirm ? L('Instant book', 'तुरंत बुकिंग') : L('You approve requests', 'रिक्वेस्ट आप मंज़ूर करते हैं')}`)),
    h('section', {}, h('h2', {}, `${L('Passengers', 'यात्री')} (${confirmed.length})`),
      confirmed.length ? h('div', { class: 'stack' }, confirmed.map((b) => requestCard(b, r))) : h('p', { class: 'soft-note' }, L('No confirmed passengers yet.', 'अभी कोई कन्फ़र्म यात्री नहीं।'))),
    pending.length ? h('section', {}, h('h2', {}, `${L('Waiting for your answer', 'आपके जवाब का इंतज़ार')} (${pending.length})`), h('div', { class: 'stack' }, pending.map((b) => requestCard(b, r)))) : null,
    h('section', { class: 'panel' }, h('h2', {}, L('Fare details', 'किराए का हिसाब')),
      h('div', { class: 'fare-row' }, h('span', {}, L('Per seat', 'प्रति सीट')), h('span', {}, inr(r.price_per_seat))),
      h('div', { class: 'fare-row total' }, h('span', {}, L('You receive (confirmed seats)', 'आपको मिलेगा (कन्फ़र्म सीटें)')), h('strong', {}, inr(total))),
      h('p', { class: 'small muted' }, L('Passengers pay you directly.', 'यात्री आपको सीधे भुगतान करते हैं।'))),
    live ? h('div', { class: 'row-actions' },
      h('a', { class: 'btn btn-ghost', href: `#/drive/ride/${r.id}/edit` }, L('Edit ride', 'राइड बदलें')),
      h('button', { class: 'btn btn-danger-ghost', type: 'button', onclick: () => cancelRide(r) }, L('Cancel ride', 'राइड रद्द करें'))) : null);
}

// ---------- Profile and vehicles ----------
export async function profile() {
  if (!user()) return needLogin('drive/profile');
  const { profile: dp } = await me();
  if (!dp) return onboarding();
  const allVeh = await q(sb.from('vehicles').select('*').eq('owner_id', user().id).order('created_at'));
  const nameI = h('input', { class: 'input', id: 'dp-name', value: dp.full_name, minlength: 2 });
  const phoneI = h('input', { class: 'input', id: 'dp-phone', type: 'tel', value: dp.phone });
  const aboutI = h('textarea', { class: 'input', id: 'dp-about', rows: 3, maxlength: 500 }); aboutI.value = dp.about || '';
  const save = h('button', { class: 'btn btn-sm', type: 'submit' }, L('Save', 'सेव करें'));
  const vf = vehicleFields();
  const addBtn = h('button', { class: 'btn btn-sm', type: 'submit' }, L('Add vehicle', 'गाड़ी जोड़ें'));
  const verr = h('p', { class: 'form-err', role: 'alert' });
  return h('div', { class: 'app-page' },
    h('div', { class: 'app-head' }, back('#/drive'), h('h1', {}, L('Profile and vehicle', 'प्रोफ़ाइल और गाड़ी'))),
    h('div', { class: 'welcome' }, avatar(dp.photo_url || state.profile?.avatar_url, dp.full_name, 'av av-lg'),
      h('div', { class: 'grow' }, h('h2', {}, dp.full_name),
        dp.is_verified ? h('span', { class: 'badge-verified' }, '✓ ', L('Verified by admin', 'एडमिन से वेरिफ़ाइड')) : h('span', { class: 'badge-new' }, L('Not verified yet', 'अभी वेरिफ़ाइड नहीं')))),
    h('form', { class: 'panel stack', onsubmit: (e) => { e.preventDefault(); busy(save, async () => {
      if (phoneI.value.replace(/\D/g, '').length < 10) throw new Error(L('Please enter a 10-digit mobile number.', '10 अंकों का मोबाइल नंबर लिखें।'));
      await q(sb.from('driver_profiles').update({ full_name: nameI.value.trim(), phone: phoneI.value.trim(), about: aboutI.value.trim() }).eq('user_id', user().id));
      toast(L('Saved', 'सेव हो गया'));
    }); } },
      h('h2', {}, L('Driver profile', 'ड्राइवर प्रोफ़ाइल')),
      h('label', { class: 'field', for: 'dp-name' }, h('span', { class: 'field-label' }, L('Full name', 'पूरा नाम')), nameI),
      h('label', { class: 'field', for: 'dp-phone' }, h('span', { class: 'field-label' }, L('Mobile number', 'मोबाइल नंबर')), phoneI),
      h('label', { class: 'field', for: 'dp-about' }, h('span', { class: 'field-label' }, L('About you', 'आपके बारे में')), aboutI),
      save),
    h('section', { class: 'panel stack' }, h('h2', {}, L('My vehicles', 'मेरी गाड़ियाँ')),
      allVeh.length ? allVeh.map((v) => h('div', { class: 'veh-row' },
        vehicleVisual(v.model, { size: 'sm', variantId: v.variant_id }), h('div', { class: 'grow' }, h('strong', {}, v.model), h('div', { class: 'small muted' }, `${v.registration_no} · ${v.seats} ${L('passenger seats', 'यात्री सीटें')}${v.has_ac ? ' · AC' : ''}${v.variant_id ? '' : ` · ${L('not from the list', 'सूची से नहीं')}`}`)),
        h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: async (e) => {
          await busy(e.currentTarget, async () => { await q(sb.from('vehicles').update({ is_active: !v.is_active }).eq('id', v.id)); window.dispatchEvent(new HashChangeEvent('hashchange')); });
        } }, v.is_active ? L('Hide', 'छिपाएँ') : L('Use again', 'फिर से इस्तेमाल करें')))) : h('p', { class: 'muted' }, L('No vehicle yet.', 'अभी कोई गाड़ी नहीं।'))),
    h('form', { class: 'panel stack', novalidate: true, onsubmit: (e) => { e.preventDefault(); clear(verr); const v = vf.value(); if (v.error) { verr.textContent = v.error; return; }
      busy(addBtn, async () => { await q(sb.from('vehicles').insert({ owner_id: user().id, ...v.row })); toast(L('Vehicle added', 'गाड़ी जुड़ गई')); window.dispatchEvent(new HashChangeEvent('hashchange')); }); } },
      h('h2', {}, L('Add a vehicle', 'गाड़ी जोड़ें')), vf.el, verr, addBtn),
    h('section', { class: 'panel stack' }, h('h2', {}, L('Settings', 'सेटिंग')),
      h('a', { class: 'menu-item', href: '#/cab/me' }, h('span', { class: 'grow' }, L('Switch to traveller mode', 'यात्री मोड पर जाएँ')), h('span', { class: 'chev' }, '›')),
      h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: async () => { await sb.auth.signOut(); location.hash = '#/cab'; location.reload(); } }, L('Log out', 'लॉग आउट'))));
}
