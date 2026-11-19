// Trip Summary (the "Trip Report" page, laid out like the owner's reference picture).
// Works for the draft on this device and for a saved or shared trip.
import { h, clear, toast, icon, inr, lazy, localPhotos, art } from '../ui.js';
import { getLang, pick } from '../i18n.js';
import { locations, themes, user } from '../store.js';
import { allPlaces, placeName } from '../places.js';
import { fetchListings, listingCard } from '../pages/listings.js';
import { L, PREFS, PACES, MODES, loadDraft, saveDraft, pName, fmtD, validate, steps } from './common.js';
import { routeMap, weatherChip, generate, itinKey, prefThemes } from './steps.js';
import {
  routeIsFresh, pickLeg, fmtKm, fmtDur, computeBudget, placesAlong, legPairs, tripPoints, weatherFor, weatherWarnings, seasonNotes, distanceKm, getJSON, BREAK_FACTOR,
} from './engine.js';
import { saveTrip, shareTrip, editInPlanner, duplicateTrip, deleteTrip } from './save.js';

const OVERPASS = 'https://overpass-api.de/api/interpreter';
const hi = () => getLang() === 'hi';
const dur = (s) => fmtDur(s, hi());

export async function summaryStep() {
  const d = loadDraft();
  if (!d || Object.keys(validate(d)).length) { location.hash = '#/plan/new'; return h('div'); }
  if (!routeIsFresh(d)) { location.hash = '#/plan/route'; return h('div'); }
  if (!d.days || (d.daysKey !== itinKey(d) && !d.daysEdited)) {
    const [places, locs, listings] = await Promise.all([allPlaces(), locations(), fetchListings('homestay').catch(() => [])]);
    generate(d, { places, locs, listings });
  }
  return tripReport(d, { mode: 'draft' });
}

