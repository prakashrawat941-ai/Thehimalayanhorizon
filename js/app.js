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
  ['', 'home', t('home')],
  ['villages', 'mountain', t('villages')],
  ['plan', 'map', t('plan')],
  ['cabs', 'car', t('cabs')],
  ['account', 'user', t('account')],
];

const logo = (light) => h('span', { class: 'logo-mark', 'aria-hidden': 'true', html:
  `<svg width="40" height="26" viewBox="0 0 46 30"><path d="M1 29 L15 9 L21 17 L28 5 L45 29 Z" fill="${light ? '#f7f4ee' : '#1f4d3a'}"/><path d="M28 5 L24 11 L28 9.5 L31 12 Z" fill="${light ? '#1f4d3a' : '#f7f4ee'}"/><path d="M15 9 L12.5 13 L15 12 L17 13.5 Z" fill="${light ? '#1f4d3a' : '#f7f4ee'}"/></svg>` });

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
      h('a', { href: '#/cabs', 'data-path': 'cabs' }, icon('car', 19), t('nav_cab')),
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
      h('a', { class: 'brand', href: '#/' }, logo(), h('span', { class: 'brand-name' }, 'The Himalayan Horizon')),
      h('nav', { class: 'footer-links', 'aria-label': 'Footer' },
        h('a', { href: '#/villages' }, t('villages')), h('a', { href: '#/stays' }, t('stays')),
        h('a', { href: '#/workspaces' }, t('workspaces')), h('a', { href: '#/cabs' }, t('cabs')),
        h('a', { href: '#/partner/join' }, t('become_partner'))),
      h('div', { class: 'footer-end' },
        h('span', { class: 'muted small' }, `© ${new Date().getFullYear()} The Himalayan Horizon · ${t('footer_note')}`),
        h('button', { class: 'lang-btn', onclick: () => { setLang(getLang() === 'hi' ? 'en' : 'hi'); paintShell(); render(); } }, t('language')))));
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
