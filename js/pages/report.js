// Trip Report: one page that sums up a road trip (route, map, distance and cost,
// places nearby, day-wise plan, stays, food and fuel, safety).
// Real data only: route from OSRM (OpenStreetMap), fuel/toll/hospital/food points from
// OpenStreetMap (Overpass), weather from Open-Meteo, places and stays from our database.
// Things we cannot know (live traffic, toll amounts) link to official sources instead.
import { h, clear, toast, inr, todayISO, icon, lazy, localPhotos } from '../ui.js';
import { getLang, pick } from '../i18n.js';
import { locations, themes } from '../store.js';
import { allPlaces, placeInput, placeName, distanceKm } from '../places.js';
import { fetchListings, listingCard } from './listings.js';

const L = (en, hi) => (getLang() === 'hi' ? hi : en);
const VEH = {
  bike: { label: () => L('Petrol bike', 'पेट्रोल बाइक'), mileage: 40, fuel: 'petrol', icon: 'bike' },
  car: { label: () => L('Car', 'कार'), mileage: 15, fuel: 'petrol', icon: 'car' },
  suv: { label: () => L('SUV', 'एसयूवी'), mileage: 12, fuel: 'diesel', icon: 'car' },
};
const ROUTE_API = 'https://router.project-osrm.org/route/v1/driving/';
const OVERPASS = 'https://overpass-api.de/api/interpreter';
const WEATHER = 'https://api.open-meteo.com/v1/forecast';
const fmtKm = (km) => `${Math.round(km).toLocaleString('en-IN')} km`;
const fmtHrs = (s) => { const hr = s / 3600; return hr < 1 ? `${Math.round(s / 60)} min` : `${hr.toFixed(hr < 10 ? 1 : 0)} ${L('hrs', 'घंटे')}`; };
const roadKm = (a, b) => distanceKm(a, b) * 1.35; // straight line × typical hill-road factor (shown as approximate)

async function getJSON(url, opts = {}, ms = 20000) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
  try { const r = await fetch(url, { ...opts, signal: ctl.signal }); if (!r.ok) throw new Error(`HTTP ${r.status}`); return await r.json(); }
  finally { clearTimeout(t); }
}

// ---------- Form ----------
function reportForm(init = {}) {
  const fromI = placeInput({ id: 'tr-from', label: L('Start point', 'कहाँ से'), value: init.from || null, placeholder: 'Delhi' });
  const toI = placeInput({ id: 'tr-to', label: L('Destination', 'मंज़िल'), value: init.to || null, placeholder: 'Mukteshwar' });
  const daysI = h('input', { class: 'input', id: 'tr-days', type: 'number', min: 1, max: 15, value: init.days || 3 });
  const nI = h('input', { class: 'input', id: 'tr-n', type: 'number', min: 1, max: 20, value: init.n || 2 });
  const vS = h('select', { class: 'input', id: 'tr-v' }, Object.entries(VEH).map(([k, v]) => h('option', { value: k }, v.label())));
  vS.value = init.v || 'car';
  const mI = h('input', { class: 'input', id: 'tr-m', type: 'number', min: 5, max: 80, value: init.m || VEH[vS.value].mileage });
  vS.addEventListener('change', () => { mI.value = VEH[vS.value].mileage; });
  const priceI = h('input', { class: 'input', id: 'tr-price', type: 'number', min: 50, max: 200, step: 0.01, value: init.price || '', placeholder: L('e.g. 95', 'जैसे 95') });
  const rtI = h('input', { type: 'checkbox', id: 'tr-rt' }); rtI.checked = init.rt !== '0';
  const err = h('p', { class: 'form-err', role: 'alert' });
  return h('form', { class: 'cab-search-card tr-form', novalidate: true, onsubmit: (e) => {
    e.preventDefault(); err.textContent = '';
    if (!fromI.validate() || !toI.validate()) { err.textContent = L('Choose the start and destination from the list.', 'शुरुआत और मंज़िल सूची से चुनें।'); return; }
    if (fromI.get().id === toI.get().id) { err.textContent = L('Start and destination must be different.', 'शुरुआत और मंज़िल अलग हों।'); return; }
    const qs = new URLSearchParams({ from: fromI.get().id, to: toI.get().id, days: String(Math.min(15, Math.max(1, +daysI.value || 3))),
      n: String(Math.max(1, +nI.value || 1)), v: vS.value, m: String(Math.max(5, +mI.value || VEH[vS.value].mileage)), rt: rtI.checked ? '1' : '0' });
    if (priceI.value) qs.set('price', priceI.value);
    location.hash = `#/report?${qs}`;
  } },
    h('div', { class: 'tr-form-grid' }, fromI.el, toI.el),
    h('div', { class: 'tr-form-grid4' },
      h('label', { class: 'field', for: 'tr-days' }, h('span', { class: 'field-label' }, L('Days', 'दिन')), daysI),
      h('label', { class: 'field', for: 'tr-n' }, h('span', { class: 'field-label' }, L('Travellers', 'यात्री')), nI),
      h('label', { class: 'field', for: 'tr-v' }, h('span', { class: 'field-label' }, L('Vehicle', 'गाड़ी')), vS),
      h('label', { class: 'field', for: 'tr-m' }, h('span', { class: 'field-label' }, L('Mileage (km/l)', 'माइलेज (किमी/ली)')), mI)),
    h('div', { class: 'tr-form-grid' },
      h('label', { class: 'field', for: 'tr-price' }, h('span', { class: 'field-label' }, L('Fuel price today (₹ per litre, optional)', 'आज का पेट्रोल/डीज़ल रेट (₹/लीटर, वैकल्पिक)')), priceI),
      h('label', { class: 'check', style: { alignSelf: 'end', minHeight: '50px' } }, rtI, h('span', {}, L('Include the return journey', 'वापसी की यात्रा भी जोड़ें')))),
    err,
    h('button', { class: 'btn btn-lg btn-block', type: 'submit' }, L('Create trip report', 'ट्रिप रिपोर्ट बनाएँ'), icon('arrow', 16)));
}

