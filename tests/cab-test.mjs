// Instant Cab Phase 3 screens (offline, mock database): driver record, live seats,
// booking confirmation popup with the new Booking ID, 15-minute countdown, booking tabs,
// driver verification notice, Ride ID popup, Start / Complete ride.
import { createRequire } from 'node:module';
const { chromium, devices } = createRequire(import.meta.url)('playwright');
import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';

const out = process.argv[2] || 'tests/screens'; mkdirSync(out, { recursive: true });
const server = spawn('python3', ['-m', 'http.server', '8773', '--bind', '127.0.0.1'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 700));
const mock = readFileSync('tests/mock-supabase.js', 'utf8');
const fx = JSON.parse(readFileSync('tests/fixtures.json', 'utf8'));
const pid = (n) => fx.places.find((p) => p.name === n).id;
const tomorrow = new Date(Date.now() + 864e5 + 5.5 * 3600e3).toISOString().slice(0, 10);
const stub = readFileSync('tests/leaflet-stub.js', 'utf8');
const hav = (a, c) => { const R = (x) => (x * Math.PI) / 180; const dLa = R(c.lat - a.lat); const dLo = R(c.lng - a.lng); const x = Math.sin(dLa / 2) ** 2 + Math.cos(R(a.lat)) * Math.cos(R(c.lat)) * Math.sin(dLo / 2) ** 2; return 6371 * 2 * Math.asin(Math.sqrt(x)); };
function osrm(url) {
  const m = url.match(/driving\/([-\d.]+),([-\d.]+);([-\d.]+),([-\d.]+)/);
  const a = { lng: +m[1], lat: +m[2] }; const c = { lng: +m[3], lat: +m[4] };
  const km = hav(a, c) * 1.35; const line = Array.from({ length: 40 }, (_, i) => { const f = i / 39; return [a.lng + (c.lng - a.lng) * f + Math.sin(f * Math.PI) * 0.04, a.lat + (c.lat - a.lat) * f]; });
  return { code: 'Ok', routes: [{ distance: km * 1000, duration: (km / 38) * 3600, geometry: { coordinates: line } }] };
}
const feat = (name, lat, lon, county) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] }, properties: { name, county, state: 'Uttarakhand', countrycode: 'IN', osm_key: 'place', osm_value: 'village' } });
const photon = (url) => { const t = decodeURIComponent((url.match(/q=([^&]+)/) || [])[1] || '').toLowerCase(); return { features: t.startsWith('degh') || t.startsWith('dega') ? [feat('Deghat', 29.85, 79.24, 'Almora')] : [] }; };
const b = await chromium.launch(); const problems = [];
const check = (ok, msg) => { if (!ok) problems.push(msg); };

async function open(dev, opts, role, path, init) {
  const ctx = await b.newContext({ ...opts });
  await ctx.route(/cdn\.jsdelivr\.net\/npm\/@supabase/, (r) => r.fulfill({ contentType: 'application/javascript', body: mock }));
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await ctx.route(/unpkg\.com\/leaflet.*\.js/, (r) => r.fulfill({ contentType: 'application/javascript', body: stub }));
  await ctx.route(/unpkg\.com\/leaflet.*\.css|tile\.openstreetmap/, (r) => r.fulfill({ body: '' }));
  await ctx.route(/router\.project-osrm\.org/, (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(osrm(r.request().url())) }));
  await ctx.route(/photon\.komoot\.io\/api/, (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(photon(r.request().url())) }));
  const p = await ctx.newPage(); p.errs = [];
  p.on('pageerror', (e) => p.errs.push(String(e)));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) p.errs.push(m.text()); });
  await p.addInitScript(([r, extra]) => { localStorage.setItem('hh_lang', 'en'); localStorage.setItem('mock_role', r); Object.entries(extra || {}).forEach(([k, v]) => localStorage.setItem(k, v)); }, [role, init]);
  await p.goto('http://127.0.0.1:8773/#/' + path); await p.waitForTimeout(1200);
  p.ctx = ctx; p.dev = dev; return p;
}
async function done(p, name, full = true) {
  const ov = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  check(ov <= 2, `${p.dev} ${name}: page wider than screen by ${ov}px`);
  check(!p.errs.length, `${p.dev} ${name}: ${p.errs.join(' | ')}`);
  await p.screenshot({ path: `${out}/${p.dev}-cab-${name}.png`, fullPage: full && p.dev === 'phone' });
}
const rerender = (p) => p.evaluate(() => window.dispatchEvent(new HashChangeEvent('hashchange')));

