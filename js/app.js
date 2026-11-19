// App shell: header, bottom tab bar (phone), router and service worker.
import { h, clear, toast, errorBox, loading, icon } from './ui.js';
import { t, getLang, setLang } from './i18n.js';
import { state, initAuth, onChange, user, isAdmin, settings } from './store.js';
import { sb } from './sb.js';

const routes = [];
const route = (pattern, loader) => {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
  routes.push({ re, keys, loader });
};

// Pages are loaded on demand so the first screen is fast.
route('',                 () => import('./pages/public.js').then((m) => m.home));
route('explore',          () => import('./pages/public.js').then((m) => m.explore));
route('place/:slug',      () => import('./pages/public.js').then((m) => m.place));
route('villages',         () => import('./pages/public.js').then((m) => m.villages));
route('itineraries',      () => import('./pages/public.js').then((m) => m.itineraries));
route('itinerary/:slug',  () => import('./pages/public.js').then((m) => m.itinerary));
route('stays',            () => import('./pages/listings.js').then((m) => m.list('homestay')));
route('stay/:id',         () => import('./pages/listings.js').then((m) => m.detail('homestay')));
route('workspaces',       () => import('./pages/listings.js').then((m) => m.list('workspace')));
route('workspace/:id',    () => import('./pages/listings.js').then((m) => m.detail('workspace')));
route('tours',            () => import('./pages/listings.js').then((m) => m.list('village_tour')));
route('tour/:id',         () => import('./pages/listings.js').then((m) => m.detail('village_tour')));
route('cabs',             () => import('./pages/cab.js').then((m) => m.find));
route('cab',              () => import('./pages/cab.js').then((m) => m.entry));
route('cab/find',         () => import('./pages/cab.js').then((m) => m.find));
route('cab/ride/:id',     () => import('./pages/cab.js').then((m) => m.ride));
route('cab/booking/:id',  () => import('./pages/cab.js').then((m) => m.booking));
route('cab/bookings',     () => import('./pages/cab.js').then((m) => m.bookings));
route('cab/me',           () => import('./pages/cab.js').then((m) => m.me));
route('drive',            () => import('./pages/drive.js').then((m) => m.dashboard));
route('drive/publish',    () => import('./pages/drive.js').then((m) => m.publish));
route('drive/ride/:id/edit', () => import('./pages/drive.js').then((m) => m.publish));
route('drive/rides',      () => import('./pages/drive.js').then((m) => m.rides));
route('drive/requests',   () => import('./pages/drive.js').then((m) => m.requests));
route('drive/trip/:id',   () => import('./pages/drive.js').then((m) => m.trip));
route('drive/profile',    () => import('./pages/drive.js').then((m) => m.profile));
route('plan',             () => import('./pages/planner.js').then((m) => m.planner));
route('trip/:id',         () => import('./pages/planner.js').then((m) => m.trip));
route('login',            () => import('./pages/account.js').then((m) => m.login));
route('account',          () => import('./pages/account.js').then((m) => m.account));
route('partner/join',     () => import('./pages/partner.js').then((m) => m.join));
route('partner',          () => import('./pages/partner.js').then((m) => m.dashboard));
route('partner/:tab',     () => import('./pages/partner.js').then((m) => m.dashboard));
route('admin',            () => import('./pages/admin.js').then((m) => m.admin));
route('admin/:tab',       () => import('./pages/admin.js').then((m) => m.admin));

export function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, qs = ''] = raw.split('?');
  return { path: decodeURIComponent(path.replace(/\/$/, '')), query: Object.fromEntries(new URLSearchParams(qs)) };
}

