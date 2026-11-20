// Place search for the cab module: suggestions while typing, typo-tolerant matching
// with a "Did you mean …?" confirmation, current location and a map picker.
// Uses the public `places` table (Uttarakhand towns, villages and hubs).
import { h, clear, modal, toast, icon } from './ui.js';
import { getLang, districtName } from './i18n.js';
import { sb, q } from './sb.js';

const L = (en, hi) => (getLang() === 'hi' ? hi : en);
let cache = null;

export async function allPlaces() {
  if (!cache) cache = await q(sb.from('places').select('*').eq('is_active', true).order('name'));
  return cache;
}
export const placeName = (p) => (p ? (getLang() === 'hi' && p.name_hi ? p.name_hi : p.name) : '');
export const placeById = (id) => (cache || []).find((p) => p.id === id) || null;
export const placesCached = () => cache || [];

// ---------- matching ----------
const norm = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ऀ-ॿ]/g, '');

function lev(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) cur[j] = Math.min(cur[j], prev[j - 2] + 1);
    }
    prev = cur;
  }
  return prev[n];
}

function scoreOne(qn, cand) {
  const c = norm(cand);
  if (!c || !qn) return 0;
  if (c === qn) return 100;
  if (c.startsWith(qn)) return 90 - Math.min(20, c.length - qn.length);
  if (c.includes(qn) && qn.length >= 3) return 70;
  if (qn.length < 3) return 0;
  // Typo tolerance: compare with the whole word and with its start.
  const whole = 1 - lev(qn, c) / Math.max(qn.length, c.length);
  const head = 1 - lev(qn, c.slice(0, qn.length)) / qn.length;
  const best = Math.max(whole, head * 0.95);
  return best >= 0.6 ? Math.round(best * 65) : 0;
}

// Returns [{ place, score, exact }] best first.
export function matchPlaces(list, text, limit = 6) {
  const qn = norm(text);
  if (!qn) return [];
  return list
    .map((p) => {
      const names = [p.name, p.name_hi, ...(p.aliases || [])];
      const score = Math.max(...names.map((n) => scoreOne(qn, n)));
      return { place: p, score, exact: names.some((n) => norm(n) === qn) };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || (a.place.kind === 'village') - (b.place.kind === 'village'))
    .slice(0, limit);
}

const toRad = (d) => (d * Math.PI) / 180;
export function distanceKm(a, b) {
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(x));
}
export function nearestPlace(list, point) {
  let best = null;
  for (const p of list) { const d = distanceKm(point, p); if (!best || d < best.d) best = { place: p, d }; }
  return best;
}

