const http = require('node:http'),
  assert = require('node:assert/strict');
const { mkdirSync } = require('node:fs');
const { chromium } = require('playwright');
const exp = Math.floor(Date.now() / 1000) + 3600;
const id = '10000000-0000-0000-0000-000000000001';
const enc = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
let role = 'founder';
const user = {
  id,
  email: 'test@example.invalid',
  role: 'authenticated',
  aud: 'authenticated',
  factors: [],
  user_metadata: {},
  app_metadata: {},
};
let submitted;
const fixture = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:3199');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'authorization, apikey, x-client-info, accept, content-type, accept-profile, prefer, range',
  );
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  const path = req.url.split('?')[0];
  let body = [];
  if (path === '/auth/v1/user') body = user;
  if (path.endsWith('/profiles')) body = { id, role: 'traveler' };
  if (path.endsWith('/driver_profiles'))
    body =
      role === 'driver'
        ? {
            user_id: id,
            full_name: 'UAT Driver',
            status: 'pending',
            is_verified: false,
          }
        : null;
  if (path.endsWith('/partners') && role === 'host')
    body = [
      {
        id,
        owner_id: id,
        business_name: 'UAT Homestay',
        status: 'approved',
        categories: ['homestay'],
      },
    ];
  if (path.endsWith('/management_members'))
    body = req.url.includes('role=eq.employee')
      ? []
      : ['driver', 'customer', 'host'].includes(role)
        ? null
        : {
            role: role === 'villageoffice' ? 'employee' : role,
            office:
              role === 'villageoffice' ? 'Surmoli Village Office' : 'Surmoli',
          };
  if (path.endsWith('/management_finance'))
    body = { booking_value: 0, commission: 0 };
  if (path.endsWith('/management_submit')) {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    submitted = JSON.parse(raw);
    body = id;
  }
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
});
(async () => {
  await new Promise((r) => fixture.listen(54321, '127.0.0.1', r));
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_BIN,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  try {
    for (const [r, url] of [
      ['founder', 'founder'],
      ['ceo', 'ceo'],
      ['co_founder', 'co-founder'],
      ['employee', 'employee'],
      ['villageoffice', 'employee'],
      ['customer', 'account'],
      ['host', 'partner'],
      ['driver', 'drive'],
    ]) {
      role = r;
      for (const [width, lang] of [
        [360, 'hi'],
        [1280, 'en'],
      ]) {
        const ctx = await browser.newContext({
          viewport: { width, height: 850 },
          serviceWorkers: 'block',
        });
        const token =
          enc({ alg: 'HS256', typ: 'JWT' }) +
          '.' +
          enc({ sub: id, aal: 'aal2', exp }) +
          '.' +
          enc('fixture');
        const session = {
          user,
          access_token: token,
          refresh_token: 'fixture',
          expires_in: 3600,
          expires_at: exp,
          token_type: 'bearer',
        };
        const site = 'http://127.0.0.1:3199';
        await ctx.addCookies([
          {
            name: 'sb-127-auth-token',
            value: 'base64-' + enc(session),
            url: site,
          },
          { name: 'thh_lang', value: lang, url: site },
        ]);
        const page = await ctx.newPage();
        await page.route(/^https:\/\//, (route) => route.abort());
        const res = await page.goto(site + '/' + url, {
          waitUntil: 'domcontentloaded',
        });
        assert.equal(res.status(), 200);
        await page
          .locator(
            {
              customer: '.ds-head h1',
              host: '.ds-head h1',
              driver: '.app-page.dash h1',
            }[r] || '.mgmt form select[name=kind]',
          )
          .waitFor({ timeout: 5000 });
        assert.equal(await page.locator('html').getAttribute('lang'), lang);
        assert(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          'horizontal overflow ' + r,
        );
        if (process.env.THH_SCREENSHOTS) {
          mkdirSync(process.env.THH_SCREENSHOTS, { recursive: true });
          await page.screenshot({
            path: process.env.THH_SCREENSHOTS + '/' + r + '-' + lang + '.png',
            fullPage: true,
          });
        }
        if (r === 'employee') {
          await page.selectOption('[name=kind]', 'expense');
          await page.locator('[name=amount]').waitFor();
          await page.fill('[name=amount]', '125');
          await page.fill('[name=subject]', 'Office receipt');
          await Promise.all([
            page.waitForURL('**/management?result=saved'),
            page
              .locator('form')
              .filter({ has: page.locator('[name=subject]') })
              .locator('button')
              .click(),
          ]);
          assert.equal(submitted.p_kind, 'expense');
          assert.equal(submitted.p_amount, '125');
        }
        console.log('PASS', r, width, lang);
        await ctx.close();
      }
    }
  } finally {
    await browser.close();
    fixture.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