export const go = (path) => { location.hash = '#/' + path.replace(/^#?\/?/, ''); };

const main = () => document.getElementById('main');
let renderToken = 0;

export async function render() {
  const token = ++renderToken;
  const { path, query } = parseHash();
  const match = routes.map((r) => ({ r, m: path.match(r.re) })).find((x) => x.m);
  const el = main();
  clear(el).append(loading());
  updateNav(path);
  try {
    if (!match) { clear(el).append(notFound()); return; }
    const params = Object.fromEntries(match.r.keys.map((k, i) => [k, decodeURIComponent(match.m[i + 1])]));
    const page = await match.r.loader();
    const node = await page({ params, query, path });
    if (token !== renderToken) return; // user navigated away meanwhile
    clear(el).append(node);
    el.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  } catch (err) {
    if (token === renderToken) clear(el).append(errorBox(err));
  }
}

const notFound = () => h('div', { class: 'page narrow' }, h('h1', {}, '404'), h('p', {}, 'Page not found.'), h('a', { class: 'btn', href: '#/' }, t('home')));

// ---------- Shell ----------
const navItems = () => [
  ['', 'home', t('home')],
  ['villages', 'mountain', t('villages')],
  ['plan', 'map', t('plan')],
  ['cab', 'car', t('cabs')],
  ['account', 'user', t('account')],
];

// Brand emblem: the mountain-and-sun part of the owner's logo (img/brand/logo-full.jpg).
const logo = () => h('img', { class: 'logo-mark', src: 'img/brand/emblem.jpg', alt: '', width: 42, height: 42 });

function header() {
  const brandName = state.settings?.brand?.[getLang() === 'hi' ? 'name_hi' : 'name'] || 'The Himalayan Horizon';
  const u = user();
  return h('header', { class: 'topbar' },
    h('a', { class: 'brand', href: '#/' }, logo(),
      h('span', { class: 'brand-text' },
        h('span', { class: 'brand-name' }, brandName),
        h('span', { class: 'brand-sub' }, getLang() === 'hi' ? 'उत्तराखंड · गाँव की यात्रा' : 'Uttarakhand · Village Travel'))),
    h('nav', { class: 'topnav', 'aria-label': 'Main' },
      h('a', { href: '#/', 'data-path': '' }, t('home')),
      h('a', { href: '#/cab', 'data-path': 'cab' }, icon('car', 19), t('nav_cab')),
      h('a', { href: '#/plan', 'data-path': 'plan' }, icon('map', 19), t('nav_planner')),
      h('a', { href: '#/villages', 'data-path': 'villages' }, icon('mountain', 19), t('nav_villages'))),
    h('div', { class: 'topbar-actions' },
      h('a', { class: 'icon-link', href: '#/explore', 'aria-label': t('search') }, icon('search', 20)),
      h('button', { class: 'lang-btn', onclick: () => { setLang(getLang() === 'hi' ? 'en' : 'hi'); paintShell(); render(); } }, t('language')),
      isAdmin() ? h('a', { class: 'text-link hide-sm', href: '#/admin' }, t('admin')) : null,
      state.partners.length ? h('a', { class: 'text-link hide-sm', href: '#/partner' }, t('partner')) : null,
      u ? h('a', { class: 'text-link hide-sm', href: '#/account' }, t('account'))
        : h('a', { class: 'text-link', href: '#/login' }, t('signin')),
      h('a', { class: 'btn btn-sm hide-sm', href: '#/plan' }, t('plan_your_trip'), icon('arrow', 16))));
}

function tabbar() {
  return h('nav', { class: 'tabbar', 'aria-label': 'App' },
    navItems().map(([p, ic, label]) =>
      h('a', { href: `#/${p}`, 'data-path': p }, icon(ic, 22), h('span', {}, label))));
}

function footer() {
  return h('footer', { class: 'footer' },
    h('div', { class: 'footer-inner' },
      h('a', { class: 'footer-brand', href: '#/', 'aria-label': 'The Himalayan Horizon' }, h('img', { class: 'footer-logo', src: 'img/brand/logo-full.jpg', alt: 'The Himalayan Horizon — Discover Beyond the Mountains', loading: 'lazy', width: 240, height: 160 })),
      h('nav', { class: 'footer-links', 'aria-label': 'Footer' },
        h('a', { href: '#/villages' }, t('villages')), h('a', { href: '#/stays' }, t('stays')),
        h('a', { href: '#/workspaces' }, t('workspaces')), h('a', { href: '#/cab' }, t('cabs')),
        h('a', { href: '#/partner/join' }, t('become_partner'))),
      h('div', { class: 'footer-end' },
        h('span', { class: 'muted small' }, `© ${new Date().getFullYear()} The Himalayan Horizon · ${t('footer_note')}`),
        h('button', { class: 'lang-btn', onclick: () => { setLang(getLang() === 'hi' ? 'en' : 'hi'); paintShell(); render(); } }, t('language')))));
}

function updateNav(path) {
  const top = path.split('/')[0];
  document.querySelectorAll('[data-path]').forEach((a) => {
    const p = a.getAttribute('data-path');
    a.classList.toggle('active', p === top || (p === 'cab' && ['cabs', 'drive'].includes(top)) || (p === 'account' && ['login', 'partner', 'admin'].includes(top)));
  });
}

function paintShell() {
  document.documentElement.lang = getLang();
  const shell = document.getElementById('shell');
  clear(shell).append(header());
  const tabs = document.getElementById('tabs');
  clear(tabs).append(tabbar());
  const foot = document.getElementById('foot');
  clear(foot).append(footer());
  updateNav(parseHash().path);
}

// ---------- Install prompt (PWA) ----------
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstall = e;
  document.body.classList.add('can-install');
});
export async function installApp() {
  if (!deferredInstall) return false;
  deferredInstall.prompt();
  await deferredInstall.userChoice;
  deferredInstall = null;
  document.body.classList.remove('can-install');
  return true;
}

// ---------- Sign-in return (Google) ----------
// After Google sign-in, Supabase sends the user back with tokens or an error in the URL.
// We read it before routing, then continue to the page the user wanted.
function readAuthReturn() {
  const raw = `${location.search.slice(1)}&${location.hash.replace(/^#\/?/, '')}`;
  const p = new URLSearchParams(raw);
  if (p.get('error') || p.get('error_description')) return { error: p.get('error_description') || p.get('error') };
  if (p.get('access_token') || p.get('code')) return { ok: true };
  return null;
}
function finishAuthReturn(ret) {
  if (!ret) return;
  let next = 'account';
  try { next = localStorage.getItem('hh_next') || next; localStorage.removeItem('hh_next'); } catch { /* ignore */ }
  const clean = location.pathname;
  if (ret.error) {
    history.replaceState(null, '', `${clean}#/login?next=${encodeURIComponent(next)}`);
    const cancelled = /denied|cancel/i.test(ret.error);
    toast(cancelled ? t('google_cancelled') : `${t('google_failed')}: ${ret.error}`, 'warn');
    return;
  }
  history.replaceState(null, '', `${clean}#/${state.session ? next : 'login'}`);
  if (!state.session) toast(t('google_failed'), 'err');
}

// ---------- Boot ----------
async function boot() {
  setLang(getLang());
  paintShell();
  window.addEventListener('hashchange', render);
  window.addEventListener('offline', () => toast(t('offline'), 'warn'));
  const authReturn = readAuthReturn();
  await Promise.all([initAuth(), settings().catch(() => null)]);
  finishAuthReturn(authReturn);
  paintShell();
  onChange(paintShell);
  await render();
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(console.error);
  }
}

boot();

// Expose for quick debugging in the browser console.
window.hh = { sb, state, go };
