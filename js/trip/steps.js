// Trip Planner steps 3–5: road route + weather, day-wise itinerary, budget.
import { h, clear, toast, icon, inr } from '../ui.js';
import { getLang, pick } from '../i18n.js';
import { locations, themes, settings } from '../store.js';
import { allPlaces, loadLeaflet } from '../places.js';
import { fetchListings } from '../pages/listings.js';
import { L, PREFS, PACES, MODES, loadDraft, saveDraft, pName, fmtD, validate, back, steps } from './common.js';
import {
  legPairs, fetchRoute, routeIsFresh, pickLeg, summarise, fmtKm, fmtDur, buildItinerary, seasonNotes, weatherFor, weatherWarnings, WMO,
  computeBudget, daySpend, COST_CATS, defaultAssumptions, routeKey, tripPoints, BREAK_FACTOR,
} from './engine.js';

const hi = () => getLang() === 'hi';
const dur = (s) => fmtDur(s, hi());
const guard = () => {
  const d = loadDraft();
  if (!d || Object.keys(validate(d)).length) { location.hash = '#/plan/new'; return null; }
  return d;
};
export const itinKey = (d) => [routeKey(d), (d.route?.legs || []).map((l) => l.chosen || 0).join(''), d.depart, d.ret, d.pace, [...d.prefs].sort().join(','), d.roundTrip !== false, d.mode].join('#');
export const prefThemes = (d) => [...new Set(d.prefs.map((k) => PREFS.find((p) => p[0] === k)?.[3]).filter(Boolean))];
const legTitle = (pair) => (pair.ret ? `${L('Return', 'वापसी')}: ${pName(pair.from)} → ${pName(pair.to)}` : `${pName(pair.from)} → ${pName(pair.to)}`);
const errText = (e) => ({ no_route: L('No road route found between these points.', 'इन जगहों के बीच सड़क रास्ता नहीं मिला।'),
  offline: L('You seem to be offline.', 'आप ऑफ़लाइन लग रहे हैं।') })[e] || L('The route service did not answer. Try again in a moment.', 'रूट सेवा से जवाब नहीं आया। थोड़ी देर में फिर कोशिश करें।');

// ---------- shared: route map ----------
export function routeMap(d, { extra = null, height } = {}) {
  const box = h('div', { class: 'tp-map', style: height ? { height } : null }, h('p', { class: 'muted small tp-map-msg' }, L('Loading map…', 'मैप लोड हो रहा है…')));
  const api = { map: null, Lf: null, layer: null, draw: () => {} };
  api.draw = () => {
    const { map, Lf } = api; if (!map) return;
    if (api.layer) api.layer.remove();
    api.layer = Lf.layerGroup().addTo(map);
    const pts = tripPoints(d);
    const bounds = pts.map((p) => [p.lat, p.lng]);
    (d.route?.legs || []).forEach((leg) => {
      if (leg.error) return;
      const chosen = pickLeg(leg);
      [leg, ...(leg.alts || [])].forEach((r, i) => { if (r.coords !== chosen.coords) Lf.polyline(r.coords, { color: '#8aa39a', weight: 4, opacity: 0.55, dashArray: '6 8' }).addTo(api.layer); });
      Lf.polyline(chosen.coords, { color: leg.ret ? '#b08a3e' : '#1e5fd6', weight: 5, opacity: 0.9 }).addTo(api.layer);
      chosen.coords.forEach((c) => bounds.push(c));
    });
    if (!d.route) Lf.polyline(pts.map((p) => [p.lat, p.lng]), { color: '#1f4d3a', weight: 3, dashArray: '6 8' }).addTo(api.layer);
    pts.forEach((p, i) => Lf.marker([p.lat, p.lng], { icon: Lf.divIcon({ className: '', html: `<span class="tp-pin${i ? '' : ' start'}">${i ? i : 'S'}</span>`, iconSize: [30, 30], iconAnchor: [15, 15] }), title: pName(p), alt: pName(p) }).addTo(api.layer).bindTooltip(pName(p)));
    if (extra) extra(api);
    map.fitBounds(bounds, { padding: [28, 28], maxZoom: 11 });
  };
  (async () => {
    try { api.Lf = await loadLeaflet(); } catch {
      clear(box).append(h('p', { class: 'tp-map-msg error-box' }, L('Map could not load. Check your internet.', 'मैप लोड नहीं हुआ। इंटरनेट देखें।'))); return;
    }
    clear(box);
    api.map = api.Lf.map(box, { scrollWheelZoom: false });
    api.Lf.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap contributors' }).addTo(api.map);
    api.draw();
    setTimeout(() => api.map.invalidateSize(), 150);
  })();
  api.el = box;
  return api;
}

