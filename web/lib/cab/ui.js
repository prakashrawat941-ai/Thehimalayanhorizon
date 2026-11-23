// Small DOM helpers so pages stay readable without a framework.
import { t, statusLabel, getLang } from './i18n.js';

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v; // only used with trusted, static strings
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export const clear = (el) => { while (el.firstChild) el.firstChild.remove(); return el; };

export const inr = (n) => (n == null || n === '' ? '' : '₹' + Number(n).toLocaleString('en-IN'));

export function fmtDate(d, withTime = false) {
  if (!d) return '';
  const date = new Date(d);
  const opts = { day: 'numeric', month: 'short', year: 'numeric' };
  if (withTime) Object.assign(opts, { hour: 'numeric', minute: '2-digit' });
  return date.toLocaleString('en-IN', opts);
}

export const todayISO = (offsetDays = 0) => {
  const d = new Date(Date.now() + offsetDays * 864e5);
  return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
};

// Toast messages
export function toast(msg, kind = 'ok') {
  const box = document.getElementById('toasts');
  const el = h('div', { class: `toast toast-${kind}`, role: 'status' }, msg);
  box.append(el);
  setTimeout(() => el.classList.add('out'), 3200);
  setTimeout(() => el.remove(), 3700);
}

// Modal dialog; returns { close }
export function modal(title, body, { wide = false } = {}) {
  const dlg = h('dialog', { class: `modal${wide ? ' modal-wide' : ''}` },
    h('div', { class: 'modal-head' },
      h('h3', {}, title),
      h('button', { class: 'icon-btn', 'aria-label': t('close'), onclick: () => close() }, '✕')),
    h('div', { class: 'modal-body' }, body));
  const close = () => { dlg.close(); dlg.remove(); };
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  document.body.append(dlg);
  dlg.showModal();
  return { close, el: dlg };
}

export const badge = (status) => h('span', { class: `badge badge-${status}` }, statusLabel(status));

// Empty state: icon, one line and (optionally) the next step.
export const empty = (text = t('nothing_here'), action, iconName = 'layers') =>
  h('div', { class: 'empty' }, h('span', { class: 'empty-ico' }, icon(iconName, 26)), h('p', {}, text), action || null);

export const loading = () => h('div', { class: 'loading' }, h('span', { class: 'spinner' }), t('loading'));

export function errorBox(err) {
  console.error(err);
  const hi = getLang() === 'hi';
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  return h('div', { class: 'error-box', role: 'alert' },
    h('span', { class: 'empty-ico err' }, icon('alert', 22)),
    h('div', {}, h('strong', {}, offline ? (hi ? 'आप ऑफ़लाइन हैं' : 'You are offline') : (hi ? 'यह हिस्सा लोड नहीं हुआ' : "Couldn't load this")),
      h('p', {}, offline ? (hi ? 'इंटरनेट जुड़ने पर फिर कोशिश करें।' : 'Try again when you are back online.') : `${t('error')}: ${err?.message || err}`)),
    h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => location.reload() }, hi ? 'फिर कोशिश करें' : 'Try again'));
}

// Async section: shows a spinner, then whatever `fn` returns.
export function lazy(fn) {
  const box = h('div', { class: 'lazy' }, loading());
  Promise.resolve().then(fn).then(
    (node) => { clear(box); if (node) box.append(node); },
    (err) => { clear(box); box.append(errorBox(err)); });
  return box;
}

// Illustrated mountain artwork used when a place has no photo yet.
const palettes = {
  dawn:   ['#f6d8b8', '#e9a77b', '#b5532b', '#5b2a1c'],
  pine:   ['#dbe8dc', '#9cc0a4', '#2f6b4f', '#173628'],
  snow:   ['#e8f0f6', '#b9cfe0', '#3b6e8f', '#1c3446'],
  dusk:   ['#eadcf0', '#c3a3d1', '#8a5a9e', '#3d2448'],
  meadow: ['#eef0d8', '#c9d38f', '#5d7a2e', '#2b3a14'],
  gold:   ['#f7ebc9', '#e3c278', '#c08a1e', '#5a3f08'],
};
const paletteNames = Object.keys(palettes);
export function paletteFor(seed = '') {
  let n = 0; for (const ch of String(seed)) n = (n * 31 + ch.charCodeAt(0)) >>> 0;
  return paletteNames[n % paletteNames.length];
}
export function art(seed, palette) {
  const [sky, far, mid, near] = palettes[palette || paletteFor(seed)];
  let n = 7; for (const ch of String(seed)) n = (n * 17 + ch.charCodeAt(0)) % 9973;
  const rnd = (i) => ((n * (i + 11) * 2654435761) >>> 0) % 1000 / 1000;
  // Jagged ridge: alternating peaks and saddles.
  const ridge = (base, amp, count, off) => Array.from({ length: count + 1 }, (_, i) => {
    const x = Math.round((i / count) * 420);
    const y = Math.round(base - (i % 2 ? amp * (0.55 + 0.45 * rnd(i + off)) : amp * 0.25 * rnd(i + off * 3)));
    return `${x},${y}`;
  });
  const far1 = ridge(150, 95, 6, 1);
  const snow = far1.map((pt, i) => {
    if (i % 2 === 0 || i === far1.length - 1) return '';
    const [x, y] = pt.split(',').map(Number);
    return `<path d="M${x},${y} L${x - 16},${y + 20} L${x - 6},${y + 15} L${x},${y + 22} L${x + 7},${y + 14} L${x + 16},${y + 20} Z" fill="#fff" opacity=".9"/>`;
  }).join('');
  const poly = (pts, fill) => `<path d="M0,240 L${pts.join(' L')} L420,240 Z" fill="${fill}"/>`;
  const svg = `<svg viewBox="0 0 420 240" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect width="420" height="240" fill="${sky}"/>
    <circle cx="${80 + Math.round(rnd(5) * 260)}" cy="52" r="20" fill="#fff" opacity=".6"/>
    ${poly(far1, far)}${snow}
    ${poly(ridge(188, 55, 9, 7), mid)}
    ${poly(ridge(222, 26, 14, 13), near)}
  </svg>`;
  return h('div', { class: 'art', html: svg });
}