// mode: 'draft' (editable, on this device) | 'saved' (owner's saved trip) | 'shared' (read-only link)
export async function tripReport(d, { mode = 'draft' } = {}) {
  const [places, locs, themeList, listings] = await Promise.all([allPlaces(), locations(), themes(), fetchListings('homestay').catch(() => [])]);
  const main = d.dests[d.dests.length - 1];
  const mainLoc = main.location_id ? locs.find((l) => l.id === main.location_id) : null;
  const n = d.days?.length || Math.round((new Date(d.ret) - new Date(d.depart)) / 864e5) + 1;
  const b = computeBudget(d, d.route, d.days);
  const routeLine = tripPoints(d).map(pName).join(' → ');
  const prefNames = d.prefs.map((k) => PREFS.find((p) => p[0] === k)).filter(Boolean).map((p) => L(p[1], p[2]));
  const modeRow = MODES.find((m) => m[0] === d.mode);
  const own = ['car', 'bike'].includes(d.mode);
  const osmP = loadOsm(d).catch(() => null);
  const shareText = `${d.title || L('Trip report', 'ट्रिप रिपोर्ट')}: ${routeLine} (${n} ${L('days', 'दिन')}) — The Himalayan Horizon`;

  const actions = h('div', { class: 'tr-actbar no-print' });
  if (mode === 'draft') {
    const saveBtn = h('button', { type: 'button', class: 'btn', onclick: () => saveTrip(d, saveBtn) }, d.tripId ? L('Save changes', 'बदलाव सेव करें') : L('Save trip', 'ट्रिप सेव करें'));
    actions.append(
      h('a', { class: 'btn btn-ghost', href: '#/plan/new' }, L('Edit trip', 'ट्रिप बदलें')),
      saveBtn,
      h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => { d.days = null; d.daysEdited = false; saveDraft(d); location.hash = '#/plan/itinerary'; } }, L('Regenerate itinerary', 'प्लान फिर बनाएँ')));
  } else if (mode === 'saved') {
    const delBtn = h('button', { type: 'button', class: 'btn btn-ghost tr-danger', onclick: async () => {
      if (delBtn.dataset.armed !== '1') { delBtn.dataset.armed = '1'; delBtn.textContent = L('Tap again to delete', 'हटाने के लिए फिर टैप करें'); return; }
      await deleteTrip(d.tripId); location.hash = '#/trips';
    } }, L('Delete', 'हटाएँ'));
    actions.append(
      h('button', { type: 'button', class: 'btn', onclick: () => editInPlanner(d) }, L('Edit trip', 'ट्रिप बदलें')),
      h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => editInPlanner(d, 'plan/budget') }, L('Track expenses', 'ख़र्च लिखें')),
      h('button', { type: 'button', class: 'btn btn-ghost', onclick: async () => { const id = await duplicateTrip(d); if (id) location.hash = `#/trip/${id}`; } }, L('Duplicate', 'कॉपी बनाएँ')),
      delBtn);
  }
  actions.append(
    h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => shareTrip(d, shareText, mode) }, L('Share trip', 'ट्रिप शेयर करें')),
    h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => window.print() }, L('Download PDF', 'PDF डाउनलोड')));
  const heroImg = mainLoc?.image_url || localPhotos[mainLoc?.slug] || 'img/home/hero.jpg';
  const page = h('div', { class: 'tr' },
    mode === 'draft' ? h('div', { class: 'wrap no-print tr-steps' }, steps(5)) : null,
    h('section', { class: 'tr-hero' },
      h('img', { src: heroImg, alt: '' }),
      h('div', { class: 'tr-hero-in' },
        h('div', { class: 'tr-hero-text' },
          d.title ? h('p', { class: 'tr-eyebrow' }, d.title) : null,
          h('h1', {}, L('Trip Report', 'ट्रिप रिपोर्ट')),
          h('p', { class: 'tr-route' }, `${routeLine} (${n} ${L(n > 1 ? 'Days' : 'Day', 'दिन')})`),
          prefNames.length ? h('p', { class: 'tr-themes' }, prefNames.slice(0, 4).join('  •  ')) : null),
        h('p', { class: 'tr-script', 'aria-hidden': 'true' }, 'Explore', h('br'), 'Plan', h('br'), 'Travel'))),
    actions,
    summaryBar(d, n, modeRow, own),
    h('div', { class: 'tr-grid' },
      h('section', { class: 'tr-card tr-a' }, head(1, L('Route overview', 'रूट की जानकारी')), routeOverview(d, places)),
      h('section', { class: 'tr-card tr-b' }, head(2, L('Interactive route map', 'मैप पर रास्ता')), mapCard(d, osmP)),
      h('section', { class: 'tr-card tr-c' }, head(3, L('Distance & cost summary', 'दूरी और ख़र्च')), lazy(async () => costCard(d, b, await osmP, own))),
      h('section', { class: 'tr-card tr-d' }, head(4, `${L('Places to see in', 'घूमने की जगहें:')} ${pName(main)} ${L('& nearby', 'और आसपास')}`,
        h('a', { class: 'btn btn-sm no-print', href: '#/explore' }, L('View all places', 'सभी जगहें'), icon('arrow', 14))), placesCard(d, places, locs, themeList)),
      h('section', { class: 'tr-card tr-e' }, head(5, `${L('Day-wise plan', 'दिन-वार प्लान')} (${n} ${L(n > 1 ? 'days' : 'day', 'दिन')})`,
        mode === 'draft' ? h('a', { class: 'btn btn-ghost btn-sm no-print', href: '#/plan/itinerary' }, L('Edit', 'बदलें')) : null), dayList(d)),
      h('section', { class: 'tr-card tr-f' }, head(6, L('Stay options', 'रुकने की जगहें'), h('a', { class: 'btn btn-ghost btn-sm no-print', href: '#/stays' }, L('View more', 'और देखें'), icon('arrow', 14))), staysCard(d, listings, locs)),
      h('section', { class: 'tr-card tr-g' }, head(7, L('Food & fuel stops', 'खाना और पेट्रोल पंप')), lazy(async () => foodFuel(d, await osmP))),
      h('section', { class: 'tr-card tr-h' }, head(8, L('Safety & live information', 'सुरक्षा और लाइव जानकारी')), lazy(async () => safety(d, await osmP)))),
    notesCard(d),
    h('footer', { class: 'tr-sources' },
      h('strong', {}, L('Data sources:', 'डेटा स्रोत:')),
      ['OpenStreetMap', 'OSRM routing', 'Overpass (OSM points)', 'Open-Meteo weather', 'IMD', 'USDMA', 'The Himalayan Horizon listings'].map((s) => h('span', {}, s)),
      h('p', { class: 'tr-note' }, L('Distances and times come from OpenStreetMap routing; costs are your estimates, not quotes. Stays are suggestions for enquiry, not bookings. Check road, weather and opening times before you travel.',
        'दूरी और समय OpenStreetMap रूटिंग से हैं; ख़र्च आपके अनुमान हैं, कोटेशन नहीं। रुकने की जगहें पूछताछ के सुझाव हैं, बुकिंग नहीं। यात्रा से पहले सड़क, मौसम और खुलने का समय जाँच लें।'))));
  return page;
}

