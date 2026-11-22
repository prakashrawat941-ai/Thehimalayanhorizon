import { createRequire } from 'node:module';
const { chromium, devices } = createRequire(import.meta.url)('playwright');
import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';

const out = process.argv[2] || 'tests/screens'; mkdirSync(out, { recursive: true });
const server = spawn('python3', ['-m', 'http.server', '8772', '--bind', '127.0.0.1'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 700));
const mock = readFileSync('tests/mock-supabase.js', 'utf8');
const b = await chromium.launch(); const problems = [];
const pages = [['admin', 'admin'], ['admin/partners', 'admin'], ['account', 'traveler'], ['account/bookings', 'traveler'], ['account/saved', 'traveler'], ['account/profile', 'traveler'], ['account/notifications', 'traveler']];
for (const [dev, opts] of [['phone', devices['Pixel 7']], ['laptop', { viewport: { width: 1440, height: 900 } }]]) {
  for (const [path, role] of pages) {
    const ctx = await b.newContext({ ...opts });
    await ctx.route(/cdn\.jsdelivr\.net\/npm\/@supabase/, (r) => r.fulfill({ contentType: 'application/javascript', body: mock }));
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
    await p.addInitScript((r) => { localStorage.setItem('hh_lang', 'en'); localStorage.setItem('mock_role', r); }, role);
    await p.goto('http://127.0.0.1:8772/#/' + path); await p.waitForTimeout(1300);
    const ov = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    const txt = await p.locator('main').innerText();
    if (ov > 2) problems.push(`${dev} ${path} overflow ${ov}`);
    if (/Couldn't load|Something went wrong/.test(txt)) problems.push(`${dev} ${path} error: ${txt.slice(0, 200)}`);
    if (errs.length) problems.push(`${dev} ${path}: ${errs.join(' | ')}`);
    await p.screenshot({ path: `${out}/${dev}-${path.replace(/\//g, '-')}.png`, fullPage: dev === 'phone' });
    if (path === 'account/profile' && dev === 'phone') {
      await p.setInputFiles('#acc-photo', { name: 'me.png', mimeType: 'image/png', buffer: readFileSync('icons/icon-192.png') });
      await p.waitForTimeout(800);
      const src = await p.locator('.acc-avatar-lg img').getAttribute('src').catch(() => null);
      if (!src || !/hero\.jpg\?u=u-traveler/.test(src)) problems.push('avatar upload: ' + src);
      await p.setInputFiles('#acc-photo', { name: 'x.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
      await p.waitForTimeout(500);
      if (!/JPG, PNG or WebP/.test(await p.locator('body').innerText())) problems.push('bad file not refused');
    }
    await ctx.close();
  }
}
await b.close(); server.kill();
console.log(problems.length ? 'PROBLEMS\n' + problems.join('\n') : 'DASHBOARDS OK');