// Bundled stand-in photos for places that have no photo in the database yet.
// Replace with real photos (admin upload or Unsplash) before launch.
export const localPhotos = {
  almora: 'img/places/almora.jpg', jageshwar: 'img/places/jageshwar.jpg',
  binsar: 'img/places/binsar.jpg', munsiyari: 'img/places/munsiyari.jpg',
};

// Line icons (static, trusted markup).
const ICONS = {
  car: '<path d="M5 17h14M6 17l1.5-5.5A2 2 0 0 1 9.4 10h5.2a2 2 0 0 1 1.9 1.5L18 17v2h-2v-2M6 17v2h2v-2"/>',
  map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2ZM9 4v14M15 6v14"/>',
  mountain: '<path d="M2 20 9.5 7l3.5 6 3-5 6 12Z"/>',
  home: '<path d="M3 11 12 4l9 7M5 10v10h14V10"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  wifi: '<path d="M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19.5" r="1" fill="currentColor"/>',
  leaf: '<path d="M5 19c0-8 5-14 15-15-1 10-7 15-15 15ZM5 19l7-7"/>',
  people: '<circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="7" r="2.5"/><circle cx="12" cy="10" r="2.5"/><path d="M3 20v-3a4 4 0 0 1 4-4M21 20v-3a4 4 0 0 0-4-4M8 21v-2a4 4 0 0 1 8 0v2"/>',
  desk: '<path d="M3 10h18M5 10v10M19 10v10M7 6h10v4H7z"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6Z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  house: '<path d="M3 11 12 4l9 7M5 10v10h14V10M10 20v-6h4v6"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.5-5 6.5-5s5.7 1.5 6.5 5"/><circle cx="17" cy="9" r="2.5"/><path d="M17 14c2.5 0 4 1.3 4.6 4"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  route: '<circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8.5 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z"/>',
  support: '<path d="M4 13a8 8 0 0 1 16 0v4a2 2 0 0 1-2 2h-2v-6h4M4 13v4a2 2 0 0 0 2 2h2v-6H4"/>',
  log: '<path d="M5 4h14v16H5z"/><path d="M9 8h6M9 12h6M9 16h4"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  doc: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
  heart: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10Z"/>',
  pin: '<path d="M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12Z"/><circle cx="12" cy="9" r="2.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="m5 12 4.5 4.5L19 7"/>',
  alert: '<path d="M12 3 2 20h20Z"/><path d="M12 10v4M12 17v.5"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5Z"/><path d="m3 13 9 5 9-5"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  logout: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>',
};
export function icon(name, size = 20) {
  return h('span', { class: 'ico', 'aria-hidden': 'true', html:
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>` });
}

// Cover image or artwork fallback
export function cover(url, seed, cls = 'cover') {
  if (!url && localPhotos[seed]) url = localPhotos[seed];
  if (url) {
    const img = h('img', { src: url, alt: '', loading: 'lazy', class: cls });
    img.addEventListener('error', () => img.replaceWith(art(seed)));
    return img;
  }
  const a = art(seed); a.classList.add(cls); return a;
}

export function card({ href, image, seed, title, subtitle, meta, tag }) {
  return h('a', { class: 'card', href },
    h('div', { class: 'card-media' }, cover(image, seed || title), tag ? h('span', { class: 'card-tag' }, tag) : null),
    h('div', { class: 'card-body' },
      h('h3', { class: 'card-title' }, title),
      subtitle ? h('p', { class: 'card-sub' }, subtitle) : null,
      meta ? h('div', { class: 'card-meta' }, meta) : null));
}

export const section = (title, subtitle, content, action) =>
  h('section', { class: 'section' },
    h('div', { class: 'section-head' },
      h('div', {}, h('h2', {}, title), subtitle ? h('p', { class: 'muted' }, subtitle) : null),
      action || null),
    content);

export const grid = (items, cls = 'grid') => h('div', { class: cls }, items);

export const chips = (items) => h('div', { class: 'chips' }, items.filter(Boolean).map((x) => h('span', { class: 'chip' }, x)));

// Form helpers
export function field(label, input, hint) {
  return h('label', { class: 'field' }, h('span', { class: 'field-label' }, label), input, hint ? h('small', { class: 'muted' }, hint) : null);
}
export const input = (attrs) => h('input', { class: 'input', ...attrs });
export const textarea = (attrs, value = '') => { const el = h('textarea', { class: 'input', rows: 4, ...attrs }); el.value = value ?? ''; return el; };
export function select(options, value, attrs = {}) {
  const el = h('select', { class: 'input', ...attrs },
    options.map(([v, label]) => h('option', { value: v }, label)));
  if (value != null) el.value = value;
  return el;
}

export function formData(form) {
  const fd = new FormData(form);
  return Object.fromEntries(fd.entries());
}

// Disable a button while an async action runs; shows errors as toasts.
export async function busy(btn, fn) {
  const old = btn.textContent;
  btn.disabled = true; btn.textContent = t('loading');
  try { return await fn(); }
  catch (e) { toast(e.message || String(e), 'err'); }
  finally { btn.disabled = false; btn.textContent = old; }
}

export const whatsappLink = (num, text) =>
  num ? `https://wa.me/${String(num).replace(/\D/g, '')}?text=${encodeURIComponent(text || '')}` : null;
