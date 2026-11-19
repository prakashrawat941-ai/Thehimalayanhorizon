// Offline UI test: opens every page with a mock Supabase, records console errors and
// takes screenshots.  Run:  node tests/ui-test.mjs [outDir]
import { createRequire } from 'node:module';
const { chromium, devices } = createRequire(import.meta.url)('playwright');
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';

const out = process.argv[2] || 'tests/screens';
mkdirSync(out, { recursive: true });
const server = spawn('python3', ['-m', 'http.server', '8765', '--bind', '127.0.0.1'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const BASE = 'http://127.0.0.1:8765/';
const mock = readFileSync('tests/mock-supabase.js', 'utf8');
const fx = JSON.parse(readFileSync('tests/fixtures.json', 'utf8'));
const pid = (n) => fx.places.find((p) => p.name === n).id;
const istDate = (d) => new Date(Date.now() + d * 864e5 + 5.5 * 3600e3).toISOString().slice(0, 10);
// The mock ride r3 leaves tomorrow at 08:00 browser time; work out its IST date.
const r3Date = (() => { const x = new Date(Date.now() + 864e5); x.setHours(8, 0, 0, 0); return new Date(x.getTime() + 5.5 * 3600e3).toISOString().slice(0, 10); })();
const results = `cab/find?from=${pid('Rishikesh')}&to=${pid('Mussoorie')}&date=${r3Date}&n=2`;

const pages = [
  ['', 'home'], ['explore', 'explore'], ['explore?theme=village-life', 'explore-theme'], ['villages', 'villages'],
  ['place/sari', 'place'], ['itineraries', 'itineraries'], ['itinerary/kumaon-village-trail', 'itinerary'],
  ['stays', 'stays'], ['stay/h1', 'stay'], ['workspaces', 'workspaces'], ['workspace/w1', 'workspace'],
  ['tours', 'tours'], ['tour/v1', 'tour'], ['cabs', 'cabs'], ['cabs?from=kathgodam&to=munsiyari', 'cabs-route'],
  ['plan?place=sari', 'plan'], ['login', 'login'],
  ['account', 'account', 'traveler'], ['partner', 'partner', 'partner'], ['partner/requests', 'partner-requests', 'partner'],
  ['partner/rides', 'partner-rides', 'partner'], ['partner/join', 'partner-join', 'traveler'],
  ['admin', 'admin', 'admin'], ['admin/partners', 'admin-partners', 'admin'], ['admin/homestay', 'admin-homestays', 'admin'],
  ['admin/home', 'admin-home', 'admin'], ['admin/locations', 'admin-locations', 'admin'], ['admin/itineraries', 'admin-itineraries', 'admin'],
  ['admin/settings', 'admin-settings', 'admin'], ['admin/users', 'admin-users', 'admin'],
  ['cab', 'cab-entry'], ['cab/find', 'cab-find'], [results, 'cab-results'], ['cab/ride/r3?n=2', 'cab-ride'],
  ['cab/me', 'cab-me', 'traveler'], ['cab/bookings', 'cab-bookings', 'traveler'], ['cab/booking/cb2', 'cab-booking', 'traveler'],
  ['cab/booking/cb1?new=1', 'cab-booking-new', 'traveler'],
  ['drive', 'drive', 'driver'], ['drive', 'drive-onboard', 'newdriver'], ['drive/publish', 'drive-publish', 'driver'],
  ['drive/rides', 'drive-rides', 'driver'], ['drive/requests', 'drive-requests', 'driver'], ['drive/trip/r3', 'drive-trip', 'driver'],
  ['drive/profile', 'drive-profile', 'driver'],
];

const browser = await chromium.launch();
const problems = [];
for (const [ctxName, ctxOpts] of [['phone', { ...devices['Pixel 7'] }], ['desktop', { viewport: { width: 1360, height: 900 }, deviceScaleFactor: 1 }]]) {
  for (const lang of ctxName === 'phone' ? ['hi', 'en'] : ['en']) {
    const ctx = await browser.newContext(ctxOpts);
    await ctx.route(/cdn\.jsdelivr\.net\/npm\/@supabase/, (r) => r.fulfill({ contentType: 'application/javascript', body: mock }));
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    for (const [path, name, role] of pages) {
      if (ctxName === 'desktop' && !['home', 'villages', 'stay', 'cabs-route', 'plan', 'admin', 'admin-partners', 'itinerary', 'partner-rides', 'cab-entry', 'cab-results', 'cab-ride', 'cab-me', 'drive', 'drive-publish'].includes(name)) continue;
      if (lang === 'en' && ctxName === 'phone' && !['home', 'cabs-route', 'stay', 'plan'].includes(name) && !name.startsWith('cab') && !name.startsWith('drive')) continue;
      const page = await ctx.newPage();
      const errs = [];
      page.on('console', (m) => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) errs.push(m.text()); });
      page.on('pageerror', (e) => errs.push(String(e)));
      await page.addInitScript(([r, l]) => { localStorage.setItem('hh_lang', l); if (r) localStorage.setItem('mock_role', r); else localStorage.removeItem('mock_role'); }, [role || '', lang]);
      await page.goto(BASE + '#/' + path);
      await page.waitForTimeout(900);
      const bodyText = await page.locator('main').innerText();
      if (/Something went wrong|कुछ गड़बड़ हुई/.test(bodyText)) errs.push('error box: ' + bodyText.slice(0, 200));
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (overflow > 2) errs.push(`horizontal overflow ${overflow}px`);
      await page.screenshot({ path: `${out}/${ctxName}-${lang}-${name}.png`, fullPage: ['home', 'stay', 'plan', 'admin'].includes(name) || name.startsWith('cab') || name.startsWith('drive') });
      if (errs.length) problems.push(`${ctxName}/${lang}/${name}: ${errs.join(' | ')}`);
      await page.close();
    }
    await ctx.close();
  }
}

