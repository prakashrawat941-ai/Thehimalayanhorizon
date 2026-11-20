// Sign in / sign up and the traveller's account (trips, bookings, notifications).
import { h, field, input, toast, busy, empty, badge, fmtDate, inr, lazy, section, icon, cover } from '../ui.js';
import { dashShell } from '../shell.js';
import { t, getLang, setLang, pick } from '../i18n.js';
import { sb, q, uploadImage } from '../sb.js';
import { googleButton } from '../google.js';
import { allPlaces, placeName } from '../places.js';
import { state, user, loadProfile, locations, locationById, isAdmin } from '../store.js';
import { installApp } from '../app.js';

export async function login({ query }) {
  const next = query.next || 'account';
  if (user()) { location.hash = '#/' + next; return h('div'); }
  const hi = getLang() === 'hi';
  let mode = query.mode === 'signup' ? 'signup' : 'signin';
  const box = h('div', { class: 'auth-form' });

  const paint = () => {
    box.replaceChildren();
    const nameF = field(t('name'), input({ name: 'full_name', required: true, minlength: 2, autocomplete: 'name' }));
    const phoneF = field(t('phone'), input({ name: 'phone', type: 'tel', autocomplete: 'tel' }));
    const form = h('form', { class: 'stack', onsubmit: async (e) => {
      e.preventDefault();
      const fd = Object.fromEntries(new FormData(form).entries());
      await busy(form.querySelector('button[type=submit]'), async () => {
        if (mode === 'signup') {
          const { data, error } = await sb.auth.signUp({
            email: fd.email, password: fd.password,
            options: { data: { full_name: fd.full_name, phone: fd.phone || null }, emailRedirectTo: location.origin + location.pathname },
          });
          if (error) throw error;
          if (!data.session) {
            toast(hi ? 'ईमेल में भेजे गए लिंक से अकाउंट पक्का कीजिए, फिर लॉगिन कीजिए।' : 'Check your email to confirm your account, then sign in.');
            mode = 'signin'; paint(); return;
          }
        } else {
          const { error } = await sb.auth.signInWithPassword({ email: fd.email, password: fd.password });
          if (error) throw error;
        }
        await waitForProfile();
        location.hash = '#/' + next;
      });
    } },
      h('div', { class: 'seg', role: 'tablist' },
        h('button', { type: 'button', role: 'tab', 'aria-selected': String(mode === 'signin'), class: mode === 'signin' ? 'on' : '', onclick: () => { mode = 'signin'; paint(); } }, t('signin')),
        h('button', { type: 'button', role: 'tab', 'aria-selected': String(mode === 'signup'), class: mode === 'signup' ? 'on' : '', onclick: () => { mode = 'signup'; paint(); } }, t('signup'))),
      h('h1', {}, mode === 'signup' ? (hi ? 'नया अकाउंट' : 'Create your account') : (hi ? 'फिर से स्वागत है' : 'Welcome back')),
      h('p', { class: 'muted' }, hi ? 'अपनी यात्राएँ, बुकिंग और सूचनाएँ एक जगह देखिए।' : 'See your trips, bookings and notifications in one place.'),
      googleButton(next),
      h('div', { class: 'or-line' }, h('span', {}, t('or_email'))),
      mode === 'signup' ? nameF : null,
      field(t('email'), input({ name: 'email', type: 'email', required: true, autocomplete: 'email' })),
      mode === 'signup' ? phoneF : null,
      field(t('password'), input({ name: 'password', type: 'password', required: true, minlength: 8, autocomplete: mode === 'signup' ? 'new-password' : 'current-password' }),
        mode === 'signup' ? (hi ? 'कम से कम 8 अक्षर' : 'At least 8 characters') : null),
      h('button', { class: 'btn btn-block', type: 'submit' }, mode === 'signup' ? t('signup') : t('signin')),
      h('button', { type: 'button', class: 'link', onclick: () => { mode = mode === 'signup' ? 'signin' : 'signup'; paint(); } },
        mode === 'signup' ? (hi ? 'पहले से अकाउंट है? लॉगिन करें' : 'Already have an account? Sign in')
          : (hi ? 'नया अकाउंट बनाएँ' : 'New here? Create an account')),
      mode === 'signin' ? h('button', { type: 'button', class: 'link', onclick: () => resetPassword(form) }, hi ? 'पासवर्ड भूल गए?' : 'Forgot password?') : null,
      h('p', { class: 'muted small center' }, hi ? 'होमस्टे, कैब या गाँव टूर चलाते हैं? ' : 'Run a homestay, cab or village tour? ', h('a', { href: '#/partner/join' }, t('become_partner'))));
    box.append(form);
  };
  paint();
  return h('div', { class: 'auth-split' },
    h('div', { class: 'auth-photo' },
      h('img', { src: 'img/home/hero.jpg', alt: '' }),
      h('div', { class: 'auth-photo-text' },
        h('p', { class: 'auth-script' }, hi ? 'असली लोग, असली गाँव' : 'Real People, Real Villages'),
        h('p', { class: 'auth-line' }, t('cta_h')))),
    box);
}