// ---------- Page ----------
export async function report({ query }) {
  const places = await allPlaces();
  const from = places.find((p) => p.id === query.from);
  const to = places.find((p) => p.id === query.to) || places.find((p) => query.to_loc && p.location_id === query.to_loc);
  if (!from || !to) {
    return h('div', { class: 'app-page' },
      h('div', {}, h('p', { class: 'eyebrow' }, L('Trip report', 'ट्रिप रिपोर्ट')),
        h('h1', {}, L('Plan a road trip in minutes', 'मिनटों में रोड ट्रिप प्लान करें')),
        h('p', { class: 'muted' }, L('Route on the map, distance, fuel cost, places to see, a day-wise plan, stays and safety information — on one page you can save as PDF.',
          'मैप पर रास्ता, दूरी, पेट्रोल का ख़र्च, घूमने की जगहें, दिन-वार प्लान, रुकने की जगहें और सुरक्षा जानकारी — एक पेज पर, PDF में सेव कर सकते हैं।'))),
      reportForm({ from, to, ...query }));
  }

  const days = Math.min(15, Math.max(1, Number(query.days) || 3));
  const n = Math.max(1, Number(query.n) || 2);
  const vk = VEH[query.v] ? query.v : 'car';
  const mileage = Math.max(5, Number(query.m) || VEH[vk].mileage);
  const price = Number(query.price) || null;
  const roundTrip = query.rt !== '0';
  const [locs, themeList] = await Promise.all([locations(), themes()]);
  const destLoc = locs.find((l) => l.id === to.location_id);
  const themeNames = (destLoc?.theme_slugs || []).map((s) => themeList.find((t) => t.slug === s)).filter(Boolean).map((t) => pick(t, 'name'));

  // Places to see near the destination (our list), nearest first.
  const nearby = places.filter((p) => p.id !== to.id && p.id !== from.id)
    .map((p) => ({ p, km: roadKm(to, p), loc: locs.find((l) => l.id === p.location_id) }))
    .filter((x) => x.km <= 75).sort((a, b) => a.km - b.km).slice(0, 6);

  // Shared state filled by the route and map data.
  const st = { route: null, routeErr: null, osm: null, osmErr: null };
  const routeReady = loadRoute(from, to).then((r) => { st.route = r; }).catch((e) => { st.routeErr = e; });
  const osmReady = routeReady.then(() => loadOsm(to, st.route)).then((o) => { st.osm = o; }).catch((e) => { st.osmErr = e; });

  const title = `${placeName(from)} → ${placeName(to)}`;
  const shareText = `${L('Trip report', 'ट्रिप रिपोर्ट')}: ${title} (${days} ${L('days', 'दिन')}) — The Himalayan Horizon\n${location.href}`;

  const page = h('div', { class: 'tr' },
    h('section', { class: 'tr-hero' },
      h('img', { src: destLoc?.image_url || localPhotos[destLoc?.slug] || 'img/home/hero.jpg', alt: '' }),
      h('div', { class: 'tr-hero-in' },
        h('div', {},
          h('h1', {}, L('Trip Report', 'ट्रिप रिपोर्ट')),
          h('p', { class: 'tr-route' }, `${title} (${days} ${L(days > 1 ? 'Days' : 'Day', 'दिन')})`),
          themeNames.length ? h('p', { class: 'tr-themes' }, themeNames.join('  •  ')) : null),
        h('div', { class: 'tr-actions no-print' },
          h('button', { class: 'btn btn-blue', type: 'button', onclick: () => window.print() }, icon('arrow', 15), L('Download PDF', 'PDF डाउनलोड')),
          h('button', { class: 'btn btn-white', type: 'button', onclick: () => share(title, shareText) }, L('Share', 'शेयर'))),
        h('p', { class: 'tr-script', 'aria-hidden': 'true' }, 'Explore', h('br'), 'Plan', h('br'), 'Travel'))),
    summaryBar({ from, to, days, n, vk, mileage, roundTrip, destLoc }),
    h('div', { class: 'tr-grid' },
      h('section', { class: 'tr-card tr-a' }, cardHead(1, L('Route overview', 'रूट की जानकारी')), lazy(async () => { await routeReady; return routeOverview(st, from, to, places, roundTrip); })),
      h('section', { class: 'tr-card tr-b' }, cardHead(2, L('Interactive route map', 'मैप पर रास्ता')), routeMap(st, routeReady, osmReady, from, to, nearby)),
      h('section', { class: 'tr-card tr-c' }, cardHead(3, L('Distance & cost summary', 'दूरी और ख़र्च')), lazy(async () => { await osmReady; return costSummary(st, { days, n, vk, mileage, price, roundTrip, to }); })),
      h('section', { class: 'tr-card tr-d' }, cardHead(4, `${L('Places to see in', 'घूमने की जगहें:')} ${placeName(to)} ${L('& nearby', 'और आसपास')}`,
        h('a', { class: 'btn btn-blue btn-sm no-print', href: `#/explore` }, L('View all places', 'सभी जगहें'), icon('arrow', 14))), placesCards(nearby, to, themeList)),
      h('section', { class: 'tr-card tr-e' }, cardHead(5, `${L('Day-wise plan', 'दिन-वार प्लान')} (${days} ${L(days > 1 ? 'days' : 'day', 'दिन')})`), lazy(async () => { await routeReady; return dayPlan(st, { from, to, days, nearby, roundTrip }); })),
      h('section', { class: 'tr-card tr-f' }, cardHead(6, `${L('Stay options in', 'रुकने की जगहें:')} ${placeName(to)}`,
        h('a', { class: 'btn btn-ghost btn-sm no-print', href: '#/stays' }, L('View more', 'और देखें'), icon('arrow', 14))), lazy(() => stays(to, places))),
      h('section', { class: 'tr-card tr-g' }, cardHead(7, L('Food & fuel stops', 'खाना और पेट्रोल पंप')), lazy(async () => { await osmReady; return foodFuel(st, to); })),
      h('section', { class: 'tr-card tr-h' }, cardHead(8, L('Safety & live information', 'सुरक्षा और लाइव जानकारी')), lazy(() => safety(to, from, osmReady, st)))),
    h('footer', { class: 'tr-sources' },
      h('strong', {}, L('Data sources:', 'डेटा स्रोत:')),
      h('span', {}, 'OpenStreetMap'), h('span', {}, 'OSRM routing'), h('span', {}, 'Open-Meteo weather'), h('span', {}, 'IMD'), h('span', {}, 'USDMA'), h('span', {}, 'The Himalayan Horizon listings'),
      h('p', { class: 'tr-note' }, L('Distances, times and costs are estimates. Check live conditions, opening hours and rates before you travel.',
        'दूरी, समय और ख़र्च अनुमान हैं। यात्रा से पहले मौसम, सड़क, खुलने का समय और रेट ज़रूर जाँचें।'))),
    h('div', { class: 'app-page no-print' }, h('h2', {}, L('Change this trip', 'यह ट्रिप बदलें')), reportForm({ from, to, days, n, v: vk, m: mileage, price: price || '', rt: roundTrip ? '1' : '0' })));
  return page;
}