for (const [dev, opts] of [['phone', devices['Pixel 7']], ['laptop', { viewport: { width: 1440, height: 900 } }]]) {
  // 1. Results with live seat updates
  let p = await open(dev, opts, 'traveler', `cab/find?from=${pid('Rishikesh')}&to=${pid('Mussoorie')}&date=${tomorrow}&n=2`);
  check(/4 seats left/.test(await p.locator('.seat-pill').first().innerText()), `${dev} results: seat pill`);
  await done(p, 'results');
  await p.evaluate(() => window.__rtPush({ id: 'r3', seats_booked: 5 })); await p.waitForTimeout(300);
  check(/1 seat left/.test(await p.locator('.seat-pill').first().innerText()), `${dev} results: live seat update not shown`);
  check(await p.locator('.ride-card.is-off').count() === 1, `${dev} results: card not switched off after seats ran out`);
  await p.ctx.close();

  // 2. Ride page: driver record before booking (new driver, then experienced driver)
  p = await open(dev, opts, 'traveler', 'cab/ride/r3?n=2');
  check(await p.locator('.trust').count() === 1, `${dev} ride: driver record missing`);
  check(/not enough completed rides/i.test(await p.locator('.trust').innerText()), `${dev} ride: new driver note missing`);
  check(/Registered UK07/.test(await p.locator('main').innerText()), `${dev} ride: registration region missing`);
  check(!/AB1234/.test(await p.locator('main').innerText()), `${dev} ride: full registration number leaked`);
  await done(p, 'ride-new-driver');
  await p.ctx.close();
  p = await open(dev, opts, 'traveler', 'cab/ride/r3?n=2', { mock_rel: 'rich' });
  const tr = await p.locator('.trust').innerText();
  check(/4\.8/.test(tr) && /42/.test(tr) && /118/.test(tr) && /Excellent/.test(tr), `${dev} ride: experienced driver record wrong: ${tr}`);
  await p.evaluate(() => window.__rtPush({ id: 'r3', seats_booked: 3 })); await p.waitForTimeout(300);
  check(/3 seats left/.test(await p.locator('.seats-live').innerText()), `${dev} ride: live seats on ride page`);
  await done(p, 'ride-driver-record', false);

  // 3. Booking (request) → popup with Booking ID → countdown on booking page
  await p.locator('.sticky-cta button').click(); await p.waitForTimeout(300);
  for (const n of ['4', '5']) await p.locator('.car .seat', { hasText: new RegExp(`^${n}$`) }).click();
  await p.locator('.sticky-cta button').click(); await p.waitForTimeout(400);
  if (!(await p.locator('#bk-phone').inputValue())) await p.fill('#bk-phone', '9876543210');
  await p.locator('form button[type=submit]').click(); await p.waitForTimeout(1500);
  const modalTxt = await p.locator('.modal-cele').innerText().catch(() => '');
  check(/Request sent!/.test(modalTxt) && /THH-21112026-0007/.test(modalTxt) && /Rishikesh bus stand/.test(modalTxt), `${dev} booking popup: ${modalTxt.slice(0, 160)}`);
  check(/WhatsApp updates will be added soon/.test(modalTxt), `${dev} booking popup: WhatsApp note missing`);
  await p.waitForTimeout(1100); await done(p, 'popup-request', false);
  await p.locator('.modal-cele .btn').first().click(); await p.waitForTimeout(300);
  check(/Driver has 1[45]:\d\d/.test(await p.locator('.hold').innerText()), `${dev} booking page: countdown missing`);
  await done(p, 'booking-pending');
  await p.ctx.close();

  // 4. Instant book → "Your ride is booked!"
  p = await open(dev, opts, 'traveler', 'cab/ride/r3?n=1');
  await p.evaluate(() => { window.__db.cab_rides.find((r) => r.id === 'r3').auto_confirm = true; window.__db.cab_bookings = window.__db.cab_bookings.filter((x) => x.id !== 'cb2'); window.__db.cab_seat_holds = []; });
  await p.locator('.sticky-cta button').click(); await p.waitForTimeout(300);
  await p.locator('.car .seat', { hasText: /^1$/ }).click();
  await p.locator('.sticky-cta button').click(); await p.waitForTimeout(400);
  if (!(await p.locator('#bk-phone').inputValue())) await p.fill('#bk-phone', '9876543210');
  await p.locator('form button[type=submit]').click(); await p.waitForTimeout(1500);
  const okTxt = await p.locator('.modal-cele').innerText().catch(() => '');
  check(/Your ride is booked!/.test(okTxt) && /one step closer/.test(okTxt) && /Confirmed/.test(okTxt), `${dev} instant popup: ${okTxt.slice(0, 160)}`);
  await p.waitForTimeout(1100); await done(p, 'popup-booked', false);
  await p.ctx.close();

  // 5. My bookings tabs
  p = await open(dev, opts, 'traveler', 'cab/bookings?tab=requests');
  const tabs = await p.locator('.seg-tabs').innerText();
  check(/Upcoming/.test(tabs) && /Requests/.test(tabs) && /Completed/.test(tabs) && /Cancelled/.test(tabs), `${dev} bookings tabs: ${tabs}`);
  check(await p.locator('.bk-card .hold').count() === 1, `${dev} bookings: countdown on request card`);
  check(/THH-20112026-0002/.test(await p.locator('main').innerText()), `${dev} bookings: new booking ID not shown`);
  await done(p, 'bookings-requests');
  await p.ctx.close();

  // 6. Driver: dashboard with record, requests countdown, Ride ID popup, start / complete
  p = await open(dev, opts, 'driver', 'drive');
  check(await p.locator('.trust').count() === 1 && await p.locator('.publish-btn').count() === 1, `${dev} driver dashboard: record or publish button`);
  await done(p, 'driver-dashboard');
  await p.goto('http://127.0.0.1:8773/#/drive/requests'); await p.waitForTimeout(900);
  check(/Answer within/.test(await p.locator('main').innerText()), `${dev} driver requests: countdown`);
  await done(p, 'driver-requests');
  await p.goto('http://127.0.0.1:8773/#/drive/trip/r3?new=1'); await p.waitForTimeout(1500);
  const pub = await p.locator('.modal-cele').innerText().catch(() => '');
  check(/Your ride is published!/.test(pub) && /UK07-2011-2026-THH-0003/.test(pub), `${dev} ride popup: ${pub.slice(0, 160)}`);
  await done(p, 'popup-ride-published', false);
  await p.evaluate(() => { location.hash = '#/drive/requests'; }); await p.waitForTimeout(700);
  check(await p.locator('dialog[open]').count() === 0, `${dev} popup stays open after leaving the page`);
  await p.evaluate(() => { location.hash = '#/drive/trip/r3'; }); await p.waitForTimeout(700);
  await p.evaluate(() => { const r = window.__db.cab_rides.find((x) => x.id === 'r3'); r.departure_at = new Date(Date.now() + 3600e3).toISOString(); window.__db.cab_bookings.find((x) => x.id === 'cb2').status = 'confirmed'; });
  await rerender(p); await p.waitForTimeout(900);
  await p.locator('button', { hasText: 'Start ride' }).click(); await p.locator('dialog button', { hasText: 'Yes, start now' }).click(); await p.waitForTimeout(900);
  check(/Ride in progress/.test(await p.locator('main').innerText()), `${dev} start ride`);
  await done(p, 'driver-trip-started');
  await p.locator('button', { hasText: 'Complete ride' }).click(); await p.locator('dialog button', { hasText: 'Yes, ride completed' }).click(); await p.waitForTimeout(900);
  check(await p.evaluate(() => window.__db.cab_rides.find((x) => x.id === 'r3').status) === 'completed', `${dev} complete ride`);
  await p.ctx.close();

  // 8. Traveller search: spelling mistakes still find the place; route matching shows distance from the route
  p = await open(dev, opts, 'traveler', 'cab/find');
  await p.locator('#cab-from').fill('rishikes'); await p.waitForTimeout(250);
  check(/Rishikesh/.test(await p.locator('#cab-from-list').innerText().catch(() => '')), `${dev} search: misspelt "rishikes" not suggested`);
  await p.locator('#cab-from').press('Enter');
  await p.locator('#cab-to').fill('musoori'); await p.waitForTimeout(250);
  check(/Mussoorie/.test(await p.locator('#cab-to-list').innerText().catch(() => '')), `${dev} search: misspelt "musoori" not suggested`);
  await p.locator('#cab-to').press('Enter');
  await p.fill('#cab-date', tomorrow);
  await done(p, 'search-form');
  await p.locator('form.cab-search-card button[type=submit]').click(); await p.waitForTimeout(1200);
  check(/Pickup about 12 km from the route/.test(await p.locator('main').innerText()), `${dev} search: route distance line missing`);
  await done(p, 'results-route-match');
  // any village (OpenStreetMap) in the search
  await p.goto(`http://127.0.0.1:8773/#/cab/find`); await p.waitForTimeout(800);
  await p.locator('#cab-from').fill('deghat'); await p.waitForTimeout(900);
  check(/Deghat/.test(await p.locator('#cab-from-list').innerText().catch(() => '')), `${dev} search: village from OpenStreetMap not suggested`);
  await p.ctx.close();

  // 9. Driver adds a car from the catalog (typo "inova"), picks the 8-seater layout → 7 passenger seats
  p = await open(dev, opts, 'driver', 'drive/profile');
  await p.locator('#vh-search').fill('inova'); await p.waitForTimeout(300);
  check(/Innova Crysta/.test(await p.locator('#vh-results').innerText()), `${dev} vehicle: typo search failed`);
  await p.locator('.vh-opt', { hasText: 'Innova Crysta' }).click(); await p.waitForTimeout(200);
  await p.locator('.chip-btn', { hasText: '8-seater' }).click(); await p.waitForTimeout(200);
  check(/7 passenger seats/.test(await p.locator('.vh-picker').innerText()), `${dev} vehicle: seats not from catalog`);
  check(!(await p.locator('#vh-model').isVisible()), `${dev} vehicle: manual form still showing after choosing a car`);
  await p.fill('#vh-reg', 'UK04 TA 7788');
  await done(p, 'vehicle-picker');
  await p.locator('button', { hasText: 'Add vehicle' }).click(); await p.waitForTimeout(900);
  const nv = await p.evaluate(() => window.__db.vehicles.find((v) => v.registration_no === 'UK04TA7788'));
  check(nv && nv.variant_id === 'vv5' && nv.seats === 7 && /Toyota Innova Crysta/.test(nv.model), `${dev} vehicle saved wrong: ${JSON.stringify(nv)}`);
  await p.ctx.close();

  // 10. Publish from any village with road distance, time and map before publishing
  p = await open(dev, opts, 'driver', 'drive/publish');
  await p.locator('#pr-from').fill('deghat'); await p.waitForTimeout(900); await p.locator('#pr-from-list li', { hasText: 'Deghat' }).first().dispatchEvent('mousedown');
  await p.locator('#pr-to').fill('rishikesh'); await p.waitForTimeout(250); await p.locator('#pr-to').press('Enter');
  await p.fill('#pr-price', '900');
  await p.locator('button', { hasText: 'Review journey' }).click(); await p.waitForTimeout(1800);
  const rv = await p.locator('main').innerText();
  check(/Distance/.test(rv) && /km/.test(rv) && /Estimated arrival/.test(rv) && await p.locator('.tp-map').count() === 1, `${dev} publish review: route info missing`);
  await done(p, 'publish-route-review');
  await p.locator('button', { hasText: 'Publish ride' }).click(); await p.waitForTimeout(1500);
  const nr = await p.evaluate(() => window.__db.cab_rides.slice(-1)[0]);
  check(nr.from_geo?.name === 'Deghat' && !nr.from_place_id && nr.route_line?.length > 5 && nr.distance_km > 0 && nr.duration_min > 0, `${dev} published ride missing route: ${JSON.stringify({ g: nr.from_geo, d: nr.distance_km, l: nr.route_line?.length })}`);
  await p.ctx.close();

  // 11. Admin: drivers (verify) and vehicle list
  p = await open(dev, opts, 'admin', 'admin/drivers');
  await p.evaluate(() => { window.__db.driver_profiles[0].is_verified = false; }); await rerender(p); await p.waitForTimeout(1000);
  await p.locator('button', { hasText: 'Verify driver' }).first().click(); await p.waitForTimeout(700);
  check(await p.evaluate(() => window.__db.driver_profiles[0].is_verified) === true, `${dev} admin: verify driver`);
  await done(p, 'admin-drivers');
  await p.goto('http://127.0.0.1:8773/#/admin/vehicles'); await p.waitForTimeout(1200);
  check(/seat layouts still to check/.test(await p.locator('main').innerText()), `${dev} admin vehicles page`);
  await done(p, 'admin-vehicles');
  await p.ctx.close();

  // 7. Unverified driver: clear notice, no publish
  p = await open(dev, opts, 'driver', 'drive');
  await p.evaluate(() => { window.__db.driver_profiles[0].is_verified = false; }); await rerender(p); await p.waitForTimeout(900);
  check(/Waiting for verification/.test(await p.locator('main').innerText()) && await p.locator('.publish-btn').count() === 0, `${dev} unverified notice`);
  await done(p, 'driver-unverified');
  await p.ctx.close();
}
await b.close(); server.kill();
console.log(problems.length ? 'PROBLEMS\n' + problems.join('\n') : 'CAB OK');