async function resetPassword(form) {
  const email = form.querySelector('[name=email]').value;
  const hi = getLang() === 'hi';
  if (!email) { toast(hi ? 'पहले ईमेल लिखिए' : 'Type your email first', 'warn'); return; }
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname + '#/account?reset=1' });
  toast(error ? error.message : (hi ? 'पासवर्ड बदलने का लिंक ईमेल पर भेज दिया' : 'Password reset link sent'), error ? 'err' : 'ok');
}

async function waitForProfile() {
  const { data } = await sb.auth.getSession();
  state.session = data.session;
  await loadProfile();
}

export async function account({ query, params = {} }) {
  if (!user()) { location.hash = '#/login?next=account'; return h('div'); }
  await locations();
  const hi = getLang() === 'hi';
  const L = (en, h2) => (hi ? h2 : en);
  const p = state.profile || {};
  const tab = params.tab || (query.reset ? 'profile' : 'overview');
  const it = (key, ic, label, href) => ({ key, href: href || `#/account/${key}`, icon: ic, label });
  const groups = [
    { items: [it('overview', 'grid', L('Overview', 'सारांश'), '#/account')] },
    { label: L('Travel', 'यात्रा'), items: [it('trips', 'map', t('my_trips'), '#/trips'), it('bookings', 'calendar', t('my_bookings')), it('saved', 'heart', L('Saved places', 'सेव जगहें'))] },
    { label: L('Account', 'अकाउंट'), items: [it('notifications', 'bell', t('notifications')), it('profile', 'settings', L('Profile & settings', 'प्रोफ़ाइल और सेटिंग्स'))] },
  ];
  if (isAdmin()) groups.push({ label: L('Manage', 'प्रबंधन'), items: [it('admin', 'shield', t('admin'), '#/admin')] });
  if (state.partners.length) groups[groups.length - 1].items.push(it('partner', 'house', L('Partner portal', 'पार्टनर पोर्टल'), '#/partner'));
  const views = { overview: () => overviewTab(L), bookings: () => bookingsTab(), saved: () => savedTab(L), notifications: notificationsList, profile: () => profileTab(L, query) };
  const roleLabel = p.role === 'admin' ? t('admin') : p.role === 'partner' ? t('partner') : L('Traveller', 'यात्री');
  return dashShell({
    title: tab === 'overview' ? L(`Namaste, ${(p.full_name || '').split(' ')[0] || L('traveller', 'यात्री')}`, `नमस्ते, ${(p.full_name || '').split(' ')[0] || 'यात्री'}`) : groups.flatMap((g) => g.items).find((x) => x.key === tab)?.label,
    eyebrow: roleLabel,
    subtitle: tab === 'overview' ? user().email : null,
    avatar: avatarEl(p),
    groups, active: tab, brand: L('My account', 'मेरा अकाउंट'),
    body: lazy(views[tab] || views.overview),
  });
}

const avatarEl = (p) => h('span', { class: 'ds-avatar', 'aria-hidden': 'true' }, p.avatar_url ? h('img', { src: p.avatar_url, alt: '' }) : initials(p.full_name || user().email));

