// Homestay partner portal + admin business + guest room booking (offline, mock database).
import { createRequire } from 'node:module';
const { chromium, devices } = createRequire(import.meta.url)('playwright');
import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';

const out = process.argv[2] || 'tests/screens'; mkdirSync(out, { recursive: true });
const PORT = 8775;
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 700));
const mock = readFileSync('tests/mock-supabase.js', 'utf8');
const b = await chromium.launch(); const problems = [];
const check = (ok, msg) => { if (!ok) problems.push(msg); };
const BASE = `http://127.0.0.1:${PORT}/#/`;

async function open(dev, opts, role, path) {
  const ctx = await b.newContext(opts);
  await ctx.route(/cdn\.jsdelivr\.net\/npm\/@supabase/, (r) => r.fulfill({ contentType: 'application/javascript', body: mock }));
  await ctx.route(/fonts\.(googleapis|gstatic)\.com|unpkg\.com|photon|osrm|tile\.openstreetmap/, (r) => r.abort());
  const p = await ctx.newPage(); p.errs = [];
  // Like a person: bring a button to the middle of the screen (above the phone's bottom menu) before tapping it.
  const proto = Object.getPrototypeOf(p.locator('body'));
  if (!proto.__centered) { const orig = proto.click; proto.click = async function (o) {
    // Center it, confirm nothing covers its middle, then tap there (a person would scroll the same way).
    const clear = await this.evaluate((e) => { e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return !!hit && (hit === e || e.contains(hit)); }).catch(() => false);
    return orig.call(this, clear ? { force: true, ...o } : o);
  }; proto.__centered = true; }
  p.on('pageerror', (e) => p.errs.push(String(e)));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) p.errs.push(m.text()); });
  p.on('dialog', (d) => { p.errs.push(`unexpected dialog: ${d.message()}`); d.dismiss(); });
  await p.addInitScript((r) => { localStorage.setItem('hh_lang', 'en'); localStorage.setItem('mock_role', r); }, role);
  await p.goto(BASE + path); await p.waitForTimeout(1100);
  p.ctx = ctx; p.dev = dev; return p;
}
const go = async (p, path, wait = 1000) => { await p.evaluate((h) => { location.hash = h; }, `#/${path}`); await p.waitForTimeout(wait); };
async function done(p, name, full = true) {
  const ov = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  check(ov <= 2, `${p.dev} ${name}: page wider than screen by ${ov}px`);
  check(!p.errs.length, `${p.dev} ${name}: ${p.errs.join(' | ')}`); p.errs = [];
  await p.screenshot({ path: `${out}/${p.dev}-host-${name}.png`, fullPage: full && p.dev === 'phone' });
}
const text = (p) => p.locator('main').innerText();
const db = (p, fn) => p.evaluate(fn);

