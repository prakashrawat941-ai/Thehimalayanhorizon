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
];

const browser = await chromium.launch();
const problems = [];
for (const [ctxName, ctxOpts] of [['phone', { ...devices['Pixel 7'] }], ['desktop', { viewport: { width: 1360, height: 900 }, deviceScaleFactor: 1 }]]) {
  for (const lang of ctxName === 'phone' ? ['hi', 'en'] : ['en']) {
    const ctx = await browser.newContext(ctxOpts);
    await ctx.route(/cdn\.jsdelivr\.net\/npm\/@supabase/, (r) => r.fulfill({ contentType: 'application/javascript', body: mock }));
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    for (const [path, name, role] of pages) {
      if (ctxName === 'desktop' && !['home', 'villages', 'stay', 'cabs-route', 'plan', 'admin', 'admin-partners', 'itinerary', 'partner-rides'].includes(name)) continue;
      if (lang === 'en' && ctxName === 'phone' && !['home', 'cabs-route', 'stay', 'plan'].includes(name)) continue;
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
      await page.screenshot({ path: `${out}/${ctxName}-${lang}-${name}.png`, fullPage: ['home', 'stay', 'plan', 'admin'].includes(name) });
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
  await page.addInitScript(() => { localStorage.setItem('mock_role', 'traveler'); localStorage.setItem('hh_lang', 'en'); });
  await page.goto(BASE + '#/plan');
  await page.waitForTimeout(700);
  await page.getByRole('button', { name: 'Suggest a plan' }).click();
  await page.waitForTimeout(300);
  const days = await page.locator('.day-card').count();
  if (days < 3) problems.push(`planner produced ${days} days`);
  await page.screenshot({ path: `${out}/phone-en-plan-suggested.png`, fullPage: true });
  await page.goto(BASE + '#/cabs?from=kathgodam&to=munsiyari');
  await page.waitForTimeout(700);
  await page.getByRole('button', { name: 'Book seats' }).first().click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/phone-en-cab-modal.png` });
  await page.locator('dialog input[name=seats]').fill('2');
  await page.locator('dialog button[type=submit]').click();
  await page.waitForTimeout(800);
  if (!page.url().includes('#/account')) problems.push('cab booking did not go to account: ' + page.url());
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