export function weatherChip(w) {
  if (!w) return null;
  const t = `${Math.round(w.min)}–${Math.round(w.max)}°C`;
  if (w.kind === 'history') {
    return h('span', { class: 'tp-wx hist', title: L('Historical average, not a forecast', 'पिछले सालों का औसत, पूर्वानुमान नहीं') },
      `${t} · ${L('avg', 'औसत')} ${w.years[0]}–${w.years[w.years.length - 1]}${w.rainyYears ? ` · ${L(`rain in ${w.rainyYears} of ${w.years.length} yrs`, `${w.years.length} में ${w.rainyYears} साल बारिश`)}` : ''}`);
  }
  const c = WMO[w.code]; const label = c ? (hi() ? c[1] : c[0]) : '';
  return h('span', { class: `tp-wx${weatherWarnings(w).length ? ' warn' : ''}` }, `${label ? `${label} · ` : ''}${t}${w.rainProb != null ? ` · ${w.rainProb}% ${L('rain', 'बारिश')}` : ''}`);
}

// ---------- Step 3: route ----------
export async function routeStep() {
  const d = guard(); if (!d) return h('div');
  const pairs = legPairs(d);
  const status = h('div', { class: 'tp-status', 'aria-live': 'polite' });
  const legsBox = h('ol', { class: 'tp-legs' });
  const totals = h('div', { class: 'tp-totals' });
  const wxBox = h('div', { class: 'tp-wxgrid' });
  const mapApi = routeMap(d);
  const recalc = h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => calc(true) }, L('Recalculate route', 'रूट फिर से निकालें'));

  function paint() {
    clear(legsBox); clear(totals);
    const r = d.route;
    if (!r) return;
    r.legs.forEach((leg, i) => {
      const pair = pairs[i];
      const li = h('li', { class: `tp-leg${leg.error ? ' bad' : ''}` }, h('strong', {}, legTitle(pair)));
      if (leg.error) {
        li.append(h('p', { class: 'tp-legerr' }, L('Route could not be calculated. ', 'रूट नहीं निकल पाया। '), errText(leg.error)));
      } else {
        const opts = [leg, ...(leg.alts || [])];
        const chosen = pickLeg(leg);
        li.append(h('p', { class: 'tp-legmeta' }, `${fmtKm(chosen.km)} · ${dur(chosen.secs)} ${L('driving', 'ड्राइव')}`, h('span', { class: 'muted' }, ` (${L('about', 'लगभग')} ${dur(chosen.secs * BREAK_FACTOR)} ${L('with breaks', 'आराम सहित')})`)));
        if (opts.length > 1) {
          li.append(h('div', { class: 'tp-alts', role: 'radiogroup', 'aria-label': L('Route options', 'रूट विकल्प') }, opts.map((o, k) =>
            h('label', { class: 'tp-alt' }, h('input', { type: 'radio', name: `leg-${i}`, checked: (leg.chosen || 0) === k, onchange: () => { leg.chosen = k; summarise(d.route); saveDraft(d); paint(); mapApi.draw(); } }),
              h('span', {}, `${L('Route', 'रूट')} ${k + 1}: ${fmtKm(o.km)} · ${dur(o.secs)}`)))));
        }
      }
      legsBox.append(li);
    });
    totals.append(
      h('div', {}, h('span', { class: 'muted small' }, L('Total road distance', 'कुल सड़क दूरी')), h('strong', {}, fmtKm(r.total_km))),
      h('div', {}, h('span', { class: 'muted small' }, L('Total driving time', 'कुल ड्राइव समय')), h('strong', {}, dur(r.total_secs))),
      h('div', {}, h('span', { class: 'muted small' }, L('Stretches', 'हिस्से')), h('strong', {}, `${r.legs.length - r.missing}/${r.legs.length}`)));
    if (r.missing) totals.append(h('p', { class: 'soft-note warn tp-span' }, L(`${r.missing} stretch(es) could not be calculated. Their distance is not counted — try again or change that stop.`, `${r.missing} हिस्से का रूट नहीं निकला। उसकी दूरी नहीं जोड़ी गई — फिर कोशिश करें या वह पड़ाव बदलें।`)));
  }
  async function calc(force) {
    recalc.disabled = true;
    status.textContent = L('Calculating road route…', 'सड़क का रास्ता निकाल रहे हैं…');
    d.route = await fetchRoute(d, { previous: force ? null : d.route, onProgress: (n, t) => { status.textContent = L(`Calculating road route… ${n}/${t}`, `सड़क का रास्ता निकाल रहे हैं… ${n}/${t}`); } });
    saveDraft(d);
    status.textContent = d.route.missing === d.route.legs.length ? L('The route service could not be reached.', 'रूट सेवा तक नहीं पहुँच पाए।') : '';
    recalc.disabled = false;
    paint(); mapApi.draw();
  }
  if (routeIsFresh(d) && !d.route.missing) paint(); else calc(false);

  // Weather now at each destination.
  d.dests.forEach((p) => {
    const card = h('div', { class: 'tp-wxcard' }, h('strong', {}, pName(p)), h('span', { class: 'muted small' }, L('Loading…', 'लोड हो रहा है…')));
    wxBox.append(card);
    weatherFor(p, []).then((w) => {
      card.lastChild.remove();
      if (!w.current) { card.append(h('span', { class: 'muted small' }, L('Weather not available right now', 'मौसम की जानकारी अभी उपलब्ध नहीं'))); return; }
      const c = WMO[w.current.code];
      card.append(h('span', { class: 'tp-wxnow' }, `${Math.round(w.current.temp)}°C`), h('span', { class: 'small' }, `${c ? (hi() ? c[1] : c[0]) : ''} · ${L('wind', 'हवा')} ${Math.round(w.current.wind)} km/h`));
    });
  });

  return h('div', { class: 'app-page tp-page' },
    h('div', { class: 'app-head' }, back('#/plan/map'), h('div', { class: 'grow' }, h('h1', {}, L('Road route', 'सड़क का रास्ता')),
      h('p', { class: 'muted' }, L('Each stretch is calculated on its own from OpenStreetMap road data.', 'हर हिस्सा OpenStreetMap सड़क डेटा से अलग-अलग निकाला गया है।')))),
    steps(2), status, mapApi.el,
    h('p', { class: 'small muted tp-legend' }, h('i', { class: 'lg-route' }), L('Chosen route', 'चुना गया रूट'), ' ', h('i', { class: 'lg-ret' }), L('Return', 'वापसी'), ' ', h('i', { class: 'lg-alt' }), L('Other options', 'दूसरे विकल्प')),
    totals, legsBox,
    h('div', { class: 'tp-inline' }, recalc, h('a', { class: 'btn btn-ghost', href: '#/plan/map' }, L('Change stops', 'पड़ाव बदलें'))),
    h('section', { class: 'tp-card' }, h('h2', {}, L('Weather now', 'अभी का मौसम')), wxBox, h('p', { class: 'small muted' }, L('Source: Open-Meteo. Day-by-day weather for your dates is on the next screen.', 'स्रोत: Open-Meteo। आपकी तारीख़ों का दिन-वार मौसम अगली स्क्रीन पर है।'))),
    h('div', { class: 'sticky-cta' }, h('a', { class: 'btn btn-lg btn-block', href: '#/plan/itinerary' }, L('Make my day-wise plan', 'मेरा दिन-वार प्लान बनाएँ'), icon('arrow', 16))));
}

