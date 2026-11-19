// Small DOM helpers so pages stay readable without a framework.
import { t, statusLabel } from './i18n.js';

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

export const empty = (text = t('nothing_here'), action) =>
  h('div', { class: 'empty' }, art('empty', 'meadow'), h('p', {}, text), action || null);

export const loading = () => h('div', { class: 'loading' }, h('span', { class: 'spinner' }), t('loading'));

export function errorBox(err) {
  console.error(err);
  return h('div', { class: 'error-box' }, `${t('error')}: ${err?.message || err}`);
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

// Cover image or artwork fallback
export function cover(url, seed, cls = 'cover') {
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
