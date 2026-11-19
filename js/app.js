// App shell: header, bottom tab bar (phone), router and service worker.
import { h, clear, toast, errorBox, loading } from './ui.js';
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
route('cabs',             () => import('./pages/cabs.js').then((m) => m.cabs));
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
  ['', '🏠', t('home')],
  ['explore', '🧭', t('explore')],
  ['plan', '🗺️', t('plan')],
  ['cabs', '🚙', t('cabs')],
  ['account', '👤', t('account')],
];

function header() {
  const brandName = state.settings?.brand?.[getLang() === 'hi' ? 'name_hi' : 'name'] || 'The Himalayan Horizon';
  const u = user();
  return h('header', { class: 'topbar' },
    h('a', { class: 'brand', href: '#/' },
      h('img', { src: 'icons/logo.svg', alt: '', width: 34, height: 34 }),
      h('span', {}, brandName)),
    h('nav', { class: 'topnav', 'aria-label': 'Main' },
      [['villages', t('villages')], ['itineraries', t('itineraries')], ['stays', t('stays')],
       ['workspaces', t('workspaces')], ['cabs', t('cabs')], ['plan', t('plan')]]
        .map(([p, label]) => h('a', { href: `#/${p}`, 'data-path': p }, label))),
    h('div', { class: 'topbar-actions' },
      h('button', { class: 'btn btn-ghost btn-sm', onclick: () => { setLang(getLang() === 'hi' ? 'en' : 'hi'); paintShell(); render(); } }, t('language')),
      isAdmin() ? h('a', { class: 'btn btn-ghost btn-sm', href: '#/admin' }, t('admin')) : null,
      state.partners.length ? h('a', { class: 'btn btn-ghost btn-sm hide-sm', href: '#/partner' }, t('partner')) : null,
      u ? h('a', { class: 'btn btn-sm hide-sm', href: '#/account' }, t('account'))
        : h('a', { class: 'btn btn-sm', href: '#/login' }, t('signin'))));
}

function tabbar() {
  return h('nav', { class: 'tabbar', 'aria-label': 'App' },
    navItems().map(([p, icon, label]) =>
      h('a', { href: `#/${p}`, 'data-path': p }, h('span', { class: 'tab-icon', 'aria-hidden': 'true' }, icon), h('span', {}, label))));
}

function footer() {
  return h('footer', { class: 'footer' },
    h('div', { class: 'footer-inner' },
      h('div', {}, h('strong', {}, 'The Himalayan Horizon'), h('p', { class: 'muted' }, t('footer_note'))),
      h('div', { class: 'footer-links' },
        h('a', { href: '#/villages' }, t('villages')), h('a', { href: '#/stays' }, t('stays')),
        h('a', { href: '#/workspaces' }, t('workspaces')), h('a', { href: '#/cabs' }, t('cabs')),
        h('a', { href: '#/partner/join' }, t('become_partner'))),
      h('p', { class: 'muted small' }, `© ${new Date().getFullYear()} The Himalayan Horizon · Uttarakhand`)));
}

function updateNav(path) {
  const top = path.split('/')[0];
  document.querySelectorAll('[data-path]').forEach((a) => {
    const p = a.getAttribute('data-path');
    a.classList.toggle('active', p === top || (p === 'account' && ['login', 'partner', 'admin'].includes(top)));
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

// ---------- Boot ----------
async function boot() {
  setLang(getLang());
  paintShell();
  window.addEventListener('hashchange', render);
  window.addEventListener('offline', () => toast(t('offline'), 'warn'));
  await Promise.all([initAuth(), settings().catch(() => null)]);
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