// ---------- Step 4: itinerary ----------
async function loadCtx() {
  const [places, locs, themeList, listings] = await Promise.all([allPlaces(), locations(), themes(), fetchListings('homestay').catch(() => [])]);
  return { places, locs, themeList, listings };
}
export function generate(d, ctx) {
  const res = buildItinerary({ d, route: d.route, places: ctx.places, locs: ctx.locs, listings: ctx.listings, prefThemes: prefThemes(d) });
  d.days = res.days; d.daysKey = itinKey(d); d.daysEdited = false; d.itinWarnings = res.warnings;
  saveDraft(d);
  return res;
}
const itemText = (it) => it.text || (hi() ? it.hi || it.en : it.en);

export async function itineraryStep() {
  const d = guard(); if (!d) return h('div');
  if (!routeIsFresh(d)) { location.hash = '#/plan/route'; return h('div'); }
  const ctx = await loadCtx();
  const key = itinKey(d);
  let changed = false;
  if (!d.days || (d.daysKey !== key && !d.daysEdited)) generate(d, ctx);
  else if (d.daysKey !== key) changed = true;

  const wx = {}; // date -> weather at that night's place
  const body = h('div', { class: 'tp-days' });
  const titleI = h('input', { class: 'input tp-title', id: 'tp-title', maxlength: 120, value: d.title || `${pName(d.dests[d.dests.length - 1])} ${L('trip', 'ट्रिप')}` });
  titleI.addEventListener('input', () => { d.title = titleI.value; saveDraft(d); });
  if (!d.title) { d.title = titleI.value; saveDraft(d); }
  const budget = () => computeBudget(d, d.route, d.days);
  const edited = () => { d.daysEdited = true; saveDraft(d); };

  const regen = h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => {
    if (d.daysEdited && regen.dataset.armed !== '1') { regen.dataset.armed = '1'; regen.textContent = L('Your edits will be lost — tap again', 'आपके बदलाव हट जाएँगे — फिर टैप करें'); return; }
    generate(d, ctx); changed = false; paint(); loadWeather(); toast(L('New plan made', 'नया प्लान बन गया'));
    regen.dataset.armed = ''; regen.textContent = L('Regenerate itinerary', 'प्लान फिर से बनाएँ');
  } }, L('Regenerate itinerary', 'प्लान फिर से बनाएँ'));

  function dayCard(day, idx) {
    const b = budget();
    const spend = daySpend(day, b);
    const titleIn = h('input', { class: 'tp-daytitle', value: (hi() ? day.title_hi : day.title_en) || day.title_en, 'aria-label': `${L('Day', 'दिन')} ${day.day} ${L('title', 'शीर्षक')}` });
    titleIn.addEventListener('input', () => { day.title_en = day.title_hi = titleIn.value; edited(); });
    const list = h('ul', { class: 'tp-items' });
    const paintItems = () => {
      clear(list);
      day.items.forEach((it, k) => list.append(h('li', { class: `tp-item k-${it.kind}` },
        it.time ? h('span', { class: 'tp-time' }, it.time) : h('span', { class: 'tp-dot', 'aria-hidden': 'true' }),
        h('span', { class: 'grow' }, itemText(it), it.loc ? [' ', h('a', { href: `#/place/${it.loc}` }, L('About', 'जानकारी'))] : null),
        h('button', { type: 'button', class: 'tp-x', 'aria-label': L('Remove this activity', 'यह गतिविधि हटाएँ'), onclick: () => { day.items.splice(k, 1); edited(); paintItems(); } }, '✕'))));
    };
    paintItems();
    const addIn = h('input', { class: 'input', placeholder: L('Add an activity or note', 'गतिविधि या नोट जोड़ें'), 'aria-label': L(`Add activity to day ${day.day}`, `दिन ${day.day} में गतिविधि जोड़ें`) });
    const add = () => { const v = addIn.value.trim(); if (!v) return; day.items.push({ kind: 'custom', text: v }); addIn.value = ''; edited(); paintItems(); };
    addIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
    let stayBox = null;
    if (day.night) {
      const opts = day.stay?.options || [];
      const sel = h('select', { class: 'input', 'aria-label': L(`Stay on night ${day.day}`, `रात ${day.day} कहाँ रुकें`) },
        h('option', { value: '' }, L('Decide later / my own booking', 'बाद में तय / ख़ुद की बुकिंग')),
        opts.map((o) => h('option', { value: o.id, selected: day.stayChoice === o.id }, `${o.name}${o.price ? ` · ${inr(o.price)}/${L('night', 'रात')}` : ''}`)));
      sel.addEventListener('change', () => { day.stayChoice = sel.value || null; edited(); });
      stayBox = h('div', { class: 'tp-stay' }, h('span', { class: 'tp-stay-l' }, icon('home', 16), `${L('Night in', 'रात:')} ${pName(day.night)}`),
        opts.length ? sel : h('span', { class: 'muted small' }, L('No listed homestays here yet — ', 'यहाँ अभी कोई होमस्टे सूचीबद्ध नहीं — '), h('a', { href: '#/stays' }, L('see all stays', 'सभी होमस्टे'))),
        opts.length ? h('span', { class: 'muted small' }, L('Enquiry only — not a confirmed booking.', 'सिर्फ़ पूछताछ — बुकिंग पक्की नहीं।')) : null);
    }
    const notes = h('textarea', { class: 'input', rows: 2, placeholder: L('Your notes for this day', 'इस दिन के लिए आपके नोट') });
    notes.value = day.notes || '';
    notes.addEventListener('input', () => { day.notes = notes.value; edited(); });
    const wxEl = h('span', { class: 'tp-wxslot' }, weatherChip(wx[day.date]));
    const warnEls = weatherWarnings(wx[day.date]).map((w) => h('p', { class: 'tp-wxwarn' }, '⚠ ', L(w[1], w[2])));
    return h('article', { class: `tp-day t-${day.type}` },
      h('header', {}, h('span', { class: 'tp-daypill' }, `${L('Day', 'दिन')} ${day.day}`), h('span', { class: 'muted small' }, fmtD(day.date)), wxEl),
      titleIn,
      day.km ? h('p', { class: 'tp-daymeta' }, `${fmtKm(day.km)} · ${dur(day.secs)} ${L('driving', 'ड्राइव')}`) : null,
      ...warnEls, list,
      h('div', { class: 'tp-addline' }, addIn, h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: add }, L('Add', 'जोड़ें'))),
      stayBox, notes,
      h('p', { class: 'tp-spend' }, spend != null ? `${L('Estimated spend this day', 'इस दिन का अनुमानित ख़र्च')}: ${inr(spend)}` : h('a', { href: '#/plan/budget' }, L('Add costs in Budget to see daily spend', 'रोज़ का ख़र्च देखने के लिए बजट में रक़म डालें'))));
  }

  function paint() {
    clear(body);
    if (changed) body.append(h('div', { class: 'soft-note warn' }, L('You changed the trip details after editing this plan.', 'प्लान बदलने के बाद आपने ट्रिप की जानकारी बदली है।'), ' ', regen));
    (d.itinWarnings || []).forEach((w) => body.append(h('div', { class: `soft-note ${w[0] === 'too_short' ? 'warn' : ''}` }, L(w[1], w[2]),
      w[0] === 'too_short' ? [' ', h('a', { href: '#/plan/new' }, L('Change dates or pace', 'तारीख़ या रफ़्तार बदलें'))] : null)));
    seasonNotes(d.depart, d.ret).forEach((n) => body.append(h('p', { class: 'soft-note' }, L(n[0], n[1]))));
    (d.days || []).forEach((day, i) => body.append(dayCard(day, i)));
  }
  async function loadWeather() {
    const byPlace = new Map();
    (d.days || []).forEach((day) => {
      const p = day.night || day.stay?.place || d.dests[d.dests.length - 1];
      const k = `${p.lat},${p.lng}`; if (!byPlace.has(k)) byPlace.set(k, { p, dates: [] }); byPlace.get(k).dates.push(day.date);
    });
    for (const { p, dates } of byPlace.values()) {
      const w = await weatherFor(p, dates);
      Object.assign(wx, w.days);
    }
    paint();
  }
  paint();
  loadWeather();

  return h('div', { class: 'app-page tp-page' },
    h('div', { class: 'app-head' }, back('#/plan/route'), h('div', { class: 'grow' }, h('h1', {}, L('Day-wise plan', 'दिन-वार प्लान')),
      h('p', { class: 'muted' }, L('Built from real drive times and our destination list. Change anything you like.', 'असली ड्राइव समय और हमारी जगहों की सूची से बना। जो चाहें बदलें।')))),
    steps(3),
    h('label', { class: 'field-label', for: 'tp-title' }, L('Trip name', 'ट्रिप का नाम')), titleI,
    body,
    h('p', { class: 'small muted' }, L('Weather: Open-Meteo forecast for the next 16 days; later dates show the average of past years, clearly marked. Suggestions are not bookings.',
      'मौसम: अगले 16 दिनों का Open-Meteo पूर्वानुमान; आगे की तारीख़ों के लिए पिछले सालों का औसत, साफ़ लिखा हुआ। सुझाव बुकिंग नहीं हैं।')),
    h('div', { class: 'tp-inline' }, regen),
    h('div', { class: 'sticky-cta' }, h('a', { class: 'btn btn-lg btn-block', href: '#/plan/budget' }, L('Continue to budget', 'बजट पर आगे बढ़ें'), icon('arrow', 16))));
}

