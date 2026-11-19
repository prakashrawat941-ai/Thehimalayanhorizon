// Trip Planner (Phase 2) flow test: dashboard → details → map → review, validation,
// auto-save, old links. Runs offline with the mock Supabase and a Leaflet stand-in.
// Run: node tests/planner-test.mjs [outDir]
import { createRequire } from 'node:module';
const { chromium, devices } = createRequire(import.meta.url)('playwright');
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';

const out = process.argv[2] || 'tests/screens';
mkdirSync(out, { recursive: true });
const server = spawn('python3', ['-m', 'http.server', '8766', '--bind', '127.0.0.1'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const BASE = 'http://127.0.0.1:8766/';
const mock = readFileSync('tests/mock-supabase.js', 'utf8');
const stub = readFileSync('tests/leaflet-stub.js', 'utf8');
const problems = [];
const browser = await chromium.launch();

// ---- mocked outside services (the real ones are not reachable from the test machine) ----
const api = { failOsrm: false };
const hav = (a, b) => { const R = (x) => (x * Math.PI) / 180; const dLa = R(b.lat - a.lat); const dLo = R(b.lng - a.lng); const x = Math.sin(dLa / 2) ** 2 + Math.cos(R(a.lat)) * Math.cos(R(b.lat)) * Math.sin(dLo / 2) ** 2; return 6371 * 2 * Math.asin(Math.sqrt(x)); };
function osrm(url) {
  const m = url.match(/driving\/([-\d.]+),([-\d.]+);([-\d.]+),([-\d.]+)/);
  const a = { lng: +m[1], lat: +m[2] }; const b = { lng: +m[3], lat: +m[4] };
  const km = hav(a, b) * 1.35; const secs = (km / 42) * 3600;
  const line = (bend) => Array.from({ length: 40 }, (_, i) => { const f = i / 39; return [a.lng + (b.lng - a.lng) * f + Math.sin(f * Math.PI) * bend, a.lat + (b.lat - a.lat) * f]; });
  return { code: 'Ok', routes: [{ distance: km * 1000, duration: secs, geometry: { coordinates: line(0.04) } }, { distance: km * 1080, duration: secs * 0.95, geometry: { coordinates: line(-0.15) } }] };
}
const today = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
const add = (iso, n) => new Date(new Date(`${iso}T12:00:00Z`).getTime() + n * 864e5).toISOString().slice(0, 10);
function meteo() {
  const time = Array.from({ length: 16 }, (_, i) => add(today(), i));
  return { current: { temperature_2m: 11.4, weather_code: 2, wind_speed_10m: 9 }, daily: { time, weather_code: time.map((_, i) => [0, 2, 61, 3, 1][i % 5]), temperature_2m_max: time.map(() => 16), temperature_2m_min: time.map((_, i) => (i % 5 === 2 ? -1 : 4)), precipitation_probability_max: time.map((_, i) => (i % 5 === 2 ? 80 : 10)), precipitation_sum: time.map((_, i) => (i % 5 === 2 ? 22 : 0)), wind_speed_10m_max: time.map(() => 12) } };
}
function archive(url) {
  const s0 = url.match(/start_date=([\d-]+)/)[1]; const e0 = url.match(/end_date=([\d-]+)/)[1];
  const time = []; for (let x = s0; x <= e0 && time.length < 1200; x = add(x, 1)) time.push(x);
  return { daily: { time, temperature_2m_max: time.map(() => 14), temperature_2m_min: time.map(() => 2), precipitation_sum: time.map((_, i) => (i % 3 ? 0 : 3)) } };
}
function overpass() {
  return { elements: [
    { type: 'node', lat: 28.84, lon: 78.2, tags: { barrier: 'toll_booth', name: 'Test Toll Plaza' } },
    { type: 'node', lat: 29.2, lon: 79.3, tags: { amenity: 'fuel', brand: 'Indian Oil' } },
    { type: 'node', lat: 29.47, lon: 79.65, tags: { amenity: 'fuel', name: 'Mukteshwar Fuels' } },
    { type: 'node', lat: 29.46, lon: 79.64, tags: { amenity: 'hospital', name: 'Community Health Centre' } },
    { type: 'node', lat: 29.471, lon: 79.649, tags: { amenity: 'cafe', name: 'Orchard Cafe' } },
  ] };
}


async function setup(ctxOpts, lang, role = 'traveler') {
  const ctx = await browser.newContext(ctxOpts);
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE.slice(0, -1) });
  await ctx.route(/cdn\.jsdelivr\.net\/npm\/@supabase/, (r) => r.fulfill({ contentType: 'application/javascript', body: mock }));
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await ctx.route(/unpkg\.com\/leaflet.*\.js/, (r) => r.fulfill({ contentType: 'application/javascript', body: stub }));
  await ctx.route(/unpkg\.com\/leaflet.*\.css|tile\.openstreetmap/, (r) => r.fulfill({ body: '' }));
  await ctx.route(/router\.project-osrm\.org/, (r) => (api.failOsrm ? r.fulfill({ status: 503, body: 'down' }) : r.fulfill({ contentType: 'application/json', body: JSON.stringify(osrm(r.request().url())) })));
  await ctx.route(/api\.open-meteo\.com/, (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(meteo()) }));
  await ctx.route(/archive-api\.open-meteo\.com/, (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(archive(r.request().url())) }));
  await ctx.route(/overpass-api\.de/, (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(overpass()) }));
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.addInitScript(([r, l]) => { if (!sessionStorage.getItem('init')) { localStorage.clear(); localStorage.setItem('mock_role', r); sessionStorage.setItem('init', '1'); } localStorage.setItem('hh_lang', l); }, [role, lang]);
  return { ctx, page, errs };
}
const check = async (page, name, errs) => {
  const ov = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (ov > 2) problems.push(`${name}: horizontal overflow ${ov}px`);
  const txt = await page.locator('main').innerText();
  if (/Something went wrong|कुछ गड़बड़ हुई/.test(txt)) problems.push(`${name}: error box`);
};
const shot = (page, name, full = true) => page.screenshot({ path: `${out}/${name}.png`, fullPage: full });
const go = async (page, hash, wait = 800) => { await page.goto(BASE + '#/' + hash); await page.waitForTimeout(wait); };