function cardHead(no, title, action) {
  return h('div', { class: 'tr-head' }, h('span', { class: 'tr-no' }, String(no)), h('h2', {}, title), action || null);
}

async function share(title, text) {
  if (navigator.share) { navigator.share({ title, text, url: location.href }).catch(() => {}); return; }
  try { await navigator.clipboard.writeText(text); toast(L('Link copied', 'लिंक कॉपी हो गया')); }
  catch { window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener'); }
}

function summaryBar({ from, to, days, n, vk, mileage, roundTrip, destLoc }) {
  const item = (ic, label, value, sub) => h('div', { class: 'tr-sum-item' }, h('span', { class: 'tr-sum-ico' }, icon(ic, 22)),
    h('div', {}, h('span', { class: 'tr-sum-label' }, label), h('strong', {}, value), sub ? h('span', { class: 'tr-sum-sub' }, sub) : null));
  return h('section', { class: 'tr-sum' },
    item('map', L('Start point', 'शुरुआत'), placeName(from), from.district !== placeName(from) ? from.district : null),
    item('mountain', L('Destination', 'मंज़िल'), placeName(to), [to.district, to.region !== 'Other' ? 'Uttarakhand' : ''].filter(Boolean).join(', ')),
    item('home', L('Duration', 'अवधि'), `${days} ${L(days > 1 ? 'Days' : 'Day', 'दिन')}`, days > 1 ? `(${days - 1} ${L(days > 2 ? 'nights' : 'night', 'रात')})` : null),
    item('people', L('Travellers', 'यात्री'), String(n)),
    item('car', L('Vehicle', 'गाड़ी'), VEH[vk].label()),
    item('leaf', L('Mileage', 'माइलेज'), `${mileage} km/l`),
    item('globe', L('Trip type', 'ट्रिप का प्रकार'), roundTrip ? L('Round trip', 'आना-जाना') : L('One way', 'एक तरफ़'), destLoc ? L('with nearby places', 'आसपास की जगहों के साथ') : null));
}

// ---------- Route ----------
async function loadRoute(from, to) {
  const url = `${ROUTE_API}${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&alternatives=true&steps=false`;
  const data = await getJSON(url);
  if (data.code !== 'Ok' || !data.routes?.length) throw new Error('No route found');
  return data.routes.map((r) => ({ km: r.distance / 1000, secs: r.duration, coords: r.geometry.coordinates.map(([lng, lat]) => [lat, lng]) }));
}

// Towns from our list that sit on the route line, in travel order.
function townsOnRoute(route, places, from, to) {
  if (!route) return [];
  const pts = route.coords.filter((_, i) => i % 5 === 0);
  const hits = [];
  for (const p of places) {
    if (p.id === from.id || p.id === to.id) continue;
    let best = Infinity, idx = -1;
    pts.forEach(([lat, lng], i) => { const d = distanceKm({ lat, lng }, p); if (d < best) { best = d; idx = i; } });
    if (best < 6) hits.push({ p, idx });
  }
  return hits.sort((a, b) => a.idx - b.idx).map((x) => x.p);
}

function routeOverview(st, from, to, places, roundTrip) {
  if (st.routeErr || !st.route) return routeFallback(from, to);
  const main = st.route[0];
  const towns = townsOnRoute(main, places, from, to);
  const alt = st.route[1] ? townsOnRoute(st.route[1], places, from, to).filter((p) => !towns.some((t) => t.id === p.id)).slice(0, 2) : [];
  const row = (ic, label, value, sub, cls = '') => h('div', { class: 'tr-row' }, h('span', { class: `tr-ico ${cls}` }, icon(ic, 20)),
    h('div', {}, h('span', { class: 'tr-label' }, label), h('strong', {}, value), sub ? h('span', { class: 'tr-sub' }, sub) : null));
  return h('div', { class: 'tr-rows' },
    row('map', L('Total distance', 'कुल दूरी'), `~${fmtKm(main.km * (roundTrip ? 2 : 1))}`, roundTrip ? `(${fmtKm(main.km)} ${L('each way', 'एक तरफ़')})` : null, 'g'),
    row('home', L('Estimated drive time', 'गाड़ी चलाने का समय'), `${fmtHrs(main.secs)} ${L('(one way)', '(एक तरफ़)')}`, L('Hill roads and traffic can add time', 'पहाड़ी सड़क और ट्रैफ़िक से समय बढ़ सकता है'), 'r'),
    row('car', L('Main route', 'मुख्य रास्ता'), [placeName(from), ...towns.slice(0, 6).map(placeName), placeName(to)].join(' → '), null, 'p'),
    alt.length ? row('globe', L('Alternative route', 'दूसरा रास्ता'), `${L('Via', 'होकर')} ${alt.map(placeName).join(' / ')}`, `(${fmtKm(st.route[1].km)})`, 'b') : null);
}

function routeFallback(from, to) {
  const km = roadKm(from, to);
  return h('div', { class: 'tr-rows' },
    h('p', { class: 'soft-note warn' }, L('Live route could not load (check your internet). Showing a rough estimate.', 'लाइव रूट लोड नहीं हुआ (इंटरनेट देखें)। अंदाज़न दूरी दिखा रहे हैं।')),
    h('div', { class: 'tr-row' }, h('span', { class: 'tr-ico g' }, icon('map', 20)), h('div', {}, h('span', { class: 'tr-label' }, L('Approximate distance', 'अंदाज़न दूरी')), h('strong', {}, `~${fmtKm(km)}`))));
}

// ---------- OpenStreetMap points ----------
async function loadOsm(to, route) {
  const line = route?.[0]?.coords || [];
  const step = Math.max(1, Math.floor(line.length / 70));
  const sample = line.filter((_, i) => i % step === 0).map(([a, b]) => `${a.toFixed(4)},${b.toFixed(4)}`).join(',');
  const near = `${to.lat},${to.lng}`;
  const q = `[out:json][timeout:25];(
${sample ? `node["barrier"="toll_booth"](around:600,${sample});node["amenity"="fuel"](around:800,${sample});` : ''}
node["amenity"="fuel"](around:15000,${near});
node["amenity"~"^(hospital|clinic)$"](around:20000,${near});way["amenity"="hospital"](around:20000,${near});
node["amenity"~"^(restaurant|cafe)$"](around:5000,${near});
);out center tags 400;`;
  const data = await getJSON(OVERPASS, { method: 'POST', body: `data=${encodeURIComponent(q)}`, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }, 30000);
  const items = (data.elements || []).map((e) => ({ lat: e.lat ?? e.center?.lat, lng: e.lon ?? e.center?.lon, tags: e.tags || {} })).filter((e) => e.lat);
  const dist = (e) => distanceKm(e, to);
  const label = (e) => e.tags.name || e.tags.brand || e.tags.operator || '';
  const tolls = [];
  items.filter((e) => e.tags.barrier === 'toll_booth').forEach((e) => { if (!tolls.some((t) => distanceKm(t, e) < 3)) tolls.push(e); });
  return {
    tolls,
    fuelRoute: items.filter((e) => e.tags.amenity === 'fuel' && dist(e) > 15),
    fuelNear: items.filter((e) => e.tags.amenity === 'fuel' && dist(e) <= 15).sort((a, b) => dist(a) - dist(b)),
    hospitals: items.filter((e) => /hospital|clinic/.test(e.tags.amenity || '')).sort((a, b) => dist(a) - dist(b)),
    food: items.filter((e) => /restaurant|cafe/.test(e.tags.amenity || '')).sort((a, b) => dist(a) - dist(b)),
    label, dist,
  };
}

// ---------- Map ----------
function routeMap(st, routeReady, osmReady, from, to, nearby) {
  const box = h('div', { class: 'tr-map' }, h('p', { class: 'muted small' }, L('Loading map…', 'मैप लोड हो रहा है…')));
  const legend = h('div', { class: 'tr-legend' },
    h('span', {}, h('i', { class: 'lg-route' }), L('Route', 'रास्ता')), h('span', {}, h('i', { class: 'lg-dot toll' }), L('Toll plaza', 'टोल')),
    h('span', {}, h('i', { class: 'lg-dot fuel' }), L('Fuel pump', 'पेट्रोल पंप')), h('span', {}, h('i', { class: 'lg-dot place' }), L('Tourist place', 'घूमने की जगह')),
    h('span', {}, h('i', { class: 'lg-dot hosp' }), L('Hospital', 'अस्पताल')));
  (async () => {
    let Lf;
    try { Lf = await loadLeaflet(); } catch { clear(box).append(h('p', { class: 'error-box' }, L('Map could not load. Check your internet.', 'मैप लोड नहीं हुआ। इंटरनेट देखें।'))); return; }
    clear(box);
    const map = Lf.map(box, { scrollWheelZoom: false, zoomControl: true });
    Lf.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap contributors' }).addTo(map);
    const pin = (p, color) => Lf.circleMarker([p.lat, p.lng], { radius: 9, color: '#fff', weight: 3, fillColor: color, fillOpacity: 1 });
    pin(from, '#1f8a4c').addTo(map).bindTooltip(placeName(from), { permanent: true, direction: 'right', className: 'tr-tip' });
    pin(to, '#d33a2c').addTo(map).bindTooltip(placeName(to), { permanent: true, direction: 'right', className: 'tr-tip' });
    map.fitBounds([[from.lat, from.lng], [to.lat, to.lng]], { padding: [30, 30] });
    nearby.slice(0, 6).forEach((x) => Lf.circleMarker([x.p.lat, x.p.lng], { radius: 6, color: '#fff', weight: 2, fillColor: '#2f8f5a', fillOpacity: 1 }).addTo(map).bindTooltip(placeName(x.p)));
    await routeReady;
    if (st.route) {
      st.route.slice(1).forEach((r) => Lf.polyline(r.coords, { color: '#7aa7e8', weight: 4, opacity: 0.7, dashArray: '6 8' }).addTo(map));
      const line = Lf.polyline(st.route[0].coords, { color: '#1e5fd6', weight: 5 }).addTo(map);
      map.fitBounds(line.getBounds(), { padding: [24, 24] });
    }
    await osmReady;
    if (st.osm) {
      const dot = (e, color, label) => Lf.circleMarker([e.lat, e.lng], { radius: 5, color: '#fff', weight: 1.5, fillColor: color, fillOpacity: 1 }).addTo(map).bindTooltip(label);
      st.osm.tolls.forEach((e) => dot(e, '#e0533d', st.osm.label(e) || L('Toll plaza', 'टोल प्लाज़ा')));
      [...st.osm.fuelRoute.slice(0, 25), ...st.osm.fuelNear.slice(0, 5)].forEach((e) => dot(e, '#1d8f6a', st.osm.label(e) || L('Fuel pump', 'पेट्रोल पंप')));
      st.osm.hospitals.slice(0, 5).forEach((e) => dot(e, '#c2185b', st.osm.label(e) || L('Hospital', 'अस्पताल')));
    }
    setTimeout(() => map.invalidateSize(), 200);
  })();
  return h('div', {}, box, legend);
}

let leafletP = null;
function loadLeaflet() {
  if (window.L?.map) return Promise.resolve(window.L);
  if (!leafletP) leafletP = new Promise((res, rej) => {
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.append(css);
    const s = document.createElement('script'); s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    s.onload = () => res(window.L); s.onerror = () => { leafletP = null; rej(new Error('map')); }; document.head.append(s);
  });
  return leafletP;
}

// ---------- Cost ----------
function costSummary(st, { days, n, vk, mileage, price, roundTrip, to }) {
  const oneWay = st.route?.[0]?.km ?? null;
  const local = 25 * Math.max(0, days - 1); // short sightseeing drives on the extra days (estimate)
  const total = oneWay == null ? null : oneWay * (roundTrip ? 2 : 1) + local;
  const secs = st.route?.[0]?.secs ? st.route[0].secs * (roundTrip ? 2 : 1) : null;
  const litres = total == null ? null : total / mileage;
  const fuelCost = litres != null && price ? litres * price : null;
  const tolls = st.osm?.tolls?.length;
  const tile = (ic, cls, label, value, sub) => h('div', { class: `tr-tile ${cls}` }, h('span', { class: 'tr-ico' }, icon(ic, 20)),
    h('div', {}, h('span', { class: 'tr-label' }, label), h('strong', {}, value), sub ? h('span', { class: 'tr-sub' }, sub) : null));
  return h('div', { class: 'tr-tiles' },
    tile('map', 'g', L('Total distance', 'कुल दूरी'), total == null ? '—' : fmtKm(total), L('(approx., incl. local drives)', '(अंदाज़न, लोकल घूमना शामिल)')),
    tile('home', 'b', L('Total drive time', 'कुल ड्राइव समय'), secs == null ? '—' : `~${fmtHrs(secs)}`, roundTrip ? L('(round trip)', '(आना-जाना)') : null),
    tile('leaf', 'g', L('Fuel needed', 'पेट्रोल/डीज़ल चाहिए'), litres == null ? '—' : `${litres.toFixed(1)} L`, total == null ? null : `(${Math.round(total)} ÷ ${mileage} km/l)`),
    tile('arrow', 'r', L('Fuel cost', 'पेट्रोल का ख़र्च'), fuelCost == null ? L('Add fuel price', 'रेट डालें') : inr(Math.round(fuelCost)),
      price ? `(${L('at', 'दर')} ₹${price}/L)` : L('Enter today’s rate below to calculate', 'हिसाब के लिए नीचे आज का रेट डालें')),
    tile('shield', 'b', L('Toll plazas on route', 'रास्ते के टोल'), tolls == null ? '—' : String(tolls),
      vk === 'bike' ? L('Two-wheelers do not pay toll on national highways', 'नेशनल हाईवे पर दोपहिया का टोल नहीं लगता') : h('a', { href: 'https://www.nhai.gov.in/', target: '_blank', rel: 'noopener' }, L('Rates: NHAI / Rajmargyatra app', 'रेट: NHAI / राजमार्गयात्रा ऐप'))),
    tile('people', 'y', L('Per person (fuel)', 'प्रति व्यक्ति (पेट्रोल)'), fuelCost == null ? '—' : inr(Math.round(fuelCost / n)), `${n} ${L('travellers', 'यात्री')}`));
}

// ---------- Places ----------
function placesCards(nearby, to, themeList) {
  if (!nearby.length) return h('p', { class: 'soft-note' }, L('No listed places near this destination yet.', 'इस मंज़िल के पास अभी कोई सूचीबद्ध जगह नहीं।'));
  return h('div', { class: 'tr-places' }, nearby.map(({ p, km, loc }) => {
    const theme = loc?.theme_slugs?.[0] ? themeList.find((t) => t.slug === loc.theme_slugs[0]) : null;
    const img = loc?.image_url || localPhotos[loc?.slug] || localPhotos[p.name.toLowerCase()];
    const hrs = km < 15 ? L('1–2 hrs', '1–2 घंटे') : km < 40 ? L('2–3 hrs', '2–3 घंटे') : L('Half / full day', 'आधा / पूरा दिन');
    return h('a', { class: 'tr-place', href: loc ? `#/place/${loc.slug}` : `#/report?from=${to.id}&to=${p.id}&days=1&rt=1` },
      h('span', { class: 'tr-place-img' }, img ? h('img', { src: img, alt: '', loading: 'lazy' }) : h('span', { class: 'tr-place-art' }, icon('mountain', 30))),
      h('span', { class: 'tr-place-body' },
        h('strong', {}, placeName(p)),
        h('span', { class: `tr-tag t${(p.kind.length + (theme?.slug?.length || 0)) % 4}` }, theme ? pick(theme, 'name') : ({ village: L('Village', 'गाँव'), town: L('Town', 'शहर'), city: L('City', 'शहर'), hub: L('Transport hub', 'ट्रांसपोर्ट') })[p.kind]),
        h('span', { class: 'tr-place-sub' }, loc ? pick(loc, 'summary') : `${p.district}`),
        h('span', { class: 'tr-place-meta' }, h('span', {}, `~${Math.round(km)} km`), h('span', {}, hrs))));
  }));
}

// ---------- Day plan ----------
function dayPlan(st, { from, to, days, nearby, roundTrip }) {
  const oneWay = st.route?.[0];
  const sights = nearby.map((x) => x.p);
  const items = [];
  const li = (txt) => h('li', {}, txt);
  items.push({ title: `${placeName(from)} → ${placeName(to)}`, meta: oneWay ? `~${fmtKm(oneWay.km)} | ${fmtHrs(oneWay.secs)}` : '',
    points: [L('Start early to avoid traffic and reach before dark', 'ट्रैफ़िक से बचने और अँधेरे से पहले पहुँचने के लिए जल्दी निकलें'),
      L('Take breaks every 2 hours', 'हर 2 घंटे में आराम करें'), L(`Reach ${placeName(to)}, check in and rest`, `${placeName(to)} पहुँचें, चेक-इन करें और आराम करें`)] });
  const middle = Math.max(0, days - (roundTrip && days > 1 ? 2 : 1));
  for (let d = 0; d < middle; d++) {
    const pick2 = sights.slice(d * 2, d * 2 + 2);
    items.push({ title: pick2.length ? `${placeName(to)} ${L('sightseeing', 'घूमना')}` : L('Free day', 'खाली दिन'), meta: '',
      points: pick2.length ? [...pick2.map((p) => L(`Visit ${placeName(p)}`, `${placeName(p)} घूमें`)), L('Evening: local food and a village walk', 'शाम: स्थानीय खाना और गाँव की सैर')]
        : [L('Rest, walk around the village and try local food', 'आराम करें, गाँव में घूमें और स्थानीय खाना खाएँ')] });
  }
  if (roundTrip && days > 1) items.push({ title: L('Return journey', 'वापसी'), meta: oneWay ? `~${fmtKm(oneWay.km)}` : '',
    points: [L(`${placeName(to)} → ${placeName(from)}`, `${placeName(to)} → ${placeName(from)}`), sights[middle * 2] ? L(`Optional stop: ${placeName(sights[middle * 2])}`, `रुक सकते हैं: ${placeName(sights[middle * 2])}`) : null,
      L('Refuel before the descent and take regular breaks', 'उतराई से पहले पेट्रोल भरवाएँ और बीच-बीच में आराम करें')].filter(Boolean) });
  return h('ol', { class: 'tr-days' }, items.slice(0, Math.max(days, 1)).map((it, i) => h('li', {},
    h('span', { class: 'tr-day-pill' }, `${L('Day', 'दिन')} ${i + 1}`),
    h('div', {}, h('strong', {}, it.title), it.meta ? h('span', { class: 'tr-sub' }, it.meta) : null, h('ul', {}, it.points.map(li))))),
  ), h('p', { class: 'small muted' }, L('Suggested plan — change it to suit you.', 'सुझाया गया प्लान — अपने हिसाब से बदलें।')));
}