const head = (no, title, action) => h('div', { class: 'tr-head' }, h('span', { class: 'tr-no' }, String(no)), h('h2', {}, title), action || null);
const row = (ic, cls, label, value, ...sub) => h('div', { class: 'tr-row' }, h('span', { class: `tr-ico ${cls}` }, icon(ic, 19)),
  h('div', { class: 'tr-rowtext' }, label ? h('span', { class: 'tr-label' }, label) : null, h('strong', {}, value), ...sub.filter(Boolean).map((s) => (typeof s === 'string' ? h('span', { class: 'tr-sub' }, s) : s))));

function summaryBar(d, n, modeRow, own) {
  const item = (ic, label, value, sub) => h('div', { class: 'tr-sum-item' }, h('span', { class: 'tr-sum-ico' }, icon(ic, 22)),
    h('div', {}, h('span', { class: 'tr-sum-label' }, label), h('strong', {}, value), sub ? h('span', { class: 'tr-sum-sub' }, sub) : null));
  const main = d.dests[d.dests.length - 1];
  const people = d.adults + d.children;
  return h('section', { class: 'tr-sum' },
    item('map', L('Start point', 'शुरुआत'), pName(d.start), d.start.district && d.start.district !== d.start.name ? d.start.district : null),
    item('mountain', d.dests.length > 1 ? L('Destinations', 'मंज़िलें') : L('Destination', 'मंज़िल'), d.dests.length > 1 ? d.dests.map(pName).join(', ') : pName(main), main.district ? `${main.district}${main.region && main.region !== 'Other' ? ', Uttarakhand' : ''}` : null),
    item('home', L('Duration', 'अवधि'), `${n} ${L(n > 1 ? 'Days' : 'Day', 'दिन')}`, `${fmtD(d.depart)} – ${fmtD(d.ret)}`),
    item('people', L('Travellers', 'यात्री'), String(people), d.children ? `${d.adults} ${L(d.adults > 1 ? 'adults' : 'adult', 'वयस्क')}, ${d.children} ${L(d.children > 1 ? 'children' : 'child', 'बच्चे')}` : null),
    item('car', L('Travel mode', 'साधन'), modeRow ? L(modeRow[1], modeRow[2]) : '—'),
    own ? item('leaf', L('Mileage', 'माइलेज'), `${(d.assumptions?.mileage) || '—'} km/l`) : null,
    item('globe', L('Trip type', 'ट्रिप का प्रकार'), d.roundTrip !== false ? L('Round trip', 'आना-जाना') : L('One way', 'एक तरफ़'), d.dests.length > 1 ? `${d.dests.length} ${L('stops', 'पड़ाव')}` : null));
}