for (const [dev, opts] of [['phone', devices['Pixel 7']], ['laptop', { viewport: { width: 1440, height: 900 } }]]) {
  // ── Partner ──
  let p = await open(dev, opts, 'partner', 'partner');
  let t = await text(p);
  check(/Total earnings/.test(t) && /Occupancy/.test(t) && /Pending payouts/.test(t), `${dev} overview KPIs missing`);
  check(await p.locator('.bars .bar').count() === 12, `${dev} earnings chart`);
  check(/new booking request/.test(t) && /bank \/ UPI/.test(t), `${dev} overview alerts`);
  await p.locator('.bars .bar').last().click(); check(/₹/.test(await p.locator('.chart-read').innerText()), `${dev} chart tap`);
  await done(p, 'overview');

  await go(p, 'partner/properties');
  t = await text(p);
  check(/Rawat Family Homestay/.test(t) && /Approved/.test(t), `${dev} properties list`);
  await done(p, 'properties');

  // 5-step form
  await go(p, 'partner/properties/new');
  const step = (label) => p.locator('.hw .panel h2').innerText().then((x) => x.includes(label));
  await p.locator('.hw button', { hasText: 'Next' }).click();
  check(/homestay name/i.test(await p.locator('.form-err').innerText()), `${dev} wizard: empty name not caught`);
  const inputs = p.locator('.hw .panel input.input');
  await inputs.nth(0).fill('Apple Orchard Cottage'); await inputs.nth(1).fill('Deghat'); await inputs.nth(2).fill('Almora');
  await inputs.nth(4).fill('Stone cottage in an apple orchard with Himalayan views');
  await p.locator('.hw button', { hasText: 'Next' }).click(); await p.waitForTimeout(150);
  check(await step('Amenities'), `${dev} wizard: step 2`);
  await p.locator('.chip-btn', { hasText: 'Hot water' }).click(); await p.locator('.chip-btn', { hasText: 'Mountain view' }).click();
  await p.locator('.hw button', { hasText: 'Next' }).click(); await p.waitForTimeout(150);
  await p.locator('.hw button', { hasText: 'Add room type' }).click();
  const rooms = p.locator('.hw-room');
  await rooms.nth(1).locator('input').nth(0).fill('Family suite'); await rooms.nth(1).locator('input').nth(1).fill('4'); await rooms.nth(1).locator('input').nth(2).fill('2');
  await done(p, 'wizard-rooms');
  await p.locator('.hw button', { hasText: 'Next' }).click(); await p.waitForTimeout(150);
  await p.locator('.hw button', { hasText: 'Next' }).click();
  check(/price per night/i.test(await p.locator('.form-err').innerText()), `${dev} wizard: missing price not caught`);
  await rooms.nth(0).locator('input').nth(0).fill('2000'); await rooms.nth(0).locator('input').nth(1).fill('2400');
  await rooms.nth(1).locator('input').nth(0).fill('3500');
  await p.locator('.hw button', { hasText: 'Next' }).click(); await p.waitForTimeout(150);
  await p.locator('.hw button', { hasText: 'Send for review' }).click(); await p.waitForTimeout(300);
  check(/at least one photo/.test(await p.locator('.form-err').innerText()), `${dev} wizard: photo required`);
  await p.setInputFiles('#hw-file', ['img/home/hero.jpg', 'img/home/c-food.jpg']); await p.waitForTimeout(600);
  check(await p.locator('.hw-ph').count() === 2, `${dev} wizard: photos not added`);
  await done(p, 'wizard-photos');
  await p.locator('.hw button', { hasText: 'Send for review' }).click(); await p.waitForTimeout(1200);
  const nh = await db(p, () => { const x = window.__db.homestays.find((h) => h.name === 'Apple Orchard Cottage'); return x && { st: x.status, price: x.price_per_night, rooms: x.rooms, imgs: x.images.length, am: x.amenities.length, r: window.__db.homestay_rooms.filter((r) => r.homestay_id === x.id).map((r) => `${r.room_type}:${r.base_price}/${r.weekend_price}x${r.total_inventory}`) }; });
  check(nh && nh.st === 'pending' && nh.price === 2000 && nh.rooms === 3 && nh.imgs === 2 && nh.am === 2 && nh.r.length === 2, `${dev} wizard saved wrong: ${JSON.stringify(nh)}`);

  // Rate calendar
  await go(p, 'partner/calendar?r=hr1');
  check(await p.locator('.cal-day').count() >= 28, `${dev} calendar grid`);
  const future = p.locator('.cal-day:not(.past)');
  await future.nth(3).click(); await future.nth(4).click();
  check(/2 date\(s\) selected/.test(await p.locator('.cal-bar').innerText()), `${dev} calendar selection bar`);
  await done(p, 'calendar-select', false);
  await p.locator('.cal-price input').fill('3000'); await p.locator('.cal-bar button', { hasText: 'Set price' }).click(); await p.waitForTimeout(900);
  check(await db(p, () => window.__db.room_rates.filter((r) => r.room_id === 'hr1' && r.custom_price === 3000).length) === 2, `${dev} calendar price not saved`);
  await p.locator('.cal-day:not(.past)').nth(3).click(); await p.locator('.cal-bar button', { hasText: 'Close (block all rooms)' }).click(); await p.waitForTimeout(900);
  check(await db(p, () => window.__db.room_rates.some((r) => r.room_id === 'hr1' && r.blocked_units === 2 && r.custom_price === 3000)), `${dev} calendar block lost the custom price`);
  await done(p, 'calendar');

  // Bookings
  await go(p, 'partner/bookings?tab=requests');
  t = await text(p);
  check(/Asha Negi/.test(t), `${dev} bookings: request missing`);
  await p.locator('.hb-card', { hasText: 'Asha Negi' }).locator('button', { hasText: 'Confirm' }).click(); await p.waitForTimeout(900);
  check(await db(p, () => window.__db.booking_requests.find((x) => x.id === 'b1').status) === 'confirmed', `${dev} confirm booking`);
  await go(p, 'partner/bookings?tab=today');
  check(/Vikram Joshi/.test(await text(p)) && /You get/.test(await text(p)), `${dev} check-ins today`);
  await done(p, 'bookings-today');
  await p.locator('.hb-card', { hasText: 'Vikram Joshi' }).locator('button', { hasText: 'Mark checked in' }).click(); await p.waitForTimeout(900);
  await p.locator('.hb-card', { hasText: 'Vikram Joshi' }).locator('button', { hasText: 'Mark completed' }).click(); await p.waitForTimeout(900);
  check(await db(p, () => window.__db.booking_requests.find((x) => x.id === 'hb3').status) === 'completed', `${dev} check-in / complete`);
  await go(p, 'voucher/hb3');
  t = await text(p);
  check(/THH-H-20112026-0006/.test(t) && /Vikram Joshi/.test(t) && /Print/.test(t), `${dev} voucher`);
  await done(p, 'voucher', false);

  // Earnings, KYC, payout
  await go(p, 'partner/earnings');
  t = await text(p);
  check(/Payable now/.test(t) && /7,040/.test(t), `${dev} earnings payable (3168 + 3872 = 7040): ${t.match(/Payable now\s*₹[\d,]+/)}`);
  check(await p.locator('button', { hasText: 'Request payout' }).isDisabled(), `${dev} payout should wait for KYC`);
  await done(p, 'earnings');
  await go(p, 'partner/kyc');
  await p.setInputFiles('.panel input[type=file]', 'img/home/c-walk.jpg');
  await p.locator('input[placeholder="name@okbank"]').fill('rawat@okbank');
  await p.locator('.panel input.input:not([type=file])').first().fill('abcde 1234f');
  await p.locator('button', { hasText: 'Save and send for verification' }).click(); await p.waitForTimeout(900);
  const k = await db(p, () => window.__db.partner_kyc.find((x) => x.partner_id === 'p1'));
  check(k && k.upi_id === 'rawat@okbank' && /^u-partner\/kyc-/.test(k.id_file), `${dev} KYC saved wrong: ${JSON.stringify(k)}`);
  await done(p, 'kyc');
  await db(p, () => { window.__db.partner_kyc.find((x) => x.partner_id === 'p1').status = 'verified'; });
  await go(p, 'partner/earnings');
  await p.locator('button', { hasText: 'Request payout' }).click(); await p.waitForTimeout(900);
  check(await db(p, () => window.__db.payout_requests.some((x) => x.partner_id === 'p1' && x.amount === 7040 && x.status === 'pending')), `${dev} payout request`);

  // Support
  await go(p, 'partner/support');
  await p.fill('#tk-subj', 'Guest asked for an invoice'); await p.fill('#tk-body', 'Can THH send a GST invoice for booking THH-H-20112026-0006?');
  await p.locator('button', { hasText: 'Send to THH support' }).click(); await p.waitForTimeout(1200);
  check(/Guest asked for an invoice/.test(await text(p)) && await p.locator('.tk-msg').count() === 1, `${dev} support ticket`);
  await done(p, 'support-thread', false);
  await p.ctx.close();

  // ── Admin ──
  p = await open(dev, opts, 'admin', 'admin/business');
  await db(p, () => {
    const d = window.__db; d.homestays.find((x) => x.id === 'h2').status = 'pending';
    d.homestay_rooms.push({ id: 'hr9', homestay_id: 'h2', room_type: 'Valley room', base_price: 1500, weekend_price: 1800, max_guests: 2, total_inventory: 2, is_active: true, sort: 0 });
    d.partner_kyc.push({ partner_id: 'p1', id_type: 'pan', id_number: 'ABCDE1234F', id_file: 'u-partner/kyc-1.jpg', gst_number: '', bank_account_name: 'Ram Singh Rawat', bank_account_number: '123456789012', bank_ifsc: 'SBIN0001234', upi_id: 'rawat@okbank', status: 'pending', admin_remark: '' });
    d.payout_requests.push({ id: 'po1', partner_id: 'p1', amount: 3168, bookings_count: 1, status: 'pending', transaction_ref: '', admin_note: '', requested_at: new Date().toISOString() });
    d.support_tickets.push({ id: 'tk1', created_by: 'u-partner', partner_id: 'p1', subject: 'Payout question', category: 'payout', status: 'open', last_message_at: new Date().toISOString(), created_at: new Date().toISOString() });
    d.ticket_messages.push({ id: 'tm1', ticket_id: 'tk1', author_id: 'u-partner', is_admin: false, body: 'When will I get my money?', created_at: new Date().toISOString() });
  });
  await go(p, 'admin/overview', 900); await go(p, 'admin/business', 1300);
  t = await text(p);
  check(/GMV/.test(t) && /Platform commission/.test(t) && /Active partners/.test(t) && /Pending approvals/.test(t), `${dev} admin business KPIs`);
  check(/properties waiting/.test(t) && /payout requests/.test(t) && /open support tickets/.test(t), `${dev} admin alerts`);
  await done(p, 'admin-business');
  await go(p, 'admin/queue', 1200);
  const card = p.locator('.aq-card', { hasText: 'Meadow View Rooms' });
  await card.locator('button', { hasText: 'Reject with remarks' }).click(); await p.waitForTimeout(400);
  check(await db(p, () => window.__db.homestays.find((x) => x.id === 'h2').status) === 'pending', `${dev} reject needs remarks`);
  await card.locator('input[type=number]').fill('15');
  await done(p, 'admin-queue');
  await card.locator('button', { hasText: 'Approve' }).click(); await p.waitForTimeout(900);
  const h2 = await db(p, () => window.__db.homestays.find((x) => x.id === 'h2'));
  check(h2.status === 'approved' && Number(h2.commission_rate) === 15, `${dev} approve with commission: ${h2.status}/${h2.commission_rate}`);
  await go(p, 'admin/queue?tab=kyc', 1000);
  await p.locator('.aq-card button', { hasText: 'Verify' }).click(); await p.waitForTimeout(900);
  check(await db(p, () => window.__db.partner_kyc[0].status) === 'verified', `${dev} verify KYC`);
  await go(p, 'admin/payouts', 1000);
  await p.locator('.aq-card button', { hasText: 'Mark paid' }).click(); await p.waitForTimeout(500);
  check(await db(p, () => window.__db.payout_requests[0].status) === 'pending', `${dev} payout needs reference`);
  await p.locator('.aq-card input').first().fill('UTR2026112201');
  await done(p, 'admin-payouts');
  await p.locator('.aq-card button', { hasText: 'Mark paid' }).click(); await p.waitForTimeout(900);
  check(await db(p, () => window.__db.payout_requests[0].status) === 'approved', `${dev} payout approve`);
  await go(p, 'admin/tickets?t=tk1', 1000);
  await p.locator('.tk-thread + .panel textarea, .panel textarea').last().fill('Paid today, reference UTR2026112201.');
  await p.locator('button', { hasText: /^Send$/ }).click(); await p.waitForTimeout(900);
  check(await db(p, () => window.__db.support_tickets[0].status) === 'answered', `${dev} ticket reply`);
  await done(p, 'admin-ticket', false);
  await go(p, 'admin/hs-bookings', 1000);
  check(/THH-H-01102026-0001/.test(await text(p)), `${dev} admin bookings list`);
  await p.ctx.close();

  // ── Guest: choose a room, see the price, send request ──
  p = await open(dev, opts, 'traveler', 'stay/h1');
  check(await p.locator('.room-opt').count() === 2, `${dev} guest: room choices`);
  await p.waitForTimeout(700);
  check(/₹/.test(await p.locator('.quote').innerText()) && /night/.test(await p.locator('.quote').innerText()), `${dev} guest: price quote`);
  await p.locator('.room-opt', { hasText: 'Double room' }).click(); await p.waitForTimeout(600);
  await done(p, 'guest-room-quote', false);
  await p.locator('form button[type=submit]', { hasText: /Request/i }).click(); await p.waitForTimeout(1000);
  const req = await db(p, () => window.__db.booking_requests.find((x) => x.room_id === 'hr2' && x.user_id === 'u-traveler'));
  check(req && req.rooms_booked === 1 && req.total_amount > 0, `${dev} guest request not saved with room: ${JSON.stringify(req && { r: req.room_id, a: req.total_amount })}`);
  await p.ctx.close();
}
await b.close(); server.kill();
console.log(problems.length ? 'PROBLEMS\n' + problems.join('\n') : 'HOMESTAY OK');
