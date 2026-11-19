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

async function setup(ctxOpts, lang, role = 'traveler') {
  const ctx = await browser.newContext(ctxOpts);
  await ctx.route(/cdn\.jsdelivr\.net\/npm\/@supabase/, (r) => r.fulfill({ contentType: 'application/javascript', body: mock }));
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await ctx.route(/unpkg\.com\/leaflet.*\.js/, (r) => r.fulfill({ contentType: 'application/javascript', body: stub }));
  await ctx.route(/unpkg\.com\/leaflet.*\.css|tile\.openstreetmap/, (r) => r.fulfill({ body: '' }));
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
    await page.waitForTimeout(800);
    await check(page, `${tag} review`, errs);
    const rv = await page.locator('main').innerText();
    if (!/Delhi/.test(rv) || !/Relaxed/.test(rv) || !/30,000/.test(rv) || !/1 child/.test(rv)) problems.push(`${tag}: review missing values`);
    await shot(page, `${tag}-plan-review`);
    await page.getByRole('button', { name: /quick day plan/ }).click();
    await page.waitForTimeout(900);
    if (!page.url().includes('#/plan/quick')) problems.push(`${tag}: quick plan not opened`);
    const qtitle = await page.locator('.planner-form input').first().inputValue();
    if (!/Mukteshwar trip/.test(qtitle)) problems.push(`${tag}: quick plan title ${qtitle}`);
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