// ---------- every town and village: OpenStreetMap search (Photon) ----------
// Our own list comes first; Photon fills in the thousands of villages we have not listed.
// Free service with fair-use limits: requests are debounced, cached and cancelled when you keep typing.
const PHOTON = 'https://photon.komoot.io';
const extCache = new Map();
let extCtl = null;
const IN_BBOX = '68.1,6.5,97.4,35.7'; // India
function photonPlace(f) {
  const p = f.properties || {}; const [lng, lat] = f.geometry?.coordinates || [];
  const name = p.name || p.village || p.town || p.city || p.locality || p.district;
  if (!name || lat == null) return null;
  return { id: null, ext: true, name, name_hi: null, district: p.county || p.district || p.city || null, region: p.state || null,
    lat: +(+lat).toFixed(5), lng: +(+lng).toFixed(5), kind: p.osm_value || 'place' };
}
export async function searchExternal(text) {
  const qt = text.trim().toLowerCase();
  if (qt.length < 3) return [];
  if (extCache.has(qt)) return extCache.get(qt);
  if (extCtl) extCtl.abort();
  extCtl = new AbortController();
  const url = `${PHOTON}/api/?q=${encodeURIComponent(text.trim())}&limit=10&lang=en&lat=30.07&lon=79.3&bbox=${IN_BBOX}`;
  const res = await fetch(url, { signal: extCtl.signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const out = (data.features || []).filter((f) => !f.properties?.countrycode || f.properties.countrycode === 'IN')
    .filter((f) => !['house', 'street', 'road', 'residential', 'yes'].includes(f.properties?.osm_value) || f.properties?.osm_key === 'place')
    .map(photonPlace).filter(Boolean);
  const seen = new Set(); const uniq = out.filter((x) => { const k = `${x.name}|${x.district}`; if (seen.has(k)) return false; seen.add(k); return true; });
  extCache.set(qt, uniq);
  return uniq;
}
export async function reverseExternal(lat, lng) {
  const res = await fetch(`${PHOTON}/reverse?lat=${lat}&lon=${lng}&lang=en&limit=1`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const f = (await res.json()).features?.[0];
  return f ? photonPlace(f) : null;
}
// Phone location: quick network fix first, then GPS if that fails.
export function currentPosition() {
  if (!navigator.geolocation) return Promise.reject(Object.assign(new Error('unsupported'), { code: 0 }));
  const get = (opts) => new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, opts));
  return get({ enableHighAccuracy: false, timeout: 12000, maximumAge: 600000 })
    .catch((e) => (e.code === 1 ? Promise.reject(e) : get({ enableHighAccuracy: true, timeout: 25000, maximumAge: 0 })));
}
export function locationErrorText(err) {
  if (err.code === 0) return L('This phone or browser does not share location. Please type the place.', 'यह फ़ोन/ब्राउज़र लोकेशन नहीं देता। जगह लिखें।');
  if (err.code === 1) return L('Location permission is off for this site. Allow it in the browser (lock icon → Permissions → Location), or type the place.', 'इस साइट के लिए लोकेशन की अनुमति बंद है। ब्राउज़र में अनुमति दें (ताले का निशान → Permissions → Location), या जगह लिखें।');
  if (err.code === 2) return L('Your phone could not find its location. Turn on Location (GPS) and try again.', 'फ़ोन अपनी लोकेशन नहीं ढूँढ पाया। Location (GPS) चालू करके फिर कोशिश करें।');
  return L('Finding your location took too long. Move to open sky or try again.', 'लोकेशन ढूँढने में बहुत समय लगा। खुली जगह पर जाकर फिर कोशिश करें।');
}

// ---------- input component ----------
// placeInput({ label, value, onChange, placeholder, id })
// returns { el, get(), set(place), validate() }
export function placeInput({ label, value = null, onChange = () => {}, placeholder = '', id, compact = false, external = false }) {
  let selected = value;
  let list = cache || [];
  let active = -1;
  const inp = h('input', { class: 'pi-input', id, type: 'text', autocomplete: 'off', spellcheck: 'false', placeholder,
    role: 'combobox', 'aria-autocomplete': 'list', 'aria-expanded': 'false', 'aria-controls': `${id}-list` });
  const menu = h('ul', { class: 'pi-menu', id: `${id}-list`, role: 'listbox', hidden: true });
  const hint = h('div', { class: 'pi-hint', 'aria-live': 'polite' });
  const chosen = h('div', { class: 'pi-chosen', hidden: true });
  const wrap = h('div', { class: `pi${compact ? ' pi-compact' : ''}` },
    h('label', { class: 'pi-label', for: id }, label),
    h('div', { class: 'pi-box' }, icon('map', 18), inp, chosen),
    menu, hint,
    h('div', { class: 'pi-tools' },
      h('button', { type: 'button', class: 'pi-tool', onclick: useMyLocation }, icon('globe', 15), L('Use my location', 'मेरी लोकेशन')),
      h('button', { type: 'button', class: 'pi-tool', onclick: pickOnMap }, icon('map', 15), L('Pick on map', 'मैप से चुनें'))));

  allPlaces().then((l) => { list = l; if (selected) paintChosen(); }).catch(() => {});

  function paintChosen() {
    clear(chosen);
    if (!selected) { chosen.hidden = true; inp.hidden = false; return; }
    chosen.append(
      h('span', { class: 'pi-chip' }, h('strong', {}, placeName(selected)), selected.district ? h('small', {}, ` · ${districtName(selected.district)}`) : null),
      h('button', { type: 'button', class: 'pi-clear', 'aria-label': L('Change place', 'जगह बदलें'), onclick: () => { set(null); inp.focus(); } }, '✕'));
    chosen.hidden = false; inp.hidden = true; clear(hint); close();
  }
  function set(p, { silent = false } = {}) {
    selected = p; inp.value = ''; paintChosen();
    if (!silent) onChange(p);
  }
  function close() { menu.hidden = true; inp.setAttribute('aria-expanded', 'false'); active = -1; }
  function open(list2) {
    clear(menu);
    const row = (place, i) => h('li', {
      role: 'option', id: `${id}-o${i}`, class: `${i === active ? 'on' : ''}${place.ext ? ' ext' : ''}`, 'aria-selected': String(i === active),
      onmousedown: (e) => { e.preventDefault(); set(place); },
    }, h('strong', {}, placeName(place)), h('span', {}, [districtName(place.district), place.region && place.region !== 'Other' ? districtName(place.region) : ''].filter(Boolean).join(' · ')));
    let shownExtLabel = false;
    list2.forEach(({ place, ext }, i) => {
      if (ext && !shownExtLabel) { shownExtLabel = true; menu.append(h('li', { class: 'pi-group', role: 'presentation' }, L('More places (OpenStreetMap)', 'और जगहें (OpenStreetMap)'))); }
      menu.append(row(place, i));
    });
    if (typeof extState !== 'undefined' && extState === 'loading') menu.append(h('li', { class: 'pi-group', role: 'presentation' }, L('Searching all towns and villages…', 'सभी कस्बे और गाँव खोज रहे हैं…')));
    if (typeof extState !== 'undefined' && extState === 'error') menu.append(h('li', { class: 'pi-empty' }, L('More places could not load (check internet). Showing our list.', 'और जगहें लोड नहीं हुईं (इंटरनेट देखें)। हमारी सूची दिखा रहे हैं।')));
    if (!list2.length && !(typeof extState !== 'undefined' && extState === 'loading')) {
      menu.append(h('li', { class: 'pi-empty' }, external ? L('No place found. Check the spelling, or use “Pick on map”.', 'कोई जगह नहीं मिली। स्पेलिंग देखें या “मैप से चुनें” इस्तेमाल करें।')
        : L('This place is not on our route list yet. Try the nearest town, or pick on the map.', 'यह जगह अभी हमारी सूची में नहीं है। पास का कस्बा लिखें या मैप से चुनें।')));
    }
    menu.hidden = false; inp.setAttribute('aria-expanded', 'true');
  }
  let items = [];
  let extItems = []; let extState = 'idle'; let extTimer = null; let lastText = '';
  const near = (a, b) => distanceKm(a, b) < 3;
  function refresh() {
    const local = matchPlaces(list, inp.value);
    const ext = extItems.filter((e) => !local.some(({ place }) => near(place, e) && norm(place.name) === norm(e.name))).map((place) => ({ place, ext: true }));
    items = [...local, ...ext];
    if (active >= items.length) active = items.length - 1;
    if (active < 0 && items.length) active = 0;
    if (inp.value.trim()) open(items); else close();
  }
  inp.addEventListener('input', () => {
    clear(hint);
    active = 0;
    extItems = [];
    const text = inp.value; lastText = text;
    extState = external && text.trim().length >= 3 ? 'loading' : 'idle';
    refresh();
    clearTimeout(extTimer);
    if (extState === 'loading') {
      extTimer = setTimeout(() => {
        searchExternal(text).then((r) => { if (lastText !== text) return; extItems = r; extState = 'done'; refresh(); })
          .catch((e) => { if (e.name === 'AbortError' || lastText !== text) return; extState = 'error'; refresh(); });
      }, 350);
    }
  });
  inp.addEventListener('keydown', (e) => {
    if (menu.hidden && e.key !== 'Enter') return;
    if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(active + 1, items.length - 1); open(items); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(active - 1, 0); open(items); }
    else if (e.key === 'Enter') { if (items[active]) { e.preventDefault(); set(items[active].place); } }
    else if (e.key === 'Escape') close();
  });
  inp.addEventListener('blur', () => { setTimeout(() => { close(); suggestFix(); }, 120); });

  // Typed text that was not picked: offer the closest match, never change it silently.
  function suggestFix() {
    if (selected || !inp.value.trim()) return false;
    if (external && extItems.length) {
      clear(hint).append(h('span', {}, L('Choose one: ', 'एक चुनें: ')),
        ...extItems.slice(0, 3).flatMap((place, i) => [i ? ' / ' : '', h('button', { type: 'button', class: 'pi-fix', onclick: () => set(place) }, `${place.name}${place.district ? `, ${place.district}` : ''}`)]));
      return true;
    }
    const best = matchPlaces(list, inp.value, 3);
    clear(hint);
    if (!best.length) {
      hint.append(h('span', { class: 'pi-warn' }, L(`We could not find “${inp.value.trim()}”. Check the spelling or pick on the map.`, `“${inp.value.trim()}” नहीं मिला। स्पेलिंग देखें या मैप से चुनें।`)));
      return false;
    }
    hint.append(h('span', {}, L('Did you mean ', 'क्या आपका मतलब ')),
      ...best.flatMap(({ place }, i) => [i ? ' / ' : '', h('button', { type: 'button', class: 'pi-fix', onclick: () => set(place) }, placeName(place))]),
      h('span', {}, L('?', ' था?')));
    return true;
  }

  async function useMyLocation() {
    clear(hint).append(h('span', {}, L('Finding your location…', 'आपकी लोकेशन ढूँढ रहे हैं…')));
    let pos;
    try { pos = await currentPosition(); } catch (err) { clear(hint).append(h('span', { class: 'pi-warn' }, locationErrorText(err))); return; }
    const pt = { lat: +pos.coords.latitude.toFixed(5), lng: +pos.coords.longitude.toFixed(5) };
    const nearest = nearestPlace(list, pt);
    clear(hint);
    if (external) {
      let named = null;
      try { named = await reverseExternal(pt.lat, pt.lng); } catch { /* name lookup failed: still use the exact point */ }
      const here = { id: null, ext: true, name: named?.name || L('My location', 'मेरी लोकेशन'), district: named?.district || nearest?.place?.district || null, region: named?.region || null, ...pt };
      // A listed place right here is better (it links to our pages and rides).
      const use = nearest && nearest.d <= 2 ? nearest.place : here;
      set(use);
      toast(`${L('Using your location', 'आपकी लोकेशन')}: ${placeName(use)}`, 'ok');
      return;
    }
    if (!nearest) { hint.append(h('span', { class: 'pi-warn' }, L('No listed place found. Please type the place.', 'कोई सूचीबद्ध जगह नहीं मिली। जगह लिखें।'))); return; }
    hint.append(h('span', {}, L('Nearest place on our routes: ', 'हमारे रूट पर सबसे पास: ')),
      h('button', { type: 'button', class: 'pi-fix', onclick: () => set(nearest.place) }, `${placeName(nearest.place)} (${Math.round(nearest.d)} km)`),
      h('span', {}, L(' — tap to use it', ' — चुनने के लिए दबाएँ')));
  }

  async function pickOnMap() {
    const box = h('div', { class: 'map-box' }, h('p', { class: 'muted' }, L('Loading map…', 'मैप लोड हो रहा है…')));
    const dlg = modal(L('Pick a place on the map', 'मैप पर जगह चुनें'), h('div', {},
      h('p', { class: 'muted small' }, external ? L('Tap anywhere on the map to choose that spot.', 'मैप पर कहीं भी टैप करके वह जगह चुनें।') : L('Tap a marker, or tap anywhere to choose the nearest listed place.', 'किसी निशान पर टैप करें, या कहीं भी टैप करके सबसे पास की जगह चुनें।')), box), { wide: true });
    try {
      const Lf = await loadLeaflet();
      clear(box);
      const map = Lf.map(box, { scrollWheelZoom: true }).setView([30.0, 79.2], 8);
      Lf.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap contributors' }).addTo(map);
      const choose = (p) => { set(p); dlg.close(); };
      list.forEach((p) => Lf.circleMarker([p.lat, p.lng], { radius: 6, color: '#1f4d3a', fillColor: '#b08a3e', fillOpacity: 0.9, weight: 2 })
        .addTo(map).bindTooltip(placeName(p)).on('click', () => choose(p)));
      map.on('click', async (e) => {
        if (external) {
          const pt = { lat: +e.latlng.lat.toFixed(5), lng: +e.latlng.lng.toFixed(5) };
          let named = null; try { named = await reverseExternal(pt.lat, pt.lng); } catch { /* keep the exact point */ }
          const listed = nearestPlace(list, pt);
          choose(listed && listed.d <= 2 ? listed.place : { id: null, ext: true, name: named?.name || `${pt.lat}, ${pt.lng}`, district: named?.district || null, region: named?.region || null, ...pt });
          return;
        }
        const near = nearestPlace(list, { lat: e.latlng.lat, lng: e.latlng.lng });
        if (near) Lf.popup().setLatLng(e.latlng).setContent(`<button type="button" class="btn btn-sm" id="pick-near">${placeName(near.place)} (${Math.round(near.d)} km) ✓</button>`).openOn(map);
        setTimeout(() => document.getElementById('pick-near')?.addEventListener('click', () => choose(near.place)), 0);
      });
      setTimeout(() => map.invalidateSize(), 150);
    } catch {
      clear(box).append(h('p', { class: 'error-box' }, L('The map could not load. Check your internet and try again, or type the place.', 'मैप लोड नहीं हुआ। इंटरनेट देखें या जगह लिखें।')));
    }
  }

  if (selected) paintChosen();
  return {
    el: wrap,
    get: () => selected,
    set: (p) => set(p, { silent: true }),
    validate() {
      if (selected) return true;
      if (!suggestFix()) { if (!inp.value.trim()) clear(hint).append(h('span', { class: 'pi-warn' }, L('Please choose a place', 'कृपया जगह चुनें'))); }
      inp.focus();
      return false;
    },
  };
}

let leafletPromise = null;
export function loadLeaflet() {
  if (window.L?.map) return Promise.resolve(window.L);
  if (!leafletPromise) {
    leafletPromise = new Promise((resolve, reject) => {
      const css = document.createElement('link');
      css.rel = 'stylesheet'; css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.append(css);
      const s = document.createElement('script');
      s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      s.onload = () => resolve(window.L); s.onerror = () => { leafletPromise = null; reject(new Error('map')); };
      document.head.append(s);
    });
  }
  return leafletPromise;
}