function routeOverview(d, places) {
  const r = d.route;
  if (!r) return h('p', { class: 'soft-note warn' }, L('Route not calculated yet.', 'रूट अभी नहीं निकला।'));
  const pairs = legPairs(d);
  const out = h('div', { class: 'tr-rows' },
    row('map', 'g', L('Total distance', 'कुल दूरी'), fmtKm(r.total_km), r.missing ? L(`${r.missing} stretch(es) not calculated`, `${r.missing} हिस्से नहीं निकले`) : (d.roundTrip !== false ? L('incl. return', 'वापसी सहित') : null)),
    row('home', 'r', L('Driving time', 'ड्राइव समय'), dur(r.total_secs), L(`about ${dur(r.total_secs * BREAK_FACTOR)} with breaks`, `आराम सहित लगभग ${dur(r.total_secs * BREAK_FACTOR)}`)));
  const first = r.legs[0] && !r.legs[0].error ? pickLeg(r.legs[0]) : null;
  if (first) {
    const towns = placesAlong(first.coords, places, [d.start, d.dests[0]]).slice(0, 5);
    out.append(row('car', 'p', L('Main route', 'मुख्य रास्ता'), [pName(d.start), ...towns.map(placeName), pName(d.dests[0])].join(' → ')));
  }
  out.append(h('ol', { class: 'tr-legs' }, r.legs.map((leg, i) => h('li', {}, h('span', {}, `${pairs[i].ret ? `${L('Return', 'वापसी')}: ` : ''}${pName(pairs[i].from)} → ${pName(pairs[i].to)}`),
    h('strong', {}, leg.error ? L('not calculated', 'नहीं निकला') : `${fmtKm(pickLeg(leg).km)} · ${dur(pickLeg(leg).secs)}`)))));
  const alts = r.legs.filter((l) => !l.error && l.alts?.length).length;
  if (alts) out.append(row('globe', 'b', L('Alternative routes', 'दूसरे रास्ते'), L(`${alts} stretch(es) have another option`, `${alts} हिस्सों के दूसरे विकल्प हैं`), h('a', { class: 'tr-sub no-print', href: '#/plan/route' }, L('Compare', 'तुलना करें'))));
  return out;
}

function mapCard(d, osmP) {
  const api = routeMap(d, { height: '100%', extra: (m) => {
    osmP.then((o) => {
      if (!o || !m.layer) return;
      const dot = (e, color, label) => m.Lf.circleMarker([e.lat, e.lng], { radius: 5, color: '#fff', weight: 1.5, fillColor: color, fillOpacity: 1 }).addTo(m.layer).bindTooltip(label);
      o.tolls.forEach((e) => dot(e, '#e0533d', o.label(e) || L('Toll plaza', 'टोल प्लाज़ा')));
      o.fuel.slice(0, 40).forEach((e) => dot(e, '#1d8f6a', o.label(e) || L('Fuel pump', 'पेट्रोल पंप')));
      o.hospitals.slice(0, 8).forEach((e) => dot(e, '#c2185b', o.label(e) || L('Hospital', 'अस्पताल')));
    });
  } });
  api.el.classList.add('tr-map');
  return h('div', { class: 'tr-mapwrap' }, api.el,
    h('div', { class: 'tr-legend' },
      h('span', {}, h('i', { class: 'lg-route' }), L('Route', 'रास्ता')), h('span', {}, h('i', { class: 'lg-dot toll' }), L('Toll plaza', 'टोल')),
      h('span', {}, h('i', { class: 'lg-dot fuel' }), L('Fuel pump', 'पेट्रोल पंप')), h('span', {}, h('i', { class: 'lg-dot hosp' }), L('Hospital', 'अस्पताल'))));
}