async function overviewTab(L) {
  const today = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
  const [trips, reqs, cabs, notes, saved] = await Promise.all([
    q(sb.from('trips').select('id,title,start_date,days_count,travellers').eq('user_id', user().id).gte('start_date', today).order('start_date').limit(1)).catch(() => []),
    q(sb.from('booking_requests').select('id,status,start_date,homestays(name),village_tours(title),workspaces(name),kind').eq('user_id', user().id).order('created_at', { ascending: false }).limit(3)).catch(() => []),
    q(sb.from('cab_bookings').select('id,status,seats,from_place_id,to_place_id,cab_rides(departure_at,from_location_id,to_location_id,from_place_id,to_place_id)').eq('user_id', user().id).order('created_at', { ascending: false }).limit(3)).catch(() => []),
    q(sb.from('notifications').select('id').is('read_at', null)).catch(() => []),
    sb.from('saved_destinations').select('location_id').then((r) => (r.error ? [] : r.data)),
  ]);
  const places = await allPlaces().catch(() => []);
  const tile = (ic, label, href) => h('a', { class: 'acc-tile', href }, icon(ic, 24), h('span', {}, label));
  const next = trips[0];
  const bookings = [
    ...cabs.map((b) => ({ ic: 'car', name: `${L('Shared ride', 'शेयर राइड')} · ${rideRoute(b, places)}`, sub: `${fmtDate(b.cab_rides?.departure_at, true)} · ${b.seats} ${L('seats', 'सीट')}`, status: b.status })),
    ...reqs.map((r) => ({ ic: 'house', name: r.homestays?.name || r.village_tours?.title || r.workspaces?.name || r.kind, sub: fmtDate(r.start_date), status: r.status })),
  ].slice(0, 4);
  const savedLocs = saved.map((s) => locationById(s.location_id)).filter(Boolean).slice(0, 4);
  return h('div', { class: 'ds-body' },
    h('div', { class: 'acc-tiles' }, tile('map', L('Plan a trip', 'ट्रिप प्लान करें'), '#/plan/new'), tile('car', L('Book a seat', 'सीट बुक करें'), '#/cab/find'),
      tile('heart', L('Saved', 'सेव'), '#/account/saved'), tile('bell', `${L('Updates', 'सूचनाएँ')}${notes.length ? ` (${notes.length})` : ''}`, '#/account/notifications')),
    h('div', { class: 'ds-cols' },
      h('section', { class: 'ds-panel' }, h('h2', {}, L('Upcoming trip', 'आने वाली ट्रिप'), h('a', { href: '#/trips' }, L('My trips', 'मेरी ट्रिप'))),
        next ? h('a', { class: 'acc-trip', href: `#/trip/${next.id}` },
          h('span', { class: 'pill pill-ok' }, daysUntil(next.start_date, L)),
          h('strong', {}, next.title), h('span', { class: 'muted' }, `${fmtDate(next.start_date)} · ${next.days_count} ${t('days')} · ${next.travellers} ${L('travellers', 'यात्री')}`),
          h('span', { class: 'acc-link' }, L('Open trip report', 'ट्रिप रिपोर्ट खोलें'), icon('arrow', 16)))
          : empty(L('No upcoming trip yet.', 'अभी कोई आने वाली ट्रिप नहीं।'), h('a', { class: 'btn btn-sm', href: '#/plan/new' }, L('Create my trip', 'मेरी ट्रिप बनाएँ')), 'map')),
      h('section', { class: 'ds-panel' }, h('h2', {}, L('Bookings', 'बुकिंग'), h('a', { href: '#/account/bookings' }, L('All', 'सभी'))),
        bookings.length ? h('div', { class: 'ds-rows' }, bookings.map((b) => h('div', { class: 'ds-row' }, h('span', { class: 'ds-row-ico' }, icon(b.ic, 20)),
          h('span', { class: 'grow' }, h('strong', {}, b.name), h('span', {}, b.sub)), badge(b.status))))
          : empty(L('No bookings yet.', 'अभी कोई बुकिंग नहीं।'), h('a', { class: 'btn btn-ghost btn-sm', href: '#/stays' }, L('Find a homestay', 'होमस्टे खोजें')), 'calendar'))),
    h('section', { class: 'ds-panel' }, h('h2', {}, L('Saved places', 'सेव जगहें'), h('a', { href: '#/account/saved' }, L('See all', 'सभी देखें'))),
      savedLocs.length ? h('div', { class: 'acc-saved' }, savedLocs.map(placeTile))
        : empty(L('Tap ♡ on a place to save it here.', 'किसी जगह पर ♡ दबाकर उसे यहाँ सेव करें।'), h('a', { class: 'btn btn-ghost btn-sm', href: '#/plan' }, L('Browse places', 'जगहें देखें')), 'heart')),
    partnerNote(L));
}