// Interaction checks (phone, Hindi): planner suggestion and cab booking modal.
{
  const ctx = await browser.newContext({ ...devices['Pixel 7'] });
  await ctx.route(/cdn\.jsdelivr\.net\/npm\/@supabase/, (r) => r.fulfill({ contentType: 'application/javascript', body: mock }));
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  await page.addInitScript(() => { if (!sessionStorage.getItem('init')) { localStorage.setItem('mock_role', 'traveler'); sessionStorage.setItem('init', '1'); } localStorage.setItem('hh_lang', 'en'); });
  await page.goto(BASE + '#/plan');
  await page.waitForTimeout(700);
  await page.getByRole('button', { name: 'Suggest a plan' }).click();
  await page.waitForTimeout(300);
  const days = await page.locator('.day-card').count();
  if (days < 3) problems.push(`planner produced ${days} days`);
  await page.screenshot({ path: `${out}/phone-en-plan-suggested.png`, fullPage: true });
  // Cab: predictive text, typo correction, search, seat choice, booking.
  await page.goto(BASE + '#/cab/find');
  await page.waitForTimeout(700);
  await page.locator('#cab-from').fill('rishik');
  await page.waitForTimeout(200);
  const sug = await page.locator('#cab-from-list li').first().innerText();
  if (!/Rishikesh/.test(sug)) problems.push('predictive text: first suggestion was ' + sug);
  await page.locator('#cab-from').press('Enter');
  await page.locator('#cab-to').fill('Musoori');
  await page.locator('#cab-to').blur();
  await page.waitForTimeout(400);
  const fix = page.locator('.pi-fix', { hasText: 'Mussoorie' });
  if (!(await fix.count())) problems.push('typo correction: no "Did you mean Mussoorie"');
  await page.screenshot({ path: `${out}/phone-en-cab-typo.png` });
  const toBefore = await page.locator('.pi-chip').count();
  if (toBefore !== 1) problems.push('typo text was changed without asking');
  await fix.first().click();
  await page.locator('#cab-date').fill(r3Date);
  await page.getByRole('button', { name: 'More travellers' }).click();
  await page.getByRole('button', { name: 'Search rides' }).click();
  await page.waitForTimeout(900);
  if (!(await page.locator('.ride-card').count())) problems.push('search found no ride: ' + page.url());
  await page.screenshot({ path: `${out}/phone-en-cab-search-results.png`, fullPage: true });
  await page.getByRole('link', { name: 'Book now' }).first().click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'Select seats' }).click();
  await page.waitForTimeout(300);
  if (!(await page.locator('.seat.taken').count())) problems.push('seat map: booked seats not shown');
  await page.getByRole('button', { name: 'Seat 4', exact: true }).click();
  await page.getByRole('button', { name: 'Seat 5', exact: true }).click();
  await page.screenshot({ path: `${out}/phone-en-cab-seats.png` });
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/phone-en-cab-confirm.png`, fullPage: true });
  await page.getByRole('button', { name: 'Send ride request' }).click();
  await page.waitForTimeout(900);
  if (!page.url().includes('#/cab/booking/')) problems.push('booking did not open booking page: ' + page.url());
  await page.screenshot({ path: `${out}/phone-en-cab-request-sent.png`, fullPage: true });

  // Login page: Google button gives a clear message while Google is switched off.
  await page.evaluate(() => localStorage.removeItem('mock_role'));
  await page.goto(BASE + '#/login'); await page.reload();
  await page.waitForTimeout(700);
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  await page.waitForTimeout(500);
  const toastText = await page.locator('#toasts').innerText();
  if (!/not switched on/.test(toastText)) problems.push('google button message: ' + toastText);
  await page.screenshot({ path: `${out}/phone-en-login-google.png` });
  // Return from Google with an error (user cancelled).
  await page.goto(BASE + '#error=access_denied&error_description=The+user+denied+access'); await page.reload();
  await page.waitForTimeout(800);
  if (!page.url().includes('#/login')) problems.push('google cancel did not return to login: ' + page.url());

  // Driver: publish with review.
  await page.evaluate(() => localStorage.setItem('mock_role', 'driver'));
  await page.goto(BASE + '#/drive/publish'); await page.reload();
  await page.waitForTimeout(800);
  await page.locator('#pr-from').fill('haldw'); await page.waitForTimeout(150); await page.locator('#pr-from').press('Enter');
  await page.locator('#pr-to').fill('almora'); await page.waitForTimeout(150); await page.locator('#pr-to').press('Enter');
  await page.locator('#pr-price').fill('400');
  await page.getByRole('button', { name: 'Review journey' }).click();
  await page.waitForTimeout(400);
  if (!(await page.getByRole('heading', { name: 'Review your journey' }).count())) problems.push('publish: review screen did not open');
  await page.screenshot({ path: `${out}/phone-en-drive-review.png`, fullPage: true });
  await page.getByRole('button', { name: 'Publish ride' }).click();
  await page.waitForTimeout(900);
  if (!page.url().includes('#/drive/trip/')) problems.push('publish did not open trip: ' + page.url());
  await page.screenshot({ path: `${out}/phone-en-drive-published.png`, fullPage: true });
  await page.goto(BASE + '#/drive/requests');
  await page.waitForTimeout(700);
  await page.getByRole('button', { name: 'Accept' }).first().click();
  await page.waitForTimeout(600);
  if (!(await page.locator('#toasts').innerText()).includes('accepted')) problems.push('accept request: no confirmation');
  await page.goto(BASE + '#/admin/locations');
  await page.addInitScript(() => localStorage.setItem('mock_role', 'admin'));
  await page.goto(BASE + '#/admin/locations'); await page.reload();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: '+ Add' }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/phone-en-admin-add-location.png` });
  if (errs.length) problems.push('interactions: ' + errs.join(' | '));
  await ctx.close();
}

await browser.close();
server.kill();
console.log(problems.length ? 'PROBLEMS:\n' + problems.join('\n') : 'ALL PAGES OK');
