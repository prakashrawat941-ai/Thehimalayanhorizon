// Sign in / sign up and the traveller's account (trips, bookings, notifications).
import { h, field, input, toast, busy, empty, badge, fmtDate, inr, lazy, section } from '../ui.js';
import { t, getLang } from '../i18n.js';
import { sb, q } from '../sb.js';
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

export async function account({ query }) {
  if (!user()) { location.hash = '#/login?next=account'; return h('div'); }
  await locations();
  const hi = getLang() === 'hi';
  const p = state.profile || {};

  const profileForm = h('form', { class: 'stack', onsubmit: async (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(profileForm).entries());
    await busy(profileForm.querySelector('button'), async () => {
      await q(sb.from('profiles').update({ full_name: fd.full_name, phone: fd.phone || null }).eq('id', user().id));
      await loadProfile(); toast(t('saved'));
    });
  } },
    field(t('name'), input({ name: 'full_name', value: p.full_name || '', maxlength: 120 })),
    field(t('phone'), input({ name: 'phone', type: 'tel', value: p.phone || '', maxlength: 20 })),
    h('button', { class: 'btn btn-sm' }, t('save')));

  const pwForm = query.reset ? h('form', { class: 'panel stack', onsubmit: async (e) => {
    e.preventDefault();
    const pw = pwForm.querySelector('input').value;
    await busy(pwForm.querySelector('button'), async () => {
      const { error } = await sb.auth.updateUser({ password: pw }); if (error) throw error; toast(t('saved')); location.hash = '#/account';
    });
  } }, h('h2', {}, hi ? 'नया पासवर्ड' : 'New password'), input({ type: 'password', minlength: 8, required: true }), h('button', { class: 'btn' }, t('save'))) : null;

  const partnerBox = state.partners.length
    ? h('div', { class: 'soft-note' }, state.partners.map((pt) => h('div', {}, `${pt.business_name} · `, badge(pt.status))),
      h('a', { class: 'btn btn-sm', href: '#/partner' }, hi ? 'पार्टनर डैशबोर्ड' : 'Partner dashboard'))
    : h('div', { class: 'soft-note' }, hi ? 'होमस्टे, कैब, वर्कस्पेस या गाँव का टूर चलाते हैं? ' : 'Run a homestay, cab, workspace or village tour? ',
      h('a', { href: '#/partner/join' }, t('become_partner')));

  return h('div', { class: 'page' },
    h('div', { class: 'account-head' },
      h('span', { class: 'avatar', 'aria-hidden': 'true' }, initials(p.full_name || user().email)),
      h('div', { class: 'grow' }, h('p', { class: 'eyebrow' }, p.role === 'admin' ? t('admin') : p.role === 'partner' ? t('partner') : (hi ? 'यात्री' : 'Traveller')),
        h('h1', {}, p.full_name || user().email), h('p', { class: 'muted' }, user().email)),
      h('div', { class: 'actions' },
        isAdmin() ? h('a', { class: 'btn btn-sm', href: '#/admin' }, t('admin')) : null,
        h('button', { class: 'btn btn-ghost btn-sm install-btn', onclick: async () => { if (!(await installApp())) toast(hi ? 'ब्राउज़र मेन्यू से "Add to Home screen" चुनें' : 'Use your browser menu → “Add to Home screen”'); } }, t('install_app')),
        h('button', { class: 'btn btn-ghost btn-sm', onclick: async () => { await sb.auth.signOut(); state.session = null; await loadProfile(); location.hash = '#/'; } }, t('signout')))),
    pwForm,
    partnerBox,
    section(t('notifications'), null, lazy(notificationsList)),
    section(t('my_bookings'), null, lazy(bookingsList)),
    section(hi ? 'मेरी कैब सीटें' : 'My cab seats', null, lazy(cabBookingsList)),
    section(t('my_trips'), null, lazy(tripsList), h('a', { class: 'link-more', href: '#/plan' }, `+ ${t('new_trip')}`)),
    section(t('profile'), null, h('div', { class: 'panel' }, profileForm)));
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
  const rows = await q(sb.from('cab_bookings').select('*, cab_rides(departure_at, from_location_id, to_location_id, vehicle_model, price_per_seat)')
    .eq('user_id', user().id).order('created_at', { ascending: false }));
  if (!rows.length) return empty();
  const hi = getLang() === 'hi';
  return h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
    h('tbody', {}, rows.map((b) => {
      const r = b.cab_rides || {};
      const f = locationById(r.from_location_id); const to = locationById(r.to_location_id);
      return h('tr', {},
        h('td', {}, h('strong', {}, `${f?.name || '?'} → ${to?.name || '?'}`), h('div', { class: 'muted small' }, `${fmtDate(r.departure_at, true)} · ${r.vehicle_model || ''}`)),
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
