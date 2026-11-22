// Service worker: makes the site installable and usable offline.
// Own files: network first (so updates show at once), cached copy when offline.
// Fonts and the Supabase library from CDNs: cache first.
// Supabase API calls are never cached.
const VERSION = 'hh-v17';
const SHELL = [
  './', 'index.html', 'css/app.css', 'manifest.webmanifest', 'icons/icon-192.png', 'img/brand/mark.png',
  'js/app.js', 'js/ui.js', 'js/i18n.js', 'js/store.js', 'js/sb.js', 'js/config.js', 'js/forms.js', 'js/schemas.js',
  'js/pages/public.js', 'js/pages/listings.js', 'js/pages/cab.js', 'js/pages/drive.js', 'js/places.js', 'js/pages/planner.js', 'js/pages/tripplan.js', 'js/trip/common.js', 'js/trip/engine.js', 'js/trip/steps.js', 'js/trip/summary.js', 'js/trip/save.js', 'js/trip/trips.js', 'js/pages/account.js', 'js/google.js', 'js/shell.js', 'js/pages/admin.js', 'js/pages/admin-cab.js', 'js/pages/admin-homestay.js', 'js/pages/host.js', 'js/live.js', 'js/cab/vehicles.js',
  'img/home/hero.jpg', 'img/home/q-cab.jpg', 'img/home/q-plan.jpg', 'img/home/q-village.jpg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname.endsWith('.supabase.co')) return; // live data only

  const isCdn = /(^|\.)fonts\.(googleapis|gstatic)\.com$|^cdn\.jsdelivr\.net$/.test(url.hostname);
  if (isCdn) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(VERSION).then((c) => c.put(req, copy));
      return res;
    })));
    return;
  }
  if (url.origin !== location.origin) return;
  // Always check with the server (cheap 304 when unchanged) so a phone never mixes old and new files.
  e.respondWith(fetch(req, { cache: 'no-cache' }).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req).then((hit) => hit || caches.match('index.html'))));
});
