// Place search for the cab module: suggestions while typing, typo-tolerant matching
// with a "Did you mean …?" confirmation, current location and a map picker.
// Uses the public `places` table (Uttarakhand towns, villages and hubs).
import { h, clear, modal, toast, icon } from './ui.js';
import { getLang } from './i18n.js';
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

// ---------- input component ----------
// placeInput({ label, value, onChange, placeholder, id })
// returns { el, get(), set(place), validate() }
export function placeInput({ label, value = null, onChange = () => {}, placeholder = '', id, compact = false }) {
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
      h('span', { class: 'pi-chip' }, h('strong', {}, placeName(selected)), selected.district ? h('small', {}, ` · ${selected.district}`) : null),
      h('button', { type: 'button', class: 'pi-clear', 'aria-label': L('Change place', 'जगह बदलें'), onclick: () => { set(null); inp.focus(); } }, '✕'));
    chosen.hidden = false; inp.hidden = true; clear(hint); close();
  }
  function set(p, { silent = false } = {}) {
    selected = p; inp.value = ''; paintChosen();
    if (!silent) onChange(p);
  }
  function close() { menu.hidden = true; inp.setAttribute('aria-expanded', 'false'); active = -1; }
  function open(items) {
    clear(menu);
    if (!items.length) {
      menu.append(h('li', { class: 'pi-empty' }, L('No matching place. Check the spelling or pick on the map.', 'कोई जगह नहीं मिली। स्पेलिंग देखें या मैप से चुनें।')));
    }
    items.forEach(({ place }, i) => menu.append(h('li', {
      role: 'option', id: `${id}-o${i}`, class: i === active ? 'on' : '', 'aria-selected': String(i === active),
      onmousedown: (e) => { e.preventDefault(); set(place); },
    }, h('strong', {}, placeName(place)), h('span', {}, [place.district, place.region !== 'Other' ? place.region : ''].filter(Boolean).join(' · ')))));
    menu.hidden = false; inp.setAttribute('aria-expanded', 'true');
  }
  let items = [];
  inp.addEventListener('input', () => {
    clear(hint);
    items = matchPlaces(list, inp.value);
    active = items.length ? 0 : -1;
    if (inp.value.trim()) open(items); else close();
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

  function useMyLocation() {
    if (!navigator.geolocation) { toast(L('Location is not available on this device', 'इस डिवाइस पर लोकेशन उपलब्ध नहीं है'), 'warn'); return; }
    clear(hint).append(h('span', {}, L('Finding your location…', 'आपकी लोकेशन ढूँढ रहे हैं…')));
    navigator.geolocation.getCurrentPosition((pos) => {
      const near = nearestPlace(list, { lat: pos.coords.latitude, lng: pos.coords.longitude });
      clear(hint);
      if (!near || near.d > 60) { hint.append(h('span', { class: 'pi-warn' }, L('No listed place near you. Please type the place.', 'आपके पास कोई सूचीबद्ध जगह नहीं है। जगह लिखें।'))); return; }
      hint.append(h('span', {}, L(`Nearest place: `, 'सबसे पास: ')),
        h('button', { type: 'button', class: 'pi-fix', onclick: () => set(near.place) }, `${placeName(near.place)} (${Math.round(near.d)} km)`),
        h('span', {}, L(' — tap to use it', ' — चुनने के लिए दबाएँ')));
    }, (err) => {
      clear(hint).append(h('span', { class: 'pi-warn' }, err.code === 1
        ? L('Location permission was not given. You can type the place instead.', 'लोकेशन की अनुमति नहीं मिली। जगह लिख सकते हैं।')
        : L('Could not get your location. Please type the place.', 'लोकेशन नहीं मिली। जगह लिखें।')));
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
  }

  async function pickOnMap() {
    const box = h('div', { class: 'map-box' }, h('p', { class: 'muted' }, L('Loading map…', 'मैप लोड हो रहा है…')));
    const dlg = modal(L('Pick a place on the map', 'मैप पर जगह चुनें'), h('div', {},
      h('p', { class: 'muted small' }, L('Tap a marker, or tap anywhere to choose the nearest listed place.', 'किसी निशान पर टैप करें, या कहीं भी टैप करके सबसे पास की जगह चुनें।')), box), { wide: true });
    try {
      const Lf = await loadLeaflet();
      clear(box);
      const map = Lf.map(box, { scrollWheelZoom: true }).setView([30.0, 79.2], 8);
      Lf.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap contributors' }).addTo(map);
      const choose = (p) => { set(p); dlg.close(); };
      list.forEach((p) => Lf.circleMarker([p.lat, p.lng], { radius: 6, color: '#1f4d3a', fillColor: '#b08a3e', fillOpacity: 0.9, weight: 2 })
        .addTo(map).bindTooltip(placeName(p)).on('click', () => choose(p)));
      map.on('click', (e) => {
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