function costCard(d, b, osm, own) {
  const tile = (ic, cls, label, value, sub) => h('div', { class: `tr-tile ${cls}` }, h('span', { class: 'tr-ico' }, icon(ic, 19)),
    h('div', {}, h('span', { class: 'tr-label' }, label), h('strong', {}, value), sub ? h('span', { class: 'tr-sub' }, sub) : null));
  const a = b.a;
  const litres = own && b.driveKm != null && Number(a.mileage) ? b.driveKm / Number(a.mileage) : null;
  const money = (k) => (b.lines[k]?.missing ? L('Add in budget', 'बजट में डालें') : inr(b.lines[k]?.est || 0));
  return h('div', {},
    h('div', { class: 'tr-tiles' },
      tile('map', 'g', L('Total distance', 'कुल दूरी'), b.driveKm == null ? '—' : fmtKm(b.driveKm), L('road + local sightseeing', 'सड़क + लोकल घूमना')),
      tile('home', 'b', L('Driving time', 'ड्राइव समय'), d.route ? dur(d.route.total_secs) : '—', L('without breaks', 'आराम के बिना')),
      own ? tile('leaf', 'g', L('Fuel needed', 'ईंधन चाहिए'), litres == null ? '—' : `${litres.toFixed(1)} L`, `${a.mileage} km/l`) : tile('car', 'g', L('Transport', 'किराया'), money('transport')),
      own ? tile('arrow', 'r', L('Fuel cost', 'ईंधन ख़र्च'), money('fuel'), a.fuel_price ? `₹${a.fuel_price}/L` : null) : tile('people', 'r', L('Food', 'खाना'), money('food')),
      tile('shield', 'b', L('Toll plazas on route', 'रास्ते के टोल'), osm ? String(osm.tolls.length) : '—', d.mode === 'bike' ? L('No toll for two-wheelers on NHs', 'NH पर दोपहिया का टोल नहीं') : L('as mapped on OpenStreetMap', 'OpenStreetMap के अनुसार')),
      tile('home', 'y', L('Stay', 'रुकना'), money('stay'), `${b.nights} ${L(b.nights === 1 ? 'night' : 'nights', 'रात')}`)),
    h('div', { class: 'tr-total' },
      h('div', {}, h('span', {}, L('Total estimate', 'कुल अनुमान')), h('strong', {}, inr(b.total))),
      h('div', {}, h('span', {}, L('Per person', 'प्रति व्यक्ति')), h('strong', {}, inr(Math.round(b.perPerson)))),
      h('div', {}, h('span', {}, L('Per day', 'प्रति दिन')), h('strong', {}, inr(Math.round(b.perDay))))),
    b.missing.length ? h('p', { class: 'tr-sub' }, L('Some costs are not filled in yet — total is incomplete.', 'कुछ ख़र्च अभी नहीं भरे — कुल अधूरा है।'), ' ', h('a', { class: 'no-print', href: '#/plan/budget' }, L('Open budget', 'बजट खोलें'))) : null,
    h('p', { class: 'tr-sub' }, L('Estimates, not confirmed prices.', 'अनुमान, पक्के दाम नहीं।')));
}

function placesCard(d, places, locs, themeList) {
  const stops = tripPoints(d);
  const seen = new Set();
  const list = [];
  d.dests.slice().reverse().forEach((dest) => {
    places.filter((p) => p.kind !== 'hub' && p.kind !== 'city' && !stops.some((s) => distanceKm(s, p) < 2))
      .map((p) => ({ p, km: distanceKm(dest, p), loc: p.location_id ? locs.find((l) => l.id === p.location_id) : null }))
      .filter((x) => x.km <= 60).sort((a, b) => (!!b.loc - !!a.loc) || a.km - b.km)
      .forEach((x) => { if (!seen.has(x.p.id) && list.length < 6) { seen.add(x.p.id); list.push({ ...x, from: dest }); } });
  });
  if (!list.length) return h('p', { class: 'soft-note' }, L('No listed places near your destinations yet.', 'आपकी मंज़िलों के पास अभी कोई सूचीबद्ध जगह नहीं।'));
  return h('div', { class: 'tr-places' }, list.map(({ p, km, loc, from }) => {
    const theme = loc?.theme_slugs?.[0] ? themeList.find((t) => t.slug === loc.theme_slugs[0]) : null;
    const img = loc?.image_url || localPhotos[loc?.slug] || localPhotos[p.name.toLowerCase()];
    return h(loc ? 'a' : 'div', { class: 'tr-place', href: loc ? `#/place/${loc.slug}` : null },
      h('span', { class: 'tr-place-img' }, img ? h('img', { src: img, alt: '', loading: 'lazy' }) : art(p.name)),
      h('span', { class: 'tr-place-body' },
        h('strong', {}, loc ? pick(loc, 'name') : placeName(p)),
        h('span', { class: `tr-tag t${(theme?.slug?.length || p.kind.length) % 4}` }, theme ? pick(theme, 'name') : ({ village: L('Village', 'गाँव'), town: L('Town', 'शहर') })[p.kind] || p.kind),
        loc?.summary ? h('span', { class: 'tr-place-sub' }, pick(loc, 'summary')) : h('span', { class: 'tr-place-sub' }, p.district || ''),
        h('span', { class: 'tr-place-meta' }, `~${Math.round(km)} km ${L('from', 'दूरी:')} ${pName(from)} ${L('(straight line)', '(सीधी दूरी)')}`)));
  }));
}