// ---------- Stays ----------
async function stays(to, places) {
  const all = await fetchListings('homestay', {}).catch(() => []);
  const near = all.filter((x) => {
    const p = places.find((pl) => pl.location_id === x.location_id);
    return p && roadKm(to, p) <= 30;
  }).slice(0, 3);
  if (!near.length) return h('p', { class: 'soft-note' }, L('No homestays listed near this place yet. New hosts are joining.', 'इस जगह के पास अभी कोई होमस्टे नहीं। नए होस्ट जुड़ रहे हैं।'), ' ',
    h('a', { href: '#/stays' }, L('See all homestays', 'सभी होमस्टे देखें')));
  return h('div', { class: 'tr-stays' }, near.map((x) => listingCard('homestay', x)));
}

// ---------- Food & fuel ----------
function foodFuel(st, to) {
  if (!st.osm) return h('p', { class: 'soft-note warn' }, L('Food and fuel points could not load right now.', 'खाना और पेट्रोल पंप की जानकारी अभी लोड नहीं हुई।'));
  const o = st.osm;
  const names = (arr, k = 4) => [...new Set(arr.map(o.label).filter(Boolean))].slice(0, k).join(', ');
  const row = (ic, cls, title, body, sub) => h('div', { class: 'tr-row' }, h('span', { class: `tr-ico ${cls}` }, icon(ic, 20)),
    h('div', {}, h('strong', {}, title), h('span', { class: 'tr-sub' }, body), sub ? h('span', { class: 'tr-sub' }, sub) : null));
  return h('div', { class: 'tr-rows' },
    row('leaf', 'r', L('Places to eat', 'खाने की जगहें'), o.food.length ? `${names(o.food) || L(`${o.food.length} cafés and restaurants`, `${o.food.length} कैफ़े और रेस्टोरेंट`)} (${L('near', 'पास')} ${placeName(to)})` : L('Few listed on the map — ask your host', 'मैप पर कम हैं — अपने होस्ट से पूछें'), L('(verify current status)', '(खुला है या नहीं, जाँच लें)')),
    row('car', 'g', L('Fuel stations on the route', 'रास्ते में पेट्रोल पंप'), o.fuelRoute.length ? `${o.fuelRoute.length} ${L('on the map', 'मैप पर')}${names(o.fuelRoute, 3) ? ` · ${names(o.fuelRoute, 3)}` : ''}` : L('None found on the map', 'मैप पर नहीं मिले'),
      o.fuelNear.length ? `${L('Nearest to destination:', 'मंज़िल के सबसे पास:')} ${o.label(o.fuelNear[0]) || L('fuel pump', 'पेट्रोल पंप')} (~${Math.round(o.dist(o.fuelNear[0]))} km)` : L('No pump near the destination on the map — fill up before the last climb', 'मंज़िल के पास पंप नहीं दिखा — आख़िरी चढ़ाई से पहले टंकी भरवाएँ')),
    row('home', 'y', L('Food budget', 'खाने का बजट'), L('Plan about ₹300–600 per person per day in hill towns', 'पहाड़ी कस्बों में प्रति व्यक्ति रोज़ लगभग ₹300–600 रखें'), L('(rough guide)', '(अंदाज़न)')));
}