// Route of a cab booking: the booked part (places), else the ride's own ends.
function rideRoute(b, places) {
  const r = b.cab_rides || {};
  const nm = (pid, lid) => { const p = pid && places.find((x) => x.id === pid); if (p) return placeName(p); const l = lid && locationById(lid); return l ? pick(l, 'name') : '?'; };
  return `${nm(b.from_place_id || r.from_place_id, r.from_location_id)} → ${nm(b.to_place_id || r.to_place_id, r.to_location_id)}`;
}

function daysUntil(iso, L) {
  const d = Math.round((new Date(`${iso}T12:00:00+05:30`) - new Date(new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10) + 'T12:00:00+05:30')) / 864e5);
  return d <= 0 ? L('Today', 'आज') : d === 1 ? L('Tomorrow', 'कल') : L(`In ${d} days`, `${d} दिन में`);
}
const placeTile = (l) => h('a', { class: 'acc-place', href: `#/place/${l.slug}` }, cover(l.image_url, l.slug, 'acc-place-img'), h('strong', {}, pick(l, 'name')));

function partnerNote(L) {
  return state.partners.length
    ? h('div', { class: 'soft-note' }, state.partners.map((pt) => h('div', {}, `${pt.business_name} · `, badge(pt.status))), h('a', { class: 'btn btn-sm', href: '#/partner' }, L('Partner dashboard', 'पार्टनर डैशबोर्ड')))
    : h('div', { class: 'soft-note' }, L('Run a homestay, cab, workspace or village tour? ', 'होमस्टे, कैब, वर्कस्पेस या गाँव का टूर चलाते हैं? '), h('a', { href: '#/partner/join' }, t('become_partner')));
}

async function bookingsTab() {
  const hi = getLang() === 'hi';
  return h('div', { class: 'ds-body' },
    h('section', { class: 'ds-panel' }, h('h2', {}, hi ? 'होमस्टे, वर्कस्पेस और टूर' : 'Homestays, workspaces & tours'), lazy(bookingsList)),
    h('section', { class: 'ds-panel' }, h('h2', {}, hi ? 'शेयर राइड की सीटें' : 'Shared ride seats'), lazy(cabBookingsList)));
}

async function savedTab(L) {
  const r = await sb.from('saved_destinations').select('location_id, created_at').order('created_at', { ascending: false });
  if (r.error) return empty(L('Saved places are not available right now.', 'सेव जगहें अभी उपलब्ध नहीं।'));
  const locs = r.data.map((s) => locationById(s.location_id)).filter(Boolean);
  if (!locs.length) return empty(L('Tap ♡ on a place in the Trip Planner to save it here.', 'ट्रिप प्लानर में किसी जगह पर ♡ दबाकर उसे यहाँ सेव करें।'), h('a', { class: 'btn btn-sm', href: '#/plan' }, L('Browse places', 'जगहें देखें')), 'heart');
  return h('div', { class: 'acc-saved' }, locs.map(placeTile));
}