function dayList(d) {
  if (!d.days?.length) return h('p', { class: 'soft-note warn' }, (d.itinWarnings || []).map((w) => L(w[1], w[2])).join(' ') || L('No plan yet.', 'अभी कोई प्लान नहीं।'));
  return h('ol', { class: 'tr-days' }, d.days.map((day) => h('li', {},
    h('span', { class: 'tr-day-pill' }, `${L('Day', 'दिन')} ${day.day}`),
    h('div', {}, h('strong', {}, hi() ? day.title_hi || day.title_en : day.title_en),
      h('span', { class: 'tr-sub' }, [fmtD(day.date), day.km ? `${fmtKm(day.km)} · ${dur(day.secs)}` : null].filter(Boolean).join(' · ')),
      h('ul', {}, day.items.filter((it) => it.kind !== 'drive').slice(0, 4).map((it) => h('li', {}, it.text || (hi() ? it.hi || it.en : it.en)))),
      day.notes ? h('p', { class: 'tr-sub' }, day.notes) : null))));
}

function staysCard(d, listings, locs) {
  const chosen = (d.days || []).filter((x) => x.stayChoice).map((x) => listings.find((s) => s.id === x.stayChoice)).filter(Boolean);
  const stopLocs = new Set(d.dests.map((p) => p.location_id).filter(Boolean));
  const near = listings.filter((s) => stopLocs.has(s.location_id) && !chosen.includes(s)).slice(0, 3 - Math.min(3, chosen.length));
  const nights = (d.days || []).filter((x) => x.night);
  const plan = h('ul', { class: 'tr-nights' }, nights.map((x) => {
    const s = x.stayChoice ? listings.find((l) => l.id === x.stayChoice) : null;
    return h('li', {}, h('span', {}, `${L('Night', 'रात')} ${x.day}`), h('strong', {}, pName(x.night)), h('span', { class: 'tr-sub' }, s ? `${s.name} (${L('enquiry', 'पूछताछ')})` : L('to decide', 'तय करना है')));
  }));
  const cards = [...chosen, ...near];
  return h('div', {}, nights.length ? plan : null,
    cards.length ? h('div', { class: 'tr-stays' }, cards.map((x) => listingCard('homestay', x)))
      : h('p', { class: 'soft-note' }, L('No homestays are listed at these stops yet. New hosts are joining.', 'इन पड़ावों पर अभी कोई होमस्टे सूचीबद्ध नहीं। नए होस्ट जुड़ रहे हैं।')),
    h('p', { class: 'tr-sub' }, L('Availability is not confirmed — send an enquiry to the host.', 'उपलब्धता पक्की नहीं — होस्ट को पूछताछ भेजें।')));
}

