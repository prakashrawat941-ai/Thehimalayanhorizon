// "Continue with Google" for everyone: customers, partners, drivers and admin all reach the
// login page with the Google button and a heading that says what they are signing in for.
// After Google, they return to the page they wanted (remembered before leaving).
import { createRequire } from 'node:module';
const { chromium, devices } = createRequire(import.meta.url)('playwright');
import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';

const out = process.argv[2] || 'tests/screens'; mkdirSync(out, { recursive: true });
const server = spawn('python3', ['-m', 'http.server', '8774', '--bind', '127.0.0.1'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 700));
const mock = readFileSync('tests/mock-supabase.js', 'utf8');
const b = await chromium.launch(); const problems = [];
const cases = [
  ['customer', 'account', /Welcome back/, 'account'],
  ['customer-booking', 'cab/bookings', /Sign in to book your seat/, 'cab/bookings'],
  ['partner', 'partner/join', /Join as a partner/, 'partner/join'],
  ['partner-dashboard', 'partner', /Join as a partner/, 'partner'],
  ['driver', 'drive', /Drive with The Himalayan Horizon/, 'drive'],
  ['driver-publish', 'drive/publish', /Drive with The Himalayan Horizon/, 'drive/publish'],
];
for (const [dev, opts] of [['phone', devices['Pixel 7']], ['laptop', { viewport: { width: 1360, height: 860 } }]]) {
  for (const [name, path, heading, next] of cases) {
    const ctx = await b.newContext(opts);
    await ctx.route(/cdn\.jsdelivr\.net\/npm\/@supabase/, (r) => r.fulfill({ contentType: 'application/javascript', body: mock }));
    await ctx.route(/fonts\.(googleapis|gstatic)\.com|unpkg\.com|photon|osrm/, (r) => r.abort());
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
    await p.addInitScript(() => { localStorage.setItem('hh_lang', 'en'); localStorage.removeItem('mock_role'); localStorage.setItem('mock_google', 'ok'); });
    await p.goto(`http://127.0.0.1:8774/#/${path}`); await p.waitForTimeout(1000);
    const url = p.url();
    if (!/#\/login/.test(url)) problems.push(`${dev} ${name}: not sent to login (${url})`);
    const txt = await p.locator('.auth-form').innerText().catch(() => '');
    if (!heading.test(txt)) problems.push(`${dev} ${name}: heading wrong: ${txt.slice(0, 80)}`);
    const btn = p.getByRole('button', { name: 'Continue with Google' });
    if (!(await btn.isVisible())) { problems.push(`${dev} ${name}: Google button missing`); await ctx.close(); continue; }
    if (dev === 'phone' && ['customer', 'partner', 'driver'].includes(name)) await p.screenshot({ path: `${out}/${dev}-login-${name}.png` });
    await btn.click(); await p.waitForTimeout(300);
    const st = await p.evaluate(() => ({ next: localStorage.getItem('hh_next'), o: window.__oauth }));
    if (st.next !== next || st.o?.provider !== 'google' || !st.o?.options?.redirectTo?.startsWith('http://127.0.0.1:8774/')) problems.push(`${dev} ${name}: Google flow ${JSON.stringify(st)}`);
    if (errs.length) problems.push(`${dev} ${name}: ${errs.join(' | ')}`);
    await ctx.close();
  }
}
await b.close(); server.kill();
console.log(problems.length ? 'PROBLEMS\n' + problems.join('\n') : 'GOOGLE FOR EVERYONE OK');