async function profileTab(L, query) {
  const p = state.profile || {};
  const avatar = avatarEl(p);
  avatar.classList.add('acc-avatar-lg');
  const fileIn = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', class: 'sr-only', id: 'acc-photo' });
  fileIn.addEventListener('change', async () => {
    const f = fileIn.files[0]; if (!f) return;
    const btn = document.querySelector('label[for=acc-photo]');
    btn?.classList.add('is-busy');
    try {
      const small = await shrinkImage(f, 512);
      const url = await uploadImage(small, user().id);
      await q(sb.from('profiles').update({ avatar_url: url }).eq('id', user().id));
      await loadProfile(); toast(L('Photo updated', 'फ़ोटो बदल गई'), 'ok');
      avatar.replaceChildren(h('img', { src: url, alt: '' }));
    } catch (e) { toast(e.message || String(e), 'err'); }
    finally { btn?.classList.remove('is-busy'); fileIn.value = ''; }
  });
  const profileForm = h('form', { class: 'stack', onsubmit: async (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(profileForm).entries());
    await busy(profileForm.querySelector('button[type=submit]'), async () => {
      await q(sb.from('profiles').update({ full_name: fd.full_name.trim(), phone: fd.phone.trim() || null }).eq('id', user().id));
      await loadProfile(); toast(t('saved'), 'ok');
    });
  } },
    field(t('name'), input({ name: 'full_name', value: p.full_name || '', maxlength: 120, required: true, minlength: 2, autocomplete: 'name' })),
    field(t('phone'), input({ name: 'phone', type: 'tel', value: p.phone || '', maxlength: 20, autocomplete: 'tel', pattern: '[0-9+ -]{7,20}' }), L('Shared only with hosts or drivers you book with.', 'सिर्फ़ उन होस्ट या ड्राइवर को दिखता है जिनके साथ आप बुक करते हैं।')),
    field(t('email'), input({ value: user().email, disabled: true })),
    h('button', { class: 'btn', type: 'submit' }, t('save')));
  const pwForm = h('form', { class: 'stack', onsubmit: async (e) => {
    e.preventDefault();
    const pw = pwForm.querySelector('input').value;
    await busy(pwForm.querySelector('button'), async () => {
      const { error } = await sb.auth.updateUser({ password: pw }); if (error) throw error; toast(t('saved'), 'ok'); pwForm.reset();
    });
  } }, field(L('New password', 'नया पासवर्ड'), input({ type: 'password', minlength: 8, required: true, autocomplete: 'new-password' }), L('At least 8 characters', 'कम से कम 8 अक्षर')),
    h('button', { class: 'btn btn-ghost' }, L('Change password', 'पासवर्ड बदलें')));
  const langBtns = h('div', { class: 'seg', role: 'group', 'aria-label': 'Language' }, [['en', 'English'], ['hi', 'हिंदी']].map(([k, label]) => h('button', { type: 'button', class: getLang() === k ? 'on' : '', 'aria-pressed': String(getLang() === k), onclick: () => { setLang(k); location.reload(); } }, label)));
  return h('div', { class: 'ds-cols' },
    h('section', { class: 'ds-panel' }, h('h2', {}, L('Your profile', 'आपकी प्रोफ़ाइल')),
      h('div', { class: 'acc-photo-row' }, avatar, h('div', {}, h('label', { class: 'btn btn-ghost btn-sm', for: 'acc-photo' }, icon('camera', 16), L('Change photo', 'फ़ोटो बदलें')), fileIn,
        h('p', { class: 'muted small' }, L('JPG, PNG or WebP, up to 5 MB.', 'JPG, PNG या WebP, 5 MB तक।')))),
      profileForm),
    h('div', { class: 'ds-body' },
      h('section', { class: 'ds-panel', id: 'password' }, h('h2', {}, L('Password', 'पासवर्ड')), query.reset ? h('p', { class: 'soft-note' }, L('Set your new password below.', 'नीचे अपना नया पासवर्ड रखें।')) : null, pwForm),
      h('section', { class: 'ds-panel' }, h('h2', {}, L('Language', 'भाषा')), langBtns),
      h('section', { class: 'ds-panel' }, h('h2', {}, L('App', 'ऐप')),
        h('button', { class: 'btn btn-ghost install-btn', onclick: async () => { if (!(await installApp())) toast(L('Use your browser menu → "Add to Home screen"', 'ब्राउज़र मेन्यू से "Add to Home screen" चुनें')); } }, L('Install the app', 'ऐप इंस्टॉल करें')),
        h('button', { class: 'btn btn-ghost', onclick: async () => { await sb.auth.signOut(); state.session = null; await loadProfile(); location.hash = '#/'; } }, icon('logout', 16), t('signout')))));
}

// Make photos small before upload (faster on mobile data).
async function shrinkImage(file, max) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  const img = await createImageBitmap(file).catch(() => null);
  if (!img) return file;
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement('canvas'); c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.85));
  return blob ? new File([blob], 'avatar.jpg', { type: 'image/jpeg' }) : file;
}