// ---------- OpenStreetMap points (Overpass) ----------
async function loadOsm(d) {
  const coords = (d.route?.legs || []).filter((l) => !l.error && !l.ret).flatMap((l) => pickLeg(l).coords);
  const step = Math.max(1, Math.floor(coords.length / 90));
  const sample = coords.filter((_, i) => i % step === 0).map(([a, b]) => `${a.toFixed(4)},${b.toFixed(4)}`).join(',');
  const near = d.dests.map((p) => `${(+p.lat).toFixed(4)},${(+p.lng).toFixed(4)}`).join(',');
  const query = `[out:json][timeout:25];(
${sample ? `node["barrier"="toll_booth"](around:500,${sample});node["amenity"="fuel"](around:700,${sample});` : ''}
node["amenity"="fuel"](around:15000,${near});
node["amenity"~"^(hospital|clinic)$"](around:20000,${near});way["amenity"="hospital"](around:20000,${near});
node["amenity"~"^(restaurant|cafe)$"](around:5000,${near});
);out center tags 500;`;
  const data = await getJSON(OVERPASS, { method: 'POST', body: `data=${encodeURIComponent(query)}`, headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 30000 });
  const items = (data.elements || []).map((e) => ({ lat: e.lat ?? e.center?.lat, lng: e.lon ?? e.center?.lon, tags: e.tags || {} })).filter((e) => e.lat);
  const main = d.dests[d.dests.length - 1];
  const nearest = (e) => Math.min(...d.dests.map((p) => distanceKm(e, p)));
  const label = (e) => e.tags.name || e.tags.brand || e.tags.operator || '';
  const tolls = [];
  items.filter((e) => e.tags.barrier === 'toll_booth').forEach((e) => { if (!tolls.some((t) => distanceKm(t, e) < 3)) tolls.push(e); });
  return {
    tolls, label, nearest, main,
    fuel: items.filter((e) => e.tags.amenity === 'fuel'),
    fuelNear: items.filter((e) => e.tags.amenity === 'fuel' && distanceKm(e, main) <= 15).sort((a, b) => distanceKm(a, main) - distanceKm(b, main)),
    hospitals: items.filter((e) => /hospital|clinic/.test(e.tags.amenity || '')).sort((a, b) => nearest(a) - nearest(b)),
    food: items.filter((e) => /restaurant|cafe/.test(e.tags.amenity || '')).sort((a, b) => nearest(a) - nearest(b)),
  };
}

function foodFuel(d, o) {
  if (!o) return h('p', { class: 'soft-note warn' }, L('Food and fuel points could not load right now.', 'खाना और पेट्रोल पंप की जानकारी अभी लोड नहीं हुई।'));
  const names = (arr, k = 4) => [...new Set(arr.map(o.label).filter(Boolean))].slice(0, k).join(', ');
  const main = o.main;
  return h('div', { class: 'tr-rows' },
    row('leaf', 'r', L('Places to eat near your stops', 'पड़ावों के पास खाने की जगहें'), o.food.length ? (names(o.food) || L(`${o.food.length} cafés and restaurants on the map`, `मैप पर ${o.food.length} कैफ़े और रेस्टोरेंट`)) : L('Few listed on the map — ask your host', 'मैप पर कम हैं — अपने होस्ट से पूछें'), L('(verify current status)', '(खुला है या नहीं, जाँच लें)')),
    row('car', 'g', L('Fuel stations on the way', 'रास्ते में पेट्रोल पंप'), o.fuel.length ? `${o.fuel.length} ${L('on the map', 'मैप पर')}${names(o.fuel, 3) ? ` · ${names(o.fuel, 3)}` : ''}` : L('None found on the map', 'मैप पर नहीं मिले'),
      o.fuelNear.length ? L(`Nearest to ${pName(main)}: ${o.label(o.fuelNear[0]) || 'fuel pump'} (~${Math.round(distanceKm(o.fuelNear[0], main))} km)`, `${pName(main)} के सबसे पास: ${o.label(o.fuelNear[0]) || 'पेट्रोल पंप'} (~${Math.round(distanceKm(o.fuelNear[0], main))} किमी)`)
        : L('No pump near the destination on the map — fill up before the last climb', 'मंज़िल के पास पंप नहीं दिखा — आख़िरी चढ़ाई से पहले टंकी भरवाएँ')),
    row('home', 'y', L('Rest breaks', 'आराम'), L('Stop every 2 hours on hill roads', 'पहाड़ी सड़कों पर हर 2 घंटे में रुकें')));
}