// ---------- Safety ----------
async function safety(to, from, osmReady, st) {
  let weather = null;
  try {
    const w = await getJSON(`${WEATHER}?latitude=${to.lat}&longitude=${to.lng}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FKolkata&forecast_days=3`, {}, 12000);
    weather = w.daily;
  } catch { /* shown as link only */ }
  await osmReady;
  const hosp = st.osm?.hospitals?.[0];
  const gmaps = `https://www.google.com/maps/dir/?api=1&origin=${from.lat},${from.lng}&destination=${to.lat},${to.lng}&travelmode=driving`;
  const row = (ic, cls, title, ...body) => h('div', { class: 'tr-row' }, h('span', { class: `tr-ico ${cls}` }, icon(ic, 20)), h('div', {}, h('strong', {}, title), ...body));
  const link = (href, text) => h('a', { href, target: '_blank', rel: 'noopener' }, text);
  return h('div', { class: 'tr-rows' },
    row('globe', 'b', L('Weather forecast', 'मौसम'),
      weather ? h('span', { class: 'tr-sub' }, weather.time.map((d, i) => `${new Date(`${d}T12:00:00+05:30`).toLocaleDateString(getLang() === 'hi' ? 'hi-IN' : 'en-IN', { weekday: 'short' })} ${Math.round(weather.temperature_2m_min[i])}–${Math.round(weather.temperature_2m_max[i])}°C${weather.precipitation_probability_max?.[i] != null ? ` · ${weather.precipitation_probability_max[i]}% ${L('rain', 'बारिश')}` : ''}`).join('  |  ')) : null,
      h('span', { class: 'tr-sub' }, L('Official: ', 'सरकारी: '), link('https://mausam.imd.gov.in/', 'mausam.imd.gov.in'))),
    row('shield', 'r', L('Road status & alerts', 'सड़क और चेतावनी'), h('span', { class: 'tr-sub' }, 'USDMA – ', link('https://usdma.uk.gov.in/', 'usdma.uk.gov.in'))),
    row('people', 'r', L('Emergency numbers', 'आपातकालीन नंबर'), h('span', { class: 'tr-sub selectable' }, '112 (Emergency) · 108 (Ambulance) · 1070 (State EOC) · 1077 (District) · 100 (Police) · 101 (Fire)')),
    row('house', 'p', L('Nearest hospital', 'सबसे पास अस्पताल'), h('span', { class: 'tr-sub' }, hosp ? `${st.osm.label(hosp) || L('Hospital / clinic', 'अस्पताल / क्लिनिक')} (~${Math.round(st.osm.dist(hosp))} km)` : L('Not found on the map — search “hospital” in Google Maps', 'मैप पर नहीं मिला — Google Maps में “hospital” खोजें'))),
    row('car', 'g', L('Live traffic', 'लाइव ट्रैफ़िक'), h('span', { class: 'tr-sub' }, link(gmaps, L('Open this route in Google Maps', 'यह रास्ता Google Maps में खोलें')))));
}