// ---------- Step 5: budget ----------
export async function budgetStep() {
  const d = guard(); if (!d) return h('div');
  if (!routeIsFresh(d)) { location.hash = '#/plan/route'; return h('div'); }
  const ctx = await loadCtx();
  if (!d.days) generate(d, ctx);
  // Starting values the admin set (labelled as such); the traveller's own numbers always win.
  const adminDefaults = ((await settings().catch(() => ({})))?.trip_defaults) || {};
  const fromAdmin = {};
  if (!d.assumptions) {
    const map = { fuel_price: adminDefaults.fuel_price, taxi_per_km: adminDefaults.taxi_per_km, food_per_person_day: adminDefaults.food_per_person_day, stay_per_night: adminDefaults.stay_per_night };
    Object.entries(map).forEach(([k, v]) => { if (v != null && v !== '' && Number(v) > 0) fromAdmin[k] = Number(v); });
  }
  d.assumptions = { ...defaultAssumptions(d), ...fromAdmin, ...(d.assumptions || {}) };
  d.actuals ||= {};
  saveDraft(d);
  const a = d.assumptions;
  const people = d.adults + d.children;

  // Real prices of listed homestays at the trip's stops (a hint, not a quote).
  const stopLocs = new Set(d.dests.map((p) => p.location_id).filter(Boolean));
  const prices = ctx.listings.filter((x) => stopLocs.has(x.location_id) && x.price_per_night).map((x) => x.price_per_night).sort((x, y) => x - y);

  const table = h('div', { class: 'tp-btable', role: 'table', 'aria-label': L('Budget', 'बजट') });
  const sums = h('div', { class: 'tp-bsum' });
  const money = (key, label, hint, attrs = {}) => {
    const inp = h('input', { class: 'input', type: 'number', inputmode: 'decimal', min: 0, id: `tp-a-${key}`, value: a[key] ?? '', ...attrs });
    inp.addEventListener('input', () => { a[key] = inp.value === '' ? '' : Number(inp.value); saveDraft(d); paint(); });
    return h('label', { class: 'field', for: `tp-a-${key}` }, h('span', { class: 'field-label' }, label), inp, hint ? h('span', { class: 'muted small' }, hint) : null);
  };
  const own = ['car', 'bike'].includes(d.mode);
  const mode = MODES.find((m) => m[0] === d.mode);
  const adminNote = Object.keys(fromAdmin).length ? h('p', { class: 'soft-note' }, L(`Some starting values are The Himalayan Horizon's estimates${adminDefaults.updated_on ? ` (checked ${adminDefaults.updated_on})` : ''}. Change them to your own.`,
    `कुछ शुरुआती रक़में The Himalayan Horizon के अनुमान हैं${adminDefaults.updated_on ? ` (${adminDefaults.updated_on} को जाँचे)` : ''}। इन्हें अपने हिसाब से बदलें।`)) : null;
  const assumptionsForm = h('div', { class: 'tp-agrid' },
    own ? money('fuel_price', L('Fuel price today (₹/litre)', 'आज का पेट्रोल/डीज़ल रेट (₹/लीटर)'), L('Check your local pump rate', 'अपने पंप का रेट देखें'), { step: 0.01, placeholder: L('e.g. 95', 'जैसे 95') }) : null,
    own ? money('mileage', L('Vehicle mileage (km/litre)', 'गाड़ी का माइलेज (किमी/लीटर)'), null, { step: 0.5 }) : null,
    own ? money('local_km_per_day', L('Local driving on sightseeing days (km/day)', 'घूमने वाले दिन लोकल ड्राइव (किमी/दिन)'), null) : null,
    d.mode === 'taxi' ? money('taxi_per_km', L('Taxi rate (₹ per km)', 'टैक्सी रेट (₹ प्रति किमी)'), L('Ask your driver or agency', 'ड्राइवर या एजेंसी से पूछें'), { placeholder: L('e.g. 14', 'जैसे 14') }) : null,
    d.mode === 'taxi' ? money('local_km_per_day', L('Local driving on sightseeing days (km/day)', 'घूमने वाले दिन लोकल ड्राइव (किमी/दिन)'), null) : null,
    ['bus', 'train', 'shared'].includes(d.mode) ? money('fare_per_person', L('Total fare per person (all legs, ₹)', 'प्रति व्यक्ति कुल किराया (सभी हिस्से, ₹)'), L('Use the fare shown when you book', 'बुकिंग में दिखा किराया डालें')) : null,
    money('rooms', L('Rooms per night', 'हर रात कमरे'), null, { min: 1, step: 1 }),
    money('stay_per_night', L('Stay cost per room per night (₹)', 'प्रति कमरा प्रति रात (₹)'),
      prices.length ? L(`Listed homestays at your stops: ${inr(prices[0])}–${inr(prices[prices.length - 1])} per night`, `आपके पड़ावों पर सूचीबद्ध होमस्टे: ${inr(prices[0])}–${inr(prices[prices.length - 1])} प्रति रात`) : L('No listed prices at your stops yet — enter what you expect', 'आपके पड़ावों पर अभी कोई रेट नहीं — अपना अंदाज़ा डालें')),
    money('food_per_person_day', L('Food per person per day (₹)', 'प्रति व्यक्ति प्रति दिन खाना (₹)'), null),
    money('activities', L('Activities (total ₹)', 'गतिविधियाँ (कुल ₹)'), null),
    money('permits', L('Trek permits & entry fees (total ₹)', 'परमिट और एंट्री फ़ीस (कुल ₹)'), null),
    money('local', L('Local transport (total ₹)', 'लोकल सफ़र (कुल ₹)'), null),
    money('tolls', L('Parking & tolls (total ₹)', 'पार्किंग और टोल (कुल ₹)'), d.mode === 'bike' ? L('Two-wheelers do not pay toll on national highways', 'नेशनल हाईवे पर दोपहिया का टोल नहीं लगता') : L('Toll rates: NHAI Rajmargyatra app', 'टोल रेट: NHAI राजमार्गयात्रा ऐप')),
    money('other', L('Other expenses (total ₹)', 'अन्य ख़र्च (कुल ₹)'), null),
    money('reserve_pct', L('Emergency reserve (% of total)', 'आपात रिज़र्व (कुल का %)'), null, { max: 50 }));

  function paint() {
    const b = computeBudget(d, d.route, d.days);
    clear(table).append(h('div', { class: 'tp-brow head', role: 'row' }, h('span', { role: 'columnheader' }, L('Category', 'श्रेणी')), h('span', { role: 'columnheader' }, L('Estimate', 'अनुमान')), h('span', { role: 'columnheader' }, L('Actual', 'असली'))));
    COST_CATS.forEach(([k, en, hiTxt]) => {
      const line = b.lines[k];
      if (!line) return;
      if (k === 'fuel' && !own) return;
      if (k === 'transport' && own) return;
      const act = h('input', { class: 'input', type: 'number', min: 0, inputmode: 'decimal', value: d.actuals[k] ?? '', 'aria-label': L(`Actual ${en}`, `असली ${hiTxt}`) });
      act.addEventListener('input', () => { d.actuals[k] = act.value === '' ? '' : Number(act.value); saveDraft(d); paintSums(computeBudget(d, d.route, d.days)); });
      table.append(h('div', { class: 'tp-brow', role: 'row' },
        h('span', { role: 'cell' }, h('strong', {}, L(en, hiTxt)), line.how ? h('small', { class: 'muted' }, line.how) : null),
        h('span', { role: 'cell', class: line.missing ? 'tp-miss' : '' }, line.missing ? L('Add amount', 'रक़म डालें') : inr(line.est)),
        h('span', { role: 'cell' }, act)));
    });
    paintSums(b);
  }
  function paintSums(b) {
    const stat = (label, value, cls = '') => h('div', { class: `tp-bstat ${cls}` }, h('span', {}, label), h('strong', {}, value));
    clear(sums).append(
      stat(L('Total estimate', 'कुल अनुमान'), inr(b.total), 'big'),
      stat(L('Per person', 'प्रति व्यक्ति'), `${inr(Math.round(b.perPerson))} (${b.people})`),
      stat(L('Per day', 'प्रति दिन'), inr(Math.round(b.perDay))),
      stat(L('Budget left', 'बचा बजट'), b.remaining == null ? L('Set a budget', 'बजट तय करें') : inr(b.remaining), b.remaining != null && b.remaining < 0 ? 'neg' : ''),
      stat(L('Actual spent', 'असली ख़र्च'), inr(b.actualTotal)),
      stat(L('Left after actual', 'असली ख़र्च के बाद बचा'), b.actualRemaining == null ? '—' : inr(b.actualRemaining), b.actualRemaining != null && b.actualRemaining < 0 ? 'neg' : ''));
    if (b.missing.length) sums.append(h('p', { class: 'soft-note warn tp-span' }, L('Some amounts are missing, so the total is incomplete: ', 'कुछ रक़में बाकी हैं, इसलिए कुल अधूरा है: '),
      b.missing.map((k) => L(COST_CATS.find((c) => c[0] === k)[1], COST_CATS.find((c) => c[0] === k)[2])).join(', ')));
    if (b.remaining != null && b.remaining < 0) sums.append(h('p', { class: 'soft-note warn tp-span' }, L('The estimate is above your budget. Try fewer nights, a simpler stay or a shorter route.', 'अनुमान आपके बजट से ज़्यादा है। कम रातें, सस्ता ठहराव या छोटा रूट आज़माएँ।')));
  }
  const budgetI = h('input', { class: 'input', type: 'number', min: 0, step: 500, id: 'tp-b-budget', value: d.budget });
  budgetI.addEventListener('input', () => { d.budget = budgetI.value === '' ? '' : Number(budgetI.value); saveDraft(d); paint(); });
  paint();

  return h('div', { class: 'app-page tp-page' },
    h('div', { class: 'app-head' }, back('#/plan/itinerary'), h('div', { class: 'grow' }, h('h1', {}, L('Trip budget', 'ट्रिप बजट')),
      h('p', { class: 'muted' }, L('All figures are estimates in ₹, not confirmed prices. Change any assumption.', 'सभी आँकड़े ₹ में अनुमान हैं, पक्के दाम नहीं। कोई भी अनुमान बदलें।')))),
    steps(4),
    h('section', { class: 'tp-card' }, h('label', { class: 'field', for: 'tp-b-budget' }, h('span', { class: 'field-label' }, L('Your total budget (₹)', 'आपका कुल बजट (₹)')), budgetI)),
    sums,
    h('section', { class: 'tp-card' }, h('h2', {}, L('Costs', 'ख़र्च')), h('p', { class: 'muted small' }, `${mode ? L(mode[1], mode[2]) : ''} · ${people} ${L('travellers', 'यात्री')} · ${d.route ? fmtKm(d.route.total_km) : ''} ${L('road distance', 'सड़क दूरी')}`), table),
    h('section', { class: 'tp-card' }, h('h2', {}, L('Your assumptions', 'आपके अनुमान')), adminNote, assumptionsForm),
    h('div', { class: 'sticky-cta' }, h('a', { class: 'btn btn-lg btn-block', href: '#/plan/summary' }, L('See trip summary', 'ट्रिप सारांश देखें'), icon('arrow', 16))));
}