async function safety(d, o) {
  const main = d.dests[d.dests.length - 1];
  const dates = []; for (let x = d.depart; x <= d.ret && dates.length < 30; x = new Date(new Date(`${x}T12:00:00Z`).getTime() + 864e5).toISOString().slice(0, 10)) dates.push(x);
  const w = await weatherFor(main, dates).catch(() => null);
  const shown = dates.filter((x) => w?.days[x]).slice(0, 4);
  const warns = dates.flatMap((x) => weatherWarnings(w?.days[x]).map((y) => `${fmtD(x)}: ${L(y[1], y[2])}`)).slice(0, 3);
  const hosp = o?.hospitals?.[0];
  const pts = tripPoints(d);
  const last = d.roundTrip !== false ? pts[0] : pts[pts.length - 1];
  const gmaps = `https://www.google.com/maps/dir/?api=1&origin=${pts[0].lat},${pts[0].lng}&destination=${last.lat},${last.lng}${(d.roundTrip !== false ? pts.slice(1) : pts.slice(1, -1)).length ? `&waypoints=${encodeURIComponent((d.roundTrip !== false ? pts.slice(1) : pts.slice(1, -1)).map((p) => `${p.lat},${p.lng}`).join('|'))}` : ''}&travelmode=driving`;
  const link = (href, text) => h('a', { href, target: '_blank', rel: 'noopener' }, text);
  return h('div', { class: 'tr-rows' },
    row('globe', 'b', `${L('Weather at', 'मौसम:')} ${pName(main)}`, shown.length ? '' : L('Not available right now', 'अभी उपलब्ध नहीं'),
      shown.length ? h('span', { class: 'tr-wxlist' }, shown.map((x) => h('span', {}, h('b', {}, fmtD(x).replace(/ \d{4}$/, '')), ' ', weatherChip(w.days[x])))) : null,
      ...warns.map((x) => h('span', { class: 'tr-sub tr-warn' }, `⚠ ${x}`)),
      h('span', { class: 'tr-sub' }, L('Official: ', 'सरकारी: '), link('https://mausam.imd.gov.in/', 'mausam.imd.gov.in'))),
    row('shield', 'r', L('Road status & alerts', 'सड़क और चेतावनी'), 'USDMA', h('span', { class: 'tr-sub' }, link('https://usdma.uk.gov.in/', 'usdma.uk.gov.in'))),
    row('people', 'r', L('Emergency numbers', 'आपातकालीन नंबर'), '112', h('span', { class: 'tr-sub selectable' }, '108 Ambulance · 1070 State EOC · 1077 District · 100 Police · 101 Fire')),
    row('house', 'p', L('Nearest hospital', 'सबसे पास अस्पताल'), hosp ? (o.label(hosp) || L('Hospital / clinic', 'अस्पताल / क्लिनिक')) : L('Not found on the map', 'मैप पर नहीं मिला'),
      hosp ? `~${Math.round(o.nearest(hosp))} km ${L('from your nearest stop (straight line)', 'आपके सबसे पास के पड़ाव से (सीधी दूरी)')}` : L('Search “hospital” in Google Maps', 'Google Maps में “hospital” खोजें')),
    row('car', 'g', L('Live traffic', 'लाइव ट्रैफ़िक'), L('Google Maps', 'Google Maps'), h('span', { class: 'tr-sub no-print' }, link(gmaps, L('Open this route with live traffic', 'लाइव ट्रैफ़िक के साथ यह रूट खोलें')))));
}

function notesCard(d) {
  const notes = seasonNotes(d.depart, d.ret).map((n) => L(n[0], n[1]));
  notes.push(L('Carry a printed copy or offline map — mobile signal drops in many valleys.', 'प्रिंट कॉपी या ऑफ़लाइन मैप साथ रखें — कई घाटियों में मोबाइल सिग्नल नहीं आता।'));
  notes.push(L('Avoid driving on hill roads after dark.', 'अँधेरे के बाद पहाड़ी सड़कों पर गाड़ी न चलाएँ।'));
  return h('section', { class: 'tr-notes' }, h('h2', {}, L('Important travel notes', 'ज़रूरी यात्रा नोट')), h('ul', {}, notes.map((n) => h('li', {}, n))));
}