for (const [dev, opts, lang] of [['phone', devices['Pixel 7'], 'en'], ['desktop', { viewport: { width: 1360, height: 900 } }, 'en'], ['phone', devices['Pixel 7'], 'hi']]) {
  const tag = `${dev}-${lang}`;
  const { ctx, page, errs } = await setup(opts, lang);
  await page.goto(BASE + '#/'); await page.waitForTimeout(500);
  // Visit a place so "Recently viewed" fills.
  await go(page, 'place/mukteshwar', 600);
  await go(page, 'plan');
  await check(page, `${tag} dashboard`, errs);
  if (!(await page.locator('.tp-trip').count())) problems.push(`${tag}: saved trip not listed`);
  if (!(await page.locator('.tp-dests').first().locator('.tp-dest').count())) problems.push(`${tag}: recently viewed empty`);
  await shot(page, `${tag}-plan-dashboard`);

  if (lang === 'en') {
    await page.getByRole('link', { name: 'Create my trip' }).click();
    await page.waitForTimeout(700);
    // Validation: clear the start and submit.
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.waitForTimeout(300);
    const err1 = await page.locator('#tp-err-start').innerText();
    if (!/Choose where you start/.test(err1)) problems.push(`${tag}: no start error`);
    await shot(page, `${tag}-plan-details-errors`);
    // Fill.
    await page.locator('#tp-start').fill('dehli'); await page.waitForTimeout(200);
    const first = await page.locator('#tp-start-list li').first().innerText();
    if (!/Delhi/.test(first)) problems.push(`${tag}: typo search for dehli gave ${first}`);
    await page.locator('#tp-start').press('Enter');
    await page.locator('#tp-dest-0').fill('Muktesh'); await page.waitForTimeout(150); await page.locator('#tp-dest-0').press('Enter');
    await page.getByRole('button', { name: /Add another destination/ }).click();
    await page.locator('#tp-dest-1').fill('Almora'); await page.waitForTimeout(150); await page.locator('#tp-dest-1').press('Enter');
    await page.getByRole('button', { name: 'Move destination 2 up' }).click();
    const order = await page.locator('.tp-destrow .pi-chip strong').allInnerTexts();
    if (order.join('|') !== 'Almora|Mukteshwar') problems.push(`${tag}: reorder gave ${order}`);
    await page.getByRole('button', { name: /Add another destination/ }).click();
    if ((await page.locator('.tp-destrow').count()) !== 3) problems.push(`${tag}: add row failed`);
    await page.getByRole('button', { name: 'Remove destination 3' }).click();
    if ((await page.locator('.tp-destrow').count()) !== 2) problems.push(`${tag}: remove row failed`);
    await page.getByRole('button', { name: 'More Children (under 12)' }).click();
    await page.getByRole('button', { name: 'Mountain villages' }).click();
    await page.getByRole('button', { name: 'Photography' }).click();
    await page.locator('label.tp-radio', { hasText: 'Relaxed' }).click();
    await page.locator('#tp-budget').fill('30000');
    const total = await page.locator('.tp-dayinfo strong').innerText();
    if (total !== '3') problems.push(`${tag}: total travellers ${total}`);
    await check(page, `${tag} details`, errs);
    await shot(page, `${tag}-plan-details`);
    // Auto-save survives a reload.
    await page.reload(); await page.waitForTimeout(800);
    const kept = await page.locator('.tp-destrow .pi-chip strong').allInnerTexts();
    if (kept.join('|') !== 'Almora|Mukteshwar') problems.push(`${tag}: draft not kept after reload (${kept})`);
    if (!(await page.getByRole('button', { name: 'Photography' }).getAttribute('aria-pressed')).includes('true')) problems.push(`${tag}: prefs not kept`);
    await page.locator('#tp-ret').fill(add(today(), 11));
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.waitForTimeout(900);
    if (!page.url().endsWith('#/plan/map')) problems.push(`${tag}: did not reach map (${page.url()})`);
    const pins = await page.locator('.tp-map .tp-pin').count();
    if (pins !== 3) problems.push(`${tag}: map shows ${pins} pins`);
    await check(page, `${tag} map`, errs);
    await shot(page, `${tag}-plan-map`);
    // Drag stop 2 (Mukteshwar) a few km away.
    await page.evaluate(() => { const m = window.__lfMarkers.filter((x) => x._opt.draggable)[2]; m.setLatLng({ lat: m.getLatLng().lat + 0.05, lng: m.getLatLng().lng + 0.04 }); m._ev.dragend(); });
    await page.waitForTimeout(300);
    const p2 = await page.locator('.tp-point').nth(2).innerText();
    if (!/Pin near/.test(p2)) problems.push(`${tag}: drag did not save a custom pin: ${p2}`);
    await shot(page, `${tag}-plan-map-dragged`);
    await page.getByRole('button', { name: 'Undo pin move' }).click();
    if (!/Mukteshwar/.test(await page.locator('.tp-point').nth(2).innerText())) problems.push(`${tag}: undo pin failed`);
    await page.getByRole('link', { name: 'Continue' }).click();
    await page.waitForTimeout(2600);
    // --- Route ---
    await check(page, `${tag} route`, errs);
    const legs = await page.locator('.tp-leg').count();
    if (legs !== 3) problems.push(`${tag}: route shows ${legs} legs (expected 3 incl. return)`);
    const tot1 = await page.locator('.tp-totals strong').first().innerText();
    await page.locator('.tp-leg').first().locator('label.tp-alt').nth(1).click();
    await page.waitForTimeout(200);
    const tot2 = await page.locator('.tp-totals strong').first().innerText();
    if (tot1 === tot2) problems.push(`${tag}: choosing route 2 did not change the total (${tot1})`);
    if (!/°C/.test(await page.locator('.tp-wxgrid').innerText())) problems.push(`${tag}: no current weather`);
    await shot(page, `${tag}-plan-route`);
    // --- Itinerary ---
    await page.getByRole('link', { name: 'Make my day-wise plan' }).click();
    await page.waitForTimeout(1500);
    await check(page, `${tag} itinerary`, errs);
    const nd = await page.locator('.tp-day').count();
    if (nd !== 5) problems.push(`${tag}: itinerary has ${nd} days (expected 5)`);
    if (!(await page.locator('.tp-day .tp-wx').count())) problems.push(`${tag}: no weather on itinerary days`);
    if (!/km/.test(await page.locator('.tp-day').first().innerText())) problems.push(`${tag}: travel day has no distance`);
    await page.locator('.tp-day').nth(1).locator('.tp-daytitle').fill('Almora bazaar and temples');
    await page.locator('.tp-day').nth(1).locator('.tp-addline input').fill('Visit Nanda Devi temple');
    await page.locator('.tp-day').nth(1).getByRole('button', { name: 'Add', exact: true }).click();
    const before = await page.locator('.tp-day').nth(1).locator('.tp-item').count();
    await page.locator('.tp-day').nth(1).getByRole('button', { name: 'Remove this activity' }).first().click();
    if ((await page.locator('.tp-day').nth(1).locator('.tp-item').count()) !== before - 1) problems.push(`${tag}: remove activity failed`);
    await shot(page, `${tag}-plan-itinerary`);
    // Regenerate asks first because of the edits.
    await page.getByRole('button', { name: 'Regenerate itinerary' }).last().click();
    if (!(await page.getByRole('button', { name: /edits will be lost/ }).count())) problems.push(`${tag}: regenerate did not ask first`);
    // --- Budget ---
    await page.getByRole('link', { name: 'Continue to budget' }).click();
    await page.waitForTimeout(900);
    await check(page, `${tag} budget`, errs);
    if (!/Add amount/.test(await page.locator('.tp-btable').innerText())) problems.push(`${tag}: missing costs not flagged`);
    await page.locator('#tp-a-fuel_price').fill('95');
    await page.locator('#tp-a-stay_per_night').fill('2000');
    await page.locator('#tp-a-food_per_person_day').fill('400');
    await page.waitForTimeout(200);
    const btotal = await page.locator('.tp-bstat.big strong').innerText();
    if (!/₹[\d,]+/.test(btotal) || btotal === '₹0') problems.push(`${tag}: budget total ${btotal}`);
    if (/Add amount/.test(await page.locator('.tp-btable').innerText())) problems.push(`${tag}: costs still flagged after filling`);
    await page.locator('.tp-brow').nth(1).locator('input').fill('4000');
    await page.waitForTimeout(200);
    if (!/4,000/.test(await page.locator('.tp-bsum').innerText())) problems.push(`${tag}: actual expense not counted`);
    await shot(page, `${tag}-plan-budget`);
    // --- Summary (Trip Report) ---
    await page.getByRole('link', { name: 'See trip summary' }).click();
    await page.waitForTimeout(2200);
    await check(page, `${tag} summary`, errs);
    const cards = await page.locator('.tr-card').count();
    if (cards !== 8) problems.push(`${tag}: summary has ${cards} cards`);
    const st = await page.locator('main').innerText();
    if (!/Trip Report/.test(st) || !/Delhi → Almora → Mukteshwar/.test(st)) problems.push(`${tag}: summary heading/route missing`);
    if (!/Test Toll Plaza|Toll plazas on route\s*1/.test(st)) problems.push(`${tag}: toll count missing`);
    if (!/Community Health Centre/.test(st)) problems.push(`${tag}: nearest hospital missing`);
    if (!/Almora bazaar and temples/.test(st)) problems.push(`${tag}: edited day title not in summary`);
    await shot(page, `${tag}-plan-summary`);
    // Save, then share (link), open the shared view.
    await page.getByRole('button', { name: 'Save trip' }).click();
    await page.waitForTimeout(800);
    const tripId = await page.evaluate(() => JSON.parse(localStorage.getItem('hh_plan_v2')).tripId);
    if (!tripId) problems.push(`${tag}: save did not give a trip id`);
    await page.getByRole('button', { name: 'Save changes' }).click();
    await page.waitForTimeout(600);
    await page.getByRole('button', { name: 'Share trip' }).click();
    await page.waitForTimeout(800);
    const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => ''));
    const token = (clip.match(/#\/t\/(\w+)/) || [])[1];
    if (!token) problems.push(`${tag}: share link not copied (${clip.slice(0, 80)})`);
    // My Trips
    await page.evaluate(() => { location.hash = '#/trips'; }); await page.waitForTimeout(900);
    await check(page, `${tag} trips`, errs);
    const tripsTxt = await page.locator('main').innerText();
    if (!/Upcoming trips \(2\)/.test(tripsTxt)) problems.push(`${tag}: my trips grouping: ${tripsTxt.slice(0, 200)}`);
    await shot(page, `${tag}-plan-mytrips`);
    // Saved trip view with owner actions
    await page.evaluate((id) => { location.hash = `#/trip/${id}`; }, tripId); await page.waitForTimeout(1500);
    await check(page, `${tag} saved trip`, errs);
    if (!(await page.getByRole('button', { name: 'Duplicate' }).count())) problems.push(`${tag}: saved trip has no Duplicate`);
    if (!/Sharing is on/.test(await page.locator('main').innerText())) problems.push(`${tag}: sharing banner missing`);
    await page.getByRole('button', { name: 'Duplicate' }).click(); await page.waitForTimeout(1200);
    if (!page.url().includes('#/trip/') || page.url().includes(tripId)) problems.push(`${tag}: duplicate did not open the copy`);
    await page.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('button', { name: 'Tap again to delete' }).click(); await page.waitForTimeout(900);
    if (!page.url().endsWith('#/trips')) problems.push(`${tag}: delete did not go back to My trips`);
    // Shared (read-only) view
    if (token) {
      await page.evaluate((t) => { location.hash = `#/t/${t}`; }, token); await page.waitForTimeout(1500);
      await check(page, `${tag} shared`, errs);
      if (await page.getByRole('button', { name: 'Save trip' }).count()) problems.push(`${tag}: shared view shows Save`);
      if (!/Trip Report/.test(await page.locator('main').innerText())) problems.push(`${tag}: shared view empty`);
      await shot(page, `${tag}-plan-shared`, false);
    }
    // Too few days: driving alone does not fit.
    await page.evaluate((d) => { const x = JSON.parse(localStorage.getItem('hh_plan_v2')); x.ret = x.depart; x.days = null; localStorage.setItem('hh_plan_v2', JSON.stringify(x)); location.hash = '#/plan/itinerary'; }, null);
    await page.waitForTimeout(1500);
    if (!/driving alone needs about/.test(await page.locator('main').innerText())) problems.push(`${tag}: too-short trip not warned`);
    await shot(page, `${tag}-plan-too-short`, false);
    // Route service down: clear message, nothing invented.
    api.failOsrm = true;
    await page.evaluate(() => { location.hash = '#/plan/route'; }); await page.waitForTimeout(900);
    await page.getByRole('button', { name: 'Recalculate route' }).click(); await page.waitForTimeout(9000);
    const rt = await page.locator('main').innerText();
    if (!/Route could not be calculated/.test(rt)) problems.push(`${tag}: route failure not shown`);
    await shot(page, `${tag}-plan-route-failed`, false);
    api.failOsrm = false;
    // Older database (before the update): save still works with the basic columns.
    await page.evaluate(() => { localStorage.setItem('mock_v1', '1'); const x = JSON.parse(localStorage.getItem('hh_plan_v2')); x.tripId = null; x.clientId = null; localStorage.setItem('hh_plan_v2', JSON.stringify(x)); });
    await page.getByRole('button', { name: 'Recalculate route' }).click(); await page.waitForTimeout(2500);
    await page.evaluate(() => { const x = JSON.parse(localStorage.getItem('hh_plan_v2')); const d = new Date(`${x.depart}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 4); x.ret = d.toISOString().slice(0, 10); x.days = null; localStorage.setItem('hh_plan_v2', JSON.stringify(x)); location.hash = '#/plan/summary'; });
    await page.waitForTimeout(2200);
    await page.getByRole('button', { name: 'Save trip' }).click(); await page.waitForTimeout(800);
    if (!(await page.evaluate(() => JSON.parse(localStorage.getItem('hh_plan_v2')).tripId))) problems.push(`${tag}: fallback save failed`);
    await page.evaluate(() => localStorage.removeItem('mock_v1'));
    // Review on a destination page
    await page.evaluate(() => { location.hash = '#/place/almora'; }); await page.waitForTimeout(1200);
    await page.getByRole('radio', { name: '4 / 5' }).click();
    await page.locator('.rv-form textarea').fill('Lovely old bazaar.');
    await page.getByRole('button', { name: 'Send review' }).click(); await page.waitForTimeout(500);
    if (!/review will appear after/.test(await page.locator('body').innerText())) problems.push(`${tag}: review not sent`);
    // Save a destination from the dashboard
    await page.evaluate(() => { location.hash = '#/plan'; }); await page.waitForTimeout(1200);
    await page.locator('.tp-heart').first().click(); await page.waitForTimeout(300);
    if (!/Saved destinations/.test(await page.locator('main').innerText()) || !(await page.locator('.tp-heart.on').count())) problems.push(`${tag}: save destination failed`);
    // Dashboard now offers to continue the draft.
    await go(page, 'plan');
    if (!(await page.getByRole('link', { name: 'Continue my trip' }).count())) problems.push(`${tag}: no continue-draft card`);
    await shot(page, `${tag}-plan-dashboard-draft`, false);
    // Old links still work.
    await go(page, 'plan?from=kumaon-village-trail', 1000);
    if (!page.url().includes('plan/quick?from=')) problems.push(`${tag}: old itinerary link -> ${page.url()}`);
    await page.evaluate(() => localStorage.removeItem('hh_plan_v2'));
    await go(page, 'plan?place=binsar', 1000);
    if (!page.url().includes('#/plan/new?to=') || !/Binsar/.test(await page.locator('.tp-destrow').first().innerText())) problems.push(`${tag}: place link -> ${page.url()}`);
  }
  if (errs.length) problems.push(`${tag}: ${[...new Set(errs)].join(' | ')}`);
  await ctx.close();
}
// Admin: Trip Planner tab (analytics + reviews)
{
  const { ctx, page, errs } = await setup({ viewport: { width: 1360, height: 900 } }, 'en', 'admin');
  await go(page, 'admin/trips', 1500);
  await check(page, 'admin trips', errs);
  const t = await page.locator('main').innerText();
  if (!/Trips created/.test(t) || !/Destination reviews/.test(t)) problems.push('admin trips tab incomplete');
  await page.getByRole('button', { name: 'Approve' }).first().click(); await page.waitForTimeout(400);
  if (!/approved/.test(await page.locator('.ad-review').first().innerText())) problems.push('admin approve review failed');
  await shot(page, 'desktop-en-admin-trips');
  if (errs.length) problems.push(`admin: ${errs.join(' | ')}`);
  await ctx.close();
}
// Logged out dashboard.
{
  const { ctx, page, errs } = await setup(devices['Pixel 7'], 'en', '');
  await go(page, 'plan');
  if (!(await page.getByRole('link', { name: 'Log in' }).count())) problems.push('logged out: no login prompt');
  await shot(page, 'phone-en-plan-dashboard-guest', false);
  if (errs.length) problems.push(`guest: ${errs.join(' | ')}`);
  await ctx.close();
}
await browser.close();
server.kill();
console.log(problems.length ? 'PROBLEMS:\n' + problems.join('\n') : 'PLANNER OK');