async function notificationsList() {
  const rows = await q(sb.from('notifications').select('*').order('created_at', { ascending: false }).limit(20));
  if (!rows.length) return empty();
  const unread = rows.filter((r) => !r.read_at).map((r) => r.id);
  if (unread.length) sb.from('notifications').update({ read_at: new Date().toISOString() }).in('id', unread).then(() => {});
  return h('ul', { class: 'list' }, rows.map((n) => h('li', { class: n.read_at ? '' : 'unread' },
    h('a', { href: n.link || '#/account' }, h('strong', {}, n.title), h('span', { class: 'muted' }, ` · ${fmtDate(n.created_at, true)}`), h('div', {}, n.body)))));
}

async function bookingsList() {
  const rows = await q(sb.from('booking_requests')
    .select('*, homestays(name), village_tours(title), workspaces(name)')
    .eq('user_id', user().id).order('created_at', { ascending: false }));
  if (!rows.length) return empty();
  const hi = getLang() === 'hi';
  return h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
    h('thead', {}, h('tr', {}, ['', t('date'), t('guests'), t('status'), ''].map((x) => h('th', {}, x)))),
    h('tbody', {}, rows.map((r) => {
      const name = r.homestays?.name || r.village_tours?.title || r.workspaces?.name || r.kind;
      const cancel = ['requested', 'confirmed'].includes(r.status)
        ? h('button', { class: 'btn btn-ghost btn-sm', onclick: async (e) => {
          if (!confirm(hi ? 'यह रिक्वेस्ट रद्द करें?' : 'Cancel this request?')) return;
          await busy(e.target, async () => { await q(sb.rpc('set_booking_status', { p_id: r.id, p_status: 'cancelled', p_note: '' })); toast(t('saved')); location.reload(); });
        } }, t('cancel')) : null;
      return h('tr', {},
        h('td', {}, h('strong', {}, name), r.partner_note ? h('div', { class: 'muted small' }, r.partner_note) : null),
        h('td', {}, fmtDate(r.start_date) + (r.end_date !== r.start_date ? ` → ${fmtDate(r.end_date)}` : '')),
        h('td', {}, r.guests), h('td', {}, badge(r.status)), h('td', {}, cancel));
    }))));
}

async function cabBookingsList() {
  const places = await allPlaces().catch(() => []);
  const rows = await q(sb.from('cab_bookings').select('*, cab_rides(departure_at, from_location_id, to_location_id, from_place_id, to_place_id, vehicle_model, price_per_seat)')
    .eq('user_id', user().id).order('created_at', { ascending: false }));
  if (!rows.length) return empty();
  const hi = getLang() === 'hi';
  return h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
    h('tbody', {}, rows.map((b) => {
      const r = b.cab_rides || {};
      return h('tr', {},
        h('td', {}, h('strong', {}, rideRoute(b, places)), h('div', { class: 'muted small' }, `${fmtDate(r.departure_at, true)} · ${r.vehicle_model || ''}`)),
        h('td', {}, `${b.seats} × ${inr(r.price_per_seat)}`),
        h('td', {}, badge(b.status)),
        h('td', {}, ['pending', 'confirmed'].includes(b.status) ? h('button', { class: 'btn btn-ghost btn-sm', onclick: async (e) => {
          if (!confirm(hi ? 'सीट रद्द करें?' : 'Cancel these seats?')) return;
          await busy(e.target, async () => { await q(sb.rpc('set_cab_booking_status', { p_booking: b.id, p_status: 'cancelled' })); toast(t('saved')); location.reload(); });
        } }, t('cancel')) : null));
    }))));
}

async function tripsList() {
  const rows = await q(sb.from('trips').select('id,title,days_count,start_date,created_at').eq('user_id', user().id).order('created_at', { ascending: false }));
  if (!rows.length) return empty(undefined, h('a', { class: 'btn', href: '#/plan' }, t('new_trip')));
  return h('ul', { class: 'list' }, rows.map((tr) => h('li', {},
    h('a', { href: `#/trip/${tr.id}` }, h('strong', {}, tr.title), h('span', { class: 'muted' }, ` · ${tr.days_count} ${t('days')}${tr.start_date ? ' · ' + fmtDate(tr.start_date) : ''}`)))));
}

export function initials(name = '') {
  return String(name).split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '•';
}

